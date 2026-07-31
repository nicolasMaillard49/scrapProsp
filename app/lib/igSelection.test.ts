import test from "node:test";
import assert from "node:assert/strict";
import { daySlots, countRealFollowups, isSelectable, roundRobinByMetier, metierOf, parisDayKey, MAX_FOLLOWERS } from "./igSelection";

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

test("metierOf: la profession IA prime sur la catégorie puis sur le métier stocké", () => {
  assert.equal(metierOf({ id: "1", username: "u", profession_ia: "Plombier chauffagiste" }), "plombier");
  assert.equal(metierOf({ id: "1", username: "u", category: "Hair Salon", metier: "plombier" }), "coiffeur");
  assert.equal(metierOf({ id: "1", username: "u", metier: "macon" }), "macon");
  assert.equal(metierOf({ id: "1", username: "u" }), "");
});

test("parisDayKey: jour civil français, pas UTC", () => {
  // 31/07 23 h 30 UTC = déjà le 1er août à Paris (UTC+2).
  assert.equal(parisDayKey(new Date("2026-07-31T23:30:00Z")), "2026-08-01");
  assert.equal(parisDayKey(new Date("2026-07-31T09:00:00Z")), "2026-07-31");
});
