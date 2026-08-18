import { test } from "node:test";
import assert from "node:assert/strict";
import NMFUtil from "./util.js";

test("dedupeKey: cle par (prospect, step, jour Paris)", () => {
  const d = new Date("2026-08-03T10:00:00+02:00");
  assert.equal(NMFUtil.dedupeKey("abc", "M5", d), "sent:abc:M5:2026-08-03");
  // 01h Paris = 23h UTC la veille : cas réellement divergent Paris/UTC
  // (discrimine une implémentation naïve type toISOString().slice(0,10)).
  const nuit = new Date("2026-08-04T01:00:00+02:00"); // 23:00 UTC le 03/08
  assert.equal(NMFUtil.dedupeKey("abc", "M5", nuit), "sent:abc:M5:2026-08-04");
});

test("shouldLog: une double detection ne journalise qu'une fois", () => {
  const keys = [];
  const k = NMFUtil.dedupeKey("abc", "M5", new Date());
  assert.equal(NMFUtil.shouldLog(keys, k), true);
  keys.push(k);
  assert.equal(NMFUtil.shouldLog(keys, k), false);
});

test("shouldAdvanceAssist: avance seulement après une accroche réellement journalisée", () => {
  assert.equal(typeof NMFUtil.shouldAdvanceAssist, "function");
  assert.equal(NMFUtil.shouldAdvanceAssist(true, "M1", { ok: true }), true);
  assert.equal(NMFUtil.shouldAdvanceAssist(true, "S1", { ok: true }), true);
  assert.equal(NMFUtil.shouldAdvanceAssist(false, "M1", { ok: true }), false);
  assert.equal(NMFUtil.shouldAdvanceAssist(true, "M2", { ok: true }), false);
  assert.equal(NMFUtil.shouldAdvanceAssist(true, "M1", { ok: false }), false);
  assert.equal(NMFUtil.shouldAdvanceAssist(true, "M1", { ok: true, deduped: true }), false);
});

test("pickAccountId: un seul compte declare = pas de choix a faire", () => {
  const one = [{ id: "a1", username: "nmfagence" }];
  assert.equal(NMFUtil.pickAccountId(one, "nmfagence"), "a1");
  // Meme si la detection du compte connecte echoue ou ne correspond pas :
  // avec un seul emetteur possible il n'y a rien a deviner.
  assert.equal(NMFUtil.pickAccountId(one, null), "a1");
  assert.equal(NMFUtil.pickAccountId(one, "autre_compte"), "a1");
});

test("pickAccountId: plusieurs comptes = appariement strict, sinon aucun", () => {
  const many = [
    { id: "a1", username: "nmfagence" },
    { id: "a2", username: "nmf.pro" },
  ];
  assert.equal(NMFUtil.pickAccountId(many, "nmf.pro"), "a2");
  // Pseudo inconnu ou non detecte : surtout pas de choix par defaut,
  // sinon un DM part au credit du mauvais compte de chauffe.
  assert.equal(NMFUtil.pickAccountId(many, "inconnu"), null);
  assert.equal(NMFUtil.pickAccountId(many, null), null);
});

test("pickAccountId: aucune liste exploitable = null, jamais une exception", () => {
  assert.equal(NMFUtil.pickAccountId([], "nmfagence"), null);
  assert.equal(NMFUtil.pickAccountId(undefined, "nmfagence"), null);
  assert.equal(NMFUtil.pickAccountId(null, null), null);
});

test("formatThread: une ligne par message, prefixee par son auteur", () => {
  const rows = [
    { from: "moi", text: "Hello ! Vous etes toujours menuisier ?" },
    { from: "lui", text: "Oui toujours" },
    { from: "?", text: "ligne ambigue" },
  ];
  assert.equal(
    NMFUtil.formatThread(rows),
    "moi: Hello ! Vous etes toujours menuisier ?\nlui: Oui toujours\n?: ligne ambigue",
  );
});

test("formatThread: une ligne ambigue qui EST un message de la trame vient de Nicolas", () => {
  const trame = ["Parfait ! Votre post est remonte dans mon feed."];
  const rows = [{ from: "?", text: "Parfait !  Votre post est remonte  dans mon feed." }];
  // Comparaison normalisee (espaces, casse) : la trame leve l'ambiguite.
  assert.equal(NMFUtil.formatThread(rows, trame), "moi: Parfait ! Votre post est remonte dans mon feed.");
});

