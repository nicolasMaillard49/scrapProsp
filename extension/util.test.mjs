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
