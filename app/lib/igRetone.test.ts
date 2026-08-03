import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TONES,
  MAX_RETONE,
  buildRetoneSystem,
  buildRetoneUser,
  parseVariants,
} from "./igRetone";

const ctx = (over: Partial<Parameters<typeof buildRetoneSystem>[0]> = {}) => ({
  prospect: {
    username: "salon.lea",
    firstName: "Léa",
    metier: "coiffeuse",
    ville: "Brive",
    stage: "accroche",
  },
  text: "Vous seriez dispo cette semaine ?",
  ...over,
});

// ── Le prompt ──────────────────────────────────────────────────────────────

test("prompt: réécrit la phrase de Nicolas, n'y ajoute aucune information", () => {
  const p = buildRetoneSystem(ctx());
  assert.match(p, /n'ajoute aucune information/i);
  assert.match(p, /seul le ton/i);
});

test("prompt: les trois tons y sont définis, cash compris", () => {
  const p = buildRetoneSystem(ctx());
  for (const t of TONES) assert.match(p, new RegExp(t.id, "i"));
  // Le curseur du ton cash : piquer sans mépriser.
  assert.match(p, /jamais insulter/i);
  assert.match(p, /concurrent/i);
});

test("prompt: les règles absolues tiennent aussi en ton cash", () => {
  const p = buildRetoneSystem(ctx());
  assert.match(p, /aucun lien/i);
  assert.match(p, /aucun prix/i);
  assert.match(p, /aucune signature/i);
  assert.match(p, /1 à 3 phrases/i);
});

test("prompt: le tutoiement/vouvoiement de la phrase d'origine est conservé", () => {
  const p = buildRetoneSystem(ctx());
  assert.match(p, /tutoiement/i);
  assert.match(p, /d'origine/i);
});

test("prompt: le prospect connu est décrit ; inconnu, interdiction d'inventer", () => {
  const known = buildRetoneSystem(ctx());
  assert.match(known, /coiffeuse/);
  assert.match(known, /Brive/);

  const unknown = buildRetoneSystem(ctx({ prospect: null }));
  assert.match(unknown, /n'invente aucun détail/i);
  assert.doesNotMatch(unknown, /coiffeuse/);
});

test("prompt: impose le JSON des variantes, sans texte autour", () => {
  const p = buildRetoneSystem(ctx());
  assert.match(p, /"variants"/);
  assert.match(p, /UNIQUEMENT/);
});

// ── Le message utilisateur ─────────────────────────────────────────────────

test("user: la phrase à reformuler y est, désignée sans ambiguïté", () => {
  const u = buildRetoneUser(ctx());
  assert.match(u, /Vous seriez dispo cette semaine \?/);
  assert.match(u, /à reformuler/i);
});

test("user: le fil n'apparaît que s'il est fourni", () => {
  assert.doesNotMatch(buildRetoneUser(ctx()), /Fil de la conversation/i);
  const withFil = buildRetoneUser(ctx({ history: "lui: c'est combien ?\nmoi: on en parle ?" }));
  assert.match(withFil, /Fil de la conversation/i);
  assert.match(withFil, /c'est combien/);
});

test("user: phrase et fil sont plafonnés — garde-fou de coût, pas de refus", () => {
  const long = "a".repeat(MAX_RETONE + 500);
  const u = buildRetoneUser(ctx({ text: long, history: "b".repeat(9000) }));
  assert.ok(!u.includes("a".repeat(MAX_RETONE + 1)), "la phrase doit être tronquée");
  assert.ok(!u.includes("b".repeat(4001)), "le fil doit être tronqué");
});

// ── Le parsing ─────────────────────────────────────────────────────────────

const texts = (v: ReturnType<typeof parseVariants>) => v.map((x) => x.text);
const tones = (v: ReturnType<typeof parseVariants>) => v.map((x) => x.tone);

test("parse: JSON propre → trois variantes, dans l'ordre des tons", () => {
  const raw = JSON.stringify({
    variants: [
      { tone: "cash", text: "C" },
      { tone: "calme", text: "A" },
      { tone: "neutre", text: "B" },
    ],
  });
  const v = parseVariants(raw);
  assert.deepEqual(tones(v), ["calme", "neutre", "cash"]);
  assert.deepEqual(texts(v), ["A", "B", "C"]);
});

test("parse: chaque variante porte le libellé affichable de son ton", () => {
  const v = parseVariants(JSON.stringify({ variants: [{ tone: "cash", text: "C" }] }));
  assert.equal(v[0].label, "Cash");
});

test("parse: bloc de code et bavardage autour → parsé quand même", () => {
  const raw = 'Voici :\n```json\n{"variants":[{"tone":"calme","text":"A"}]}\n```';
  assert.deepEqual(texts(parseVariants(raw)), ["A"]);
});

test("parse: réponse tronquée → les variantes complètes survivent", () => {
  // Plafond de tokens atteint : l'objet extérieur n'est jamais refermé.
  const raw = '{"variants":[{"tone":"calme","text":"A"},{"tone":"neutre","text":"B"},{"tone":"cash","te';
  const v = parseVariants(raw);
  assert.deepEqual(texts(v), ["A", "B"]);
});

test("parse: ton absent ou inconnu → appariement par position", () => {
  const raw = JSON.stringify({ variants: [{ text: "A" }, { tone: "wtf", text: "B" }, { text: "C" }] });
  const v = parseVariants(raw);
  assert.deepEqual(tones(v), ["calme", "neutre", "cash"]);
  assert.deepEqual(texts(v), ["A", "B", "C"]);
});

test("parse: ton en double → aucune variante perdue, aucun ton en double", () => {
  const raw = JSON.stringify({
    variants: [
      { tone: "calme", text: "A" },
      { tone: "calme", text: "B" },
      { tone: "cash", text: "C" },
    ],
  });
  // Le premier « calme » garde son ton ; le second retombe sur le slot libre.
  const v = parseVariants(raw);
  assert.deepEqual(tones(v), ["calme", "neutre", "cash"]);
  assert.deepEqual(texts(v), ["A", "B", "C"]);
});

test("parse: variante au texte vide → écartée, sans décaler les autres", () => {
  const raw = JSON.stringify({
    variants: [
      { tone: "calme", text: "  " },
      { tone: "neutre", text: "B" },
    ],
  });
  const v = parseVariants(raw);
  assert.deepEqual(tones(v), ["neutre"]);
  assert.deepEqual(texts(v), ["B"]);
});

test("parse: jamais plus de variantes que de tons", () => {
  const raw = JSON.stringify({
    variants: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }],
  });
  assert.equal(parseVariants(raw).length, TONES.length);
});

test("parse: rien d'exploitable → tableau vide, jamais de JSON brut", () => {
  // Contrairement à une suggestion de réponse, un fragment collé dans le champ
  // Instagram serait nuisible : mieux vaut ne rien proposer.
  assert.deepEqual(parseVariants(""), []);
  assert.deepEqual(parseVariants("Je ne peux pas répondre à cette demande."), []);
  assert.deepEqual(parseVariants('{"variants":[]}'), []);
});