test("formatThread: entrees vides ignorees, liste absente = chaine vide", () => {
  assert.equal(NMFUtil.formatThread([{ from: "lui", text: "   " }, null]), "");
  assert.equal(NMFUtil.formatThread(undefined), "");
});

test("splitThread: le dernier « lui: » est le message auquel on repond", () => {
  const txt = "moi: Hello\nlui: Oui toujours\nmoi: Parfait !\nlui: c'est quoi votre tarif ?";
  const { incoming, history } = NMFUtil.splitThread(txt);
  assert.equal(incoming, "c'est quoi votre tarif ?");
  assert.equal(history, txt, "le fil complet part en contexte");
});

test("splitThread: message multiligne — les lignes suivantes restent collees a leur auteur", () => {
  const txt = "lui: bonjour\net sinon vous faites quoi exactement ?\nmoi: je vous explique";
  assert.equal(NMFUtil.splitThread(txt).incoming, "bonjour\net sinon vous faites quoi exactement ?");
});

test("splitThread: texte colle sans prefixe = le message du prospect, sans fil", () => {
  const { incoming, history } = NMFUtil.splitThread("  c'est combien ?  ");
  assert.equal(incoming, "c'est combien ?");
  assert.equal(history, "");
});

test("splitThread: aucun « lui: » (que des messages sortants) → repli sur le texte entier", () => {
  const { incoming } = NMFUtil.splitThread("moi: Hello\nmoi: toujours la ?");
  assert.equal(incoming, "moi: Hello\nmoi: toujours la ?");
  assert.deepEqual(NMFUtil.splitThread("   "), { incoming: "", history: "" });
});

const STEPS = [
  { step: "M1", text: "Hello Thomas ! J'ai vu que vous etiez osteopathe, c'est toujours le cas ?" },
  { step: "M2", text: "Parfait ! Votre post est remonte dans mon feed, j'ai jete un oeil au profil et deux-trois trucs m'ont interpelle." },
  { step: "M5", text: "Avant ca, vous faites ce metier depuis longtemps ?" },
  { step: "M8", text: "Ok. Le plus simple c'est qu'on se cale 15-20 min et je vous montre ce que j'ai vu. Vous avez un creneau cette semaine ?" },
];

test("matchStep: reconnait une etape envoyee telle quelle", () => {
  assert.equal(NMFUtil.matchStep(STEPS[1].text, STEPS).step, "M2");
  assert.equal(NMFUtil.matchStep(STEPS[3].text, STEPS).step, "M8");
});

test("matchStep: tolere les retouches de Nicolas avant envoi", () => {
  // Cas reel : il personnalise et rallonge presque toujours le message.
  const retouche = "Parfait Thomas ! Votre post est remonte dans mon feed hier soir, j'ai jete un oeil au profil et deux-trois trucs m'ont interpelle du coup.";
  assert.equal(NMFUtil.matchStep(retouche, STEPS).step, "M2");
});

test("matchStep: un message HORS trame n'est jamais rattache a une etape", () => {
  // Journaliser la mauvaise etape fausse le stade ET la relance ; ne rien
  // journaliser reste rattrapable a la main.
  assert.equal(NMFUtil.matchStep("Bien sur, la maintenance couvre l'hebergement et les certificats SSL.", STEPS), null);
  assert.equal(NMFUtil.matchStep("ok merci", STEPS), null);
  assert.equal(NMFUtil.matchStep("", STEPS), null);
  assert.equal(NMFUtil.matchStep("Hello", []), null);
});

test("matchStep: deux etapes indiscernables → aucune conclusion", () => {
  // Memes mots, tournure differente : rien ne permet de trancher, donc on ne
  // tranche pas. Le stade reste juste plutot que probable.
  const jumelles = [
    { step: "A", text: "Vous avez un creneau cette semaine ?" },
    { step: "B", text: "Un creneau cette semaine, vous avez ?" },
  ];
  assert.equal(NMFUtil.matchStep("Vous avez un creneau cette semaine ?", jumelles), null);
});

