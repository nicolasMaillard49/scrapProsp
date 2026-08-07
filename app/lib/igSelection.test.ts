import test from "node:test";
import assert from "node:assert/strict";
import { daySlots, countRealFollowups, isSelectable, roundRobinByMetier, metierOf, parisDayKey, partSansSite, estSansSite, MAX_FOLLOWERS, MAX_PER_METIER } from "./igSelection";

const base = {
  id: "x",
  username: "compte",
  qualification: "qualified" as const,
  followers: 800,
  bio: "Plombier à Angers, devis gratuit",
  full_name: "Plomberie Martin",
};

test("daySlots: les relances dues mangent le quota d'accroches", () => {
  assert.equal(daySlots({ daily: 50, day: 0 }, 0), 50);
  assert.equal(daySlots({ daily: 50, day: 0 }, 12), 38);
  // Chauffe J2 : 10/j, dont 4 relances → 6 accroches.
  assert.equal(daySlots({ daily: 10, day: 2 }, 4), 6);
  // Jamais négatif : plus de relances dues que de quota → 0 accroche.
  assert.equal(daySlots({ daily: 5, day: 1 }, 9), 0);
  // Compte en pause.
  assert.equal(daySlots({ daily: 0, day: 0 }, 0), 0);
});

test("countRealFollowups: un M1 sans réponse ne mange pas de quota", () => {
  const due = [
    { stage: "accroche" }, // M1 sans réponse → ne sera jamais relancé
    { stage: "accroche" },
    { stage: "presentation" }, // conversation engagée → relance réelle
    { stage: "douleur" },
    { stage: null }, // jamais contacté : n'a rien à voir dans la file
  ];
  assert.equal(countRealFollowups(due), 2);
  assert.equal(countRealFollowups([]), 0);
  // Le piège que ça évite : 50 « relances dues » au stade accroche videraient la journée.
  const piege = Array.from({ length: 50 }, () => ({ stage: "accroche" }));
  assert.equal(daySlots({ daily: 50, day: 0 }, countRealFollowups(piege)), 50);
});

test("isSelectable: uniquement le qualifié IA, dans la cible et sous le plafond", () => {
  assert.ok(isSelectable({ ...base }));
  // Verdict IA : rien d'autre que « qualified » n'entre dans la sélection.
  assert.ok(!isSelectable({ ...base, qualification: "borderline" }));
  assert.ok(!isSelectable({ ...base, qualification: "rejected" }));
  assert.ok(!isSelectable({ ...base, qualification: null }));
  // Plafond d'abonnés (filtre dur du cockpit).
  assert.ok(!isSelectable({ ...base, followers: MAX_FOLLOWERS + 1 }));
  assert.ok(isSelectable({ ...base, followers: MAX_FOLLOWERS }));
  // Abonnés inconnus : on laisse passer.
  assert.ok(isSelectable({ ...base, followers: null }));
});

test("isSelectable: hors-cible écarté, activité contrôlée quand elle est connue", () => {
  // Compte hors zone francophone → un DM en français est perdu d'avance.
  assert.ok(!isSelectable({ ...base, bio: "Plomberie à Montréal, Québec" }));
  // Compte non commercial.
  assert.ok(!isSelectable({ ...base, category: "Personal blog" }));

  const now = Date.parse("2026-07-31T10:00:00Z");
  const recent = new Date(now - 20 * 24 * 3600_000).toISOString();
  const vieux = new Date(now - 200 * 24 * 3600_000).toISOString();
  assert.ok(isSelectable({ ...base, last_post_at: recent }, now));
  assert.ok(!isSelectable({ ...base, last_post_at: vieux }, now));
  // Date inconnue : on laisse passer (le score a déjà pénalisé).
  assert.ok(isSelectable({ ...base, last_post_at: null }, now));
});

