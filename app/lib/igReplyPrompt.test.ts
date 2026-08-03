import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReplySystemPrompt,
  buildReplyUserMessage,
  parseSuggestions,
  MAX_INCOMING,
  type ReplyContext,
} from "./igReplyPrompt";

const STEPS = [
  { step: "M1", title: "Accroche", text: "Hello ! Vous êtes toujours menuisier ?" },
  { step: "M5", title: "Connexion", text: "Avant ça, vous faites ce métier depuis longtemps ?" },
  { step: "M9", title: "Questionnaire", text: "Un petit questionnaire 👉 https://exemple/q" },
];

const ctx = (over: Partial<ReplyContext> = {}): ReplyContext => ({
  prospect: { username: "laura_x", firstName: "Laura", metier: "menuisier", ville: "Angers", stage: "presentation" },
  steps: STEPS,
  nextStep: "M5",
  incoming: "C'est quoi votre tarif ?",
  ...over,
});

test("prompt: porte le contexte prospect et désigne l'étape cible", () => {
  const p = buildReplySystemPrompt(ctx());
  assert.match(p, /@laura_x/);
  assert.match(p, /menuisier/);
  assert.match(p, /Angers/);
  assert.match(p, /presentation/);
  // L'étape visée doit être nommée pour que le modèle sache où ramener.
  assert.match(p, /M5/);
  assert.match(p, /Connexion/);
});

test("prompt: interdit explicitement signature, coordonnées, lien avant M9 et prix", () => {
  const p = buildReplySystemPrompt(ctx());
  // Ces interdits sont la raison d'être du garde-fou : ils doivent être écrits.
  assert.match(p, /Aucune signature/i);
  assert.match(p, /coordonnée/i);
  assert.match(p, /Aucun lien tant que l'étape M9/i);
  assert.match(p, /Aucun prix/i);
});

test("prompt: prospect inconnu → interdiction d'inventer, pas de fausse identité", () => {
  const p = buildReplySystemPrompt(ctx({ prospect: null }));
  assert.match(p, /Prospect inconnu/i);
  assert.match(p, /n'invente aucun détail/i);
  assert.doesNotMatch(p, /@laura_x/);
});

test("prompt: séquence close → on ne relance pas de trame", () => {
  const p = buildReplySystemPrompt(ctx({ nextStep: null }));
  assert.match(p, /plus d'étape à proposer/i);
});

test("message utilisateur: tronque l'entrant et garde le fil quand il existe", () => {
  const long = "a".repeat(MAX_INCOMING + 500);
  const m = buildReplyUserMessage(ctx({ incoming: long, history: "lui: salut\nmoi: hello" }));
  assert.ok(m.includes("Fil de la conversation"));
  assert.ok(m.includes("lui: salut"));
  // Tronqué au plafond : le reste du prompt ne peut pas être noyé.
  assert.ok(m.length < MAX_INCOMING + 300);
});

test("parse: JSON propre → suggestions ordonnées", () => {
  const out = parseSuggestions('{"suggestions":[{"label":"Cash","text":"Ça dépend, on en parle ?"},{"label":"Question","text":"Vous cherchez quoi exactement ?"}]}');
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { label: "Cash", text: "Ça dépend, on en parle ?" });
});

test("parse: bloc de code et bavardage autour du JSON → quand même parsé", () => {
  const raw = 'Voici mes propositions :\n```json\n{"suggestions":[{"label":"A","text":"Salut"}]}\n```\nDis-moi !';
  const out = parseSuggestions(raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Salut");
});

test("parse: entrées vides ignorées, label manquant remplacé", () => {
  const out = parseSuggestions('{"suggestions":[{"text":"   "},{"text":"OK"},{"label":"","text":"Deux"}]}');
  assert.equal(out.length, 2);
  assert.equal(out[0], out[0]); // structure
  assert.equal(out[0].label, "Proposition");
  assert.equal(out[0].text, "OK");
});

test("parse: réponse TRONQUÉE → les propositions complètes sont récupérées", () => {
  // Cas réel : max_tokens atteint, le tableau n'est jamais refermé. Le
  // panneau affichait le JSON brut (ou « rien proposé ») alors que deux
  // propositions parfaitement utilisables étaient déjà là.
  const tronque =
    '{"suggestions":[{"label":"recadrer","text":"On se cale 15-20 min ?"},' +
    '{"label":"franc","text":"Je préfère vous répondre de vive voix."},' +
    '{"label":"coupé","text":"début de phrase san';
  const out = parseSuggestions(tronque);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, "On se cale 15-20 min ?");
  assert.equal(out[1].label, "franc");
});

test("parse: JSON invalide → repli sur le texte brut, jamais une liste vide silencieuse", () => {
  const out = parseSuggestions("pas du json du tout");
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "pas du json du tout");
  // Réponse totalement vide : rien à proposer, et c'est explicite.
  assert.deepEqual(parseSuggestions("   "), []);
});

test("parse: au plus 4 propositions — le panneau ne se transforme pas en mur", () => {
  const many = { suggestions: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, text: `T${i}` })) };
  assert.equal(parseSuggestions(JSON.stringify(many)).length, 4);
});