test("similarity: recouvrement, pas egalite stricte", () => {
  assert.equal(NMFUtil.similarity("aucun rapport ici", "totalement different ailleurs"), 0);
  assert.ok(NMFUtil.similarity("le chat noir dort", "le chat noir dort") === 1);
  // Ajout de mots par Nicolas : le recouvrement de la trame reste total.
  assert.equal(NMFUtil.similarity("le chat noir dort tranquillement chez lui", "le chat noir dort"), 1);
});

test("prune: garde les plus recents, borne la taille", () => {
  const keys = Array.from({ length: 250 }, (_, i) => `k${i}`);
  const pruned = NMFUtil.prune(keys, 200);
  assert.equal(pruned.length, 200);
  assert.equal(pruned[0], "k50");
  assert.equal(pruned[199], "k249");
});

test("incomingReply: le prospect a parle en dernier", () => {
  const rows = [
    { from: "moi", text: "Salut, joli travail sur vos rendus" },
    { from: "lui", text: "Merci !" },
    { from: "lui", text: "Vous faites quoi exactement ?" },
  ];
  const hit = NMFUtil.incomingReply(rows);
  assert.equal(hit.lines, 2);
  assert.equal(hit.text, "Merci ! Vous faites quoi exactement ?");
  assert.equal(hit.last, true); // il attend une reponse
});

test("incomingReply: Nicolas a repondu dans la foulee → la reponse compte quand meme", () => {
  // Cas MAJORITAIRE releve sur la vraie boite : 14 conversations sur 15
  // commencaient par « Vous : ». Ne regarder que le dernier locuteur revenait
  // a ne capter presque aucune reponse.
  const rows = [
    { from: "moi", text: "Salut" },
    { from: "lui", text: "Bonjour, oui c'est bien moi" },
    { from: "moi", text: "Vous gerez le site vous-meme ?" },
  ];
  const hit = NMFUtil.incomingReply(rows);
  assert.equal(hit.text, "Bonjour, oui c'est bien moi");
  assert.equal(hit.last, false); // deja traitee : le background exigera reply_count === 0
});

test("incomingReply: derniere ligne d'auteur indetermine → aucune conclusion", () => {
  // Journaliser un de NOS messages comme reponse du prospect le sortirait de
  // la file de relance et gonflerait le taux de reponse.
  const rows = [
    { from: "moi", text: "Salut" },
    { from: "?", text: "texte non attribue" },
  ];
  assert.equal(NMFUtil.incomingReply(rows), null);
});

test("incomingReply: le `?` reconnu comme un message de la trame est a nous", () => {
  const steps = ["Vous gerez le site vous-meme ?"];
  const rows = [
    { from: "moi", text: "Salut" },
    { from: "lui", text: "Bonjour" },
    { from: "?", text: "Vous gerez le site vous-meme ?" },
  ];
  const hit = NMFUtil.incomingReply(rows, steps);
  assert.equal(hit.text, "Bonjour");
  assert.equal(hit.last, false); // la ligne `?` est de nous : il n'attend plus
});

test("incomingReply: un `?` APRES son message → aucune conclusion", () => {
  // Cette ligne peut etre de lui : la donner pour traitee, ou l'ignorer, se
  // decide sur `last`. Sans certitude, on ne journalise rien.
  const rows = [
    { from: "moi", text: "Salut" },
    { from: "lui", text: "Bonjour" },
    { from: "?", text: "texte non attribue" },
  ];
  assert.equal(NMFUtil.incomingReply(rows), null);
});

test("incomingReply: sans message de nous, ce n'est pas une reponse", () => {
  const rows = [{ from: "lui", text: "Bonjour, vous faites des sites ?" }];
  assert.equal(NMFUtil.incomingReply(rows), null);
});

test("incomingKey: meme message = meme cle, insensible a la casse et aux espaces", () => {
  assert.equal(
    NMFUtil.incomingKey("Atelier", "Merci  !\nVous faites QUOI ?"),
    NMFUtil.incomingKey("atelier", "merci ! vous faites quoi ?"),
  );
  assert.notEqual(NMFUtil.incomingKey("a", "oui"), NMFUtil.incomingKey("a", "non"));
});