test("roundRobinByMetier: un prospect par métier à tour de rôle, sans-métier en fin de tour", () => {
  const mk = (id: string, bio: string) => ({ id, username: id, bio, full_name: null });
  const rows = [
    mk("p1", "plombier"),
    mk("p2", "plombier"),
    mk("p3", "plombier"),
    mk("c1", "coiffeur"),
    mk("c2", "coiffeur"),
    mk("z1", "rien qui ressemble a une activite"),
  ];
  // Un de chaque métier par tour ; le sans-métier ferme le tour (M1 générique = plus faible).
  assert.deepEqual(roundRobinByMetier(rows, 4).map((r) => r.id), ["p1", "c1", "z1", "p2"]);
  // Une fois les petites files vides, le gros stock reprend la main.
  assert.deepEqual(roundRobinByMetier(rows, 6).map((r) => r.id), ["p1", "c1", "z1", "p2", "c2", "p3"]);
  // Demander plus que le stock ne boucle pas.
  assert.equal(roundRobinByMetier(rows, 99).length, 6);
  assert.equal(roundRobinByMetier(rows, 0).length, 0);
  assert.equal(roundRobinByMetier([], 10).length, 0);
});

test("roundRobinByMetier: aucun métier ne dépasse le plafond, même si le stock n'a que lui", () => {
  const mk = (id: string, bio: string) => ({ id, username: id, bio, full_name: null });
  // Le cas réel du 04/08 : un stock qualifié à deux métiers pour 50 créneaux.
  const rows = [
    ...Array.from({ length: 20 }, (_, i) => mk(`pod${i}`, "pedicure podologue")),
    ...Array.from({ length: 20 }, (_, i) => mk(`men${i}`, "menuisier")),
  ];
  const out = roundRobinByMetier(rows, 50);
  // 2 métiers × 5 = 10, PAS 40. Le manque est voulu : il relance la chasse.
  assert.equal(out.length, 2 * MAX_PER_METIER);
  const parMetier = new Map<string, number>();
  for (const r of out) parMetier.set(metierOf(r), (parMetier.get(metierOf(r)) ?? 0) + 1);
  assert.deepEqual([...parMetier.values()], [MAX_PER_METIER, MAX_PER_METIER]);
  // Et ce sont bien les premiers de chaque file (ordre de score préservé).
  assert.deepEqual(out.map((r) => r.id).sort(), ["men0", "men1", "men2", "men3", "men4", "pod0", "pod1", "pod2", "pod3", "pod4"]);
});

test("roundRobinByMetier: le plafond tient compte de ce que la journée contient DÉJÀ", () => {
  const mk = (id: string, bio: string) => ({ id, username: id, bio, full_name: null });
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => mk(`pod${i}`, "pedicure podologue")),
    ...Array.from({ length: 10 }, (_, i) => mk(`men${i}`, "menuisier")),
  ];
  // 4 podologues sont déjà posés (report de la veille) : il n'en reste qu'un.
  const out = roundRobinByMetier(rows, 20, { already: new Map([["podologue", 4]]) });
  assert.equal(out.filter((r) => metierOf(r) === "podologue").length, 1);
  assert.equal(out.filter((r) => metierOf(r) === "menuisier").length, MAX_PER_METIER);
  // Un métier déjà au plafond n'en reçoit plus aucun.
  const sature = roundRobinByMetier(rows, 20, { already: new Map([["podologue", MAX_PER_METIER]]) });
  assert.equal(sature.filter((r) => metierOf(r) === "podologue").length, 0);
});

test("roundRobinByMetier: plafond réglable, et jamais de boucle infinie sur un stock saturé", () => {
  const mk = (id: string, bio: string) => ({ id, username: id, bio, full_name: null });
  const rows = Array.from({ length: 30 }, (_, i) => mk(`p${i}`, "plombier"));
  assert.equal(roundRobinByMetier(rows, 30, { maxPerMetier: 3 }).length, 3);
  // Demander 30 quand tout est plafonné rend la main immédiatement.
  assert.equal(roundRobinByMetier(rows, 30, { maxPerMetier: 1 }).length, 1);
  assert.equal(roundRobinByMetier(rows, 30, { already: new Map([["plombier", 99]]) }).length, 0);
});

test("metierOf: la profession IA prime sur la catégorie puis sur le métier stocké", () => {
  assert.equal(metierOf({ id: "1", username: "u", profession_ia: "Plombier chauffagiste" }), "plombier");
  assert.equal(metierOf({ id: "1", username: "u", category: "Hair Salon", metier: "plombier" }), "coiffeur");
  assert.equal(metierOf({ id: "1", username: "u", metier: "macon" }), "macon");
  assert.equal(metierOf({ id: "1", username: "u" }), "");
});