test("parseLinks: libelle optionnel, une ligne par lien", () => {
  const out = NMFUtil.parseLinks(`
    Audit gratuit | https://rdv.nmf-agence.com/nicolas/reunion-nicolas-maillard
    https://nmf-agence.com
    # une note, pas un lien
  `);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    label: "Audit gratuit",
    url: "https://rdv.nmf-agence.com/nicolas/reunion-nicolas-maillard",
  });
  assert.equal(out[1].label, "nmf-agence.com"); // sans libelle, l'URL se nomme elle-meme
});

test("parseLinks: une ligne sans URL valide est ecartee, pas gardee a moitie", () => {
  // Un lien tronque ne se voit qu'une fois colle dans un DM parti.
  assert.deepEqual(NMFUtil.parseLinks("Portfolio | nmf-agence.com"), []);
  assert.deepEqual(NMFUtil.parseLinks("Portfolio | http://nmf-agence.com"), []);
  assert.deepEqual(NMFUtil.parseLinks("Portfolio |"), []);
  assert.deepEqual(NMFUtil.parseLinks(""), []);
});

test("serializeLinks: aller-retour sans perte", () => {
  const text = NMFUtil.serializeLinks(NMFUtil.DEFAULT_LINKS);
  assert.deepEqual(NMFUtil.parseLinks(text), NMFUtil.DEFAULT_LINKS);
});

test("DEFAULT_LINKS: tous en https, libelles renseignes", () => {
  for (const l of NMFUtil.DEFAULT_LINKS) {
    assert.match(l.url, /^https:\/\/\S+$/);
    assert.ok(l.label.length > 0);
  }
});

test("sinceLabel: jamais de futur, jamais « il y a 0 j »", () => {
  const now = new Date("2026-08-03T18:00:00+02:00");
  const at = (min) => new Date(now.getTime() - min * 60000).toISOString();
  assert.equal(NMFUtil.sinceLabel(at(0), now), "à l'instant");
  assert.equal(NMFUtil.sinceLabel(at(1), now), "à l'instant");
  assert.equal(NMFUtil.sinceLabel(at(20), now), "il y a 20 min");
  assert.equal(NMFUtil.sinceLabel(at(60), now), "il y a 1 h");
  assert.equal(NMFUtil.sinceLabel(at(60 * 26), now), "il y a 1 j");
  assert.equal(NMFUtil.sinceLabel(at(60 * 24 * 9), now), "il y a 1 sem");
  assert.equal(NMFUtil.sinceLabel(at(60 * 24 * 70), now), "il y a 2 mois");
  // Horloge decalee : afficher « dans 3 min » ferait douter de toute la ligne.
  assert.equal(NMFUtil.sinceLabel(at(-3), now), "à l'instant");
  assert.equal(NMFUtil.sinceLabel(null, now), null);
  assert.equal(NMFUtil.sinceLabel("pas une date", now), null);
});

test("replyState: distingue la conversation en cours de la reponse a venir", () => {
  const now = new Date("2026-08-03T18:00:00+02:00");
  const engage = NMFUtil.replyState(
    { reply_count: 3, last_reply_at: "2026-08-01T18:00:00+02:00", last_dm_at: "2026-08-02T10:00:00+02:00" },
    now,
  );
  assert.equal(engage.tone, "engage");
  assert.match(engage.text, /^A répondu · il y a 2 j$/);
  assert.match(engage.detail, /3 réponses/);

  const attente = NMFUtil.replyState({ reply_count: 0, last_dm_at: "2026-08-03T09:00:00+02:00" }, now);
  assert.equal(attente.tone, "attente");
  assert.match(attente.text, /Jamais répondu · accroche il y a 9 h/);
  assert.match(attente.detail, /réponse à froid/);

  assert.equal(NMFUtil.replyState({ reply_count: 0, last_dm_at: null }, now).tone, "vierge");
  assert.equal(NMFUtil.replyState(null, now), null);
});

// ── Métronome de chauffe ─────────────────────────────────────────────────────

test("paceState: rien envoyé → aucune attente", () => {
  const s = NMFUtil.paceState([], Date.parse("2026-08-04T10:00:00Z"));
  assert.deepEqual({ wait: s.wait, burst: s.burst }, { wait: 0, burst: 0 });
});

test("paceState: deux envois collés → il reste des secondes à attendre", () => {
  const t0 = Date.parse("2026-08-04T10:00:00Z");
  let stamps = NMFUtil.pushSend([], t0);
  // 10 s plus tard : on est très en dessous des 45 s.
  const s = NMFUtil.paceState(stamps, t0 + 10_000);
  assert.equal(s.wait, 35);
  assert.equal(s.burst, 1);
  // 45 s plus tard : la voie est libre, au tick près.
  assert.equal(NMFUtil.paceState(stamps, t0 + 45_000).wait, 0);
  assert.equal(NMFUtil.paceState(stamps, t0 + 90_000).wait, 0);
});

test("paceState: la rafale compte la DERNIÈRE minute, pas toute la session", () => {
  const t0 = Date.parse("2026-08-04T10:00:00Z");
  let stamps = [];
  for (let i = 0; i < 6; i++) stamps = NMFUtil.pushSend(stamps, t0 + i * 8_000); // 6 en 40 s
  assert.equal(NMFUtil.paceState(stamps, t0 + 40_000).burst, 6);
  // Deux minutes plus tard, la rafale est retombée — le frein doit lâcher.
  const calme = NMFUtil.paceState(stamps, t0 + 160_000);
  assert.equal(calme.burst, 0);
  assert.equal(calme.wait, 0);
});

test("pushSend: l'historique reste borné et ordonné", () => {
  const t0 = Date.parse("2026-08-04T10:00:00Z");
  let stamps = [];
  for (let i = 0; i < 40; i++) stamps = NMFUtil.pushSend(stamps, t0 + i * 60_000);
  assert.ok(stamps.length <= 12, `borné, ${stamps.length} gardés`);
  assert.equal(stamps[stamps.length - 1], t0 + 39 * 60_000); // le plus récent survit
});

test("paceState: une horloge qui recule ne fabrique pas une attente absurde", () => {
  const t0 = Date.parse("2026-08-04T10:00:00Z");
  // Horodatage dans le futur (changement d'heure, machine resynchronisée) :
  // il est ignoré plutôt que de bloquer l'insertion pendant des heures.
  const s = NMFUtil.paceState([t0 + 3600_000], t0);
  assert.equal(s.wait, 0);
});

// ── Repli sur l'étape attendue quand le message est écrit à la main ──────────
// Le 05/08 : 584 accroches journalisées pour 38 suites, alors que 56 prospects
// avaient répondu. Cause — `matchStep` ne reconnaît qu'un message copié de la
// trame, et une réponse à « c'est à dire ? » ne ressemble à rien du script.

test("estMessageLibre: une vraie reponse ecrite a la main compte", () => {
  assert.equal(
    NMFUtil.estMessageLibre(
      "Je vous ai fait un aperçu de site, je peux vous l'envoyer si vous voulez jeter un œil",
    ),
    true,
  );
  assert.equal(
    NMFUtil.estMessageLibre("Oui bien sûr, je vous explique : je crée des sites pour les artisans"),
    true,
  );
});

test("estMessageLibre: un acquittement n'est pas une etape de trame", () => {
  for (const t of ["ok", "Merci !", "👍", "👍👍👍", "Parfait, merci beaucoup !!", "Super, bonne journée !", ""]) {
    assert.equal(NMFUtil.estMessageLibre(t), false, `"${t}" ne doit pas etre journalise`);
  }
});

test("estMessageLibre: un mur d'emojis ne compte pas malgre sa longueur", () => {
  assert.equal(NMFUtil.estMessageLibre("🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏"), false);
});

test("estMessageLibre: un message de trame reste reconnu par matchStep d'abord", () => {
  // Le repli ne doit jamais court-circuiter matchStep : on verifie que le texte
  // d'une etape est bien apparie, donc que `libre` ne sera pas consulte.
  assert.equal(NMFUtil.matchStep(STEPS[1].text, STEPS).step, "M2");
});