test("estSansSite: l'inconnu compte comme sans site, seul un site AVÉRÉ exclut", () => {
  assert.ok(estSansSite({ id: "1", username: "u", has_website: false }));
  assert.ok(estSansSite({ id: "1", username: "u", has_website: null }));
  assert.ok(estSansSite({ id: "1", username: "u" }));
  assert.ok(!estSansSite({ id: "1", username: "u", has_website: true }));
});

test("partSansSite: le plancher réserve ses créneaux, le reste est libre", () => {
  // Le cas demandé : 49 sans site sur 50, journée vide.
  assert.deepEqual(partSansSite(50, 49, 0, 0), { sansSite: 49, libre: 1 });
  // Plancher au maximum : toute la journée est réservée.
  assert.deepEqual(partSansSite(50, 50, 0, 0), { sansSite: 50, libre: 0 });
  // Plancher à zéro = comportement d'avant, aucune part réservée.
  assert.deepEqual(partSansSite(50, 0, 0, 0), { sansSite: 0, libre: 50 });
});

test("partSansSite: le plancher s'écrête au nombre de créneaux du jour", () => {
  // Chauffe J2 : 10 créneaux. Un plancher de 50 en vaut 10, pas 50.
  assert.deepEqual(partSansSite(10, 50, 0, 0), { sansSite: 10, libre: 0 });
  // Compte en pause : rien à poser, et surtout rien de négatif.
  assert.deepEqual(partSansSite(0, 49, 0, 0), { sansSite: 0, libre: 0 });
});

test("partSansSite: les reports d'hier décomptent la part qu'ils occupent", () => {
  // 12 sans site déjà posés : il n'en manque que 37 pour tenir le plancher.
  assert.deepEqual(partSansSite(50, 49, 12, 0), { sansSite: 37, libre: 1 });
  // Plancher déjà tenu : tout ce qui reste est libre.
  assert.deepEqual(partSansSite(50, 49, 49, 0), { sansSite: 0, libre: 1 });
  // Plancher dépassé (la veille était généreuse) : jamais de valeur négative.
  assert.deepEqual(partSansSite(50, 20, 30, 0), { sansSite: 0, libre: 20 });
});

test("partSansSite: un report AVEC site occupe un créneau qu'on ne peut pas reprendre", () => {
  // 10 « avec site » reportés d'hier, plancher 49 sur 50 : la part libre (1)
  // est mangée, les 9 autres empiètent sur la réserve. Le plancher devient
  // inatteignable AUJOURD'HUI — c'est un fait, pas un plantage.
  assert.deepEqual(partSansSite(50, 49, 0, 10), { sansSite: 40, libre: 0 });
  // Journée déjà pleine : plus rien à poser, dans aucune part.
  assert.deepEqual(partSansSite(50, 49, 20, 30), { sansSite: 0, libre: 0 });
  // Sur-remplie (le plafond a baissé, des relances sont tombées) : pas de négatif.
  assert.deepEqual(partSansSite(10, 49, 8, 9), { sansSite: 0, libre: 0 });
});

test("partSansSite: les deux parts remplissent exactement les créneaux restants", () => {
  for (const slots of [0, 7, 50]) {
    for (const min of [0, 5, 49, 50, 100]) {
      for (const sans of [0, 3, 40]) {
        for (const avec of [0, 3, 40]) {
          const p = partSansSite(slots, min, sans, avec);
          assert.ok(p.sansSite >= 0 && p.libre >= 0, `négatif pour ${slots}/${min}/${sans}/${avec}`);
          assert.equal(p.sansSite + p.libre, Math.max(0, slots - sans - avec));
        }
      }
    }
  }
});

test("parisDayKey: jour civil français, pas UTC", () => {
  // 31/07 23 h 30 UTC = déjà le 1er août à Paris (UTC+2).
  assert.equal(parisDayKey(new Date("2026-07-31T23:30:00Z")), "2026-08-01");
  assert.equal(parisDayKey(new Date("2026-07-31T09:00:00Z")), "2026-07-31");
});
