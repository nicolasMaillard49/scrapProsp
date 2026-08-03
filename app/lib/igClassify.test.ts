import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifySystemPrompt, parseVerdict } from "./igClassify";

test("prompt: décrit les 4 genres et impose la prudence", () => {
  const p = buildClassifySystemPrompt();
  for (const k of ["positive", "neutre", "refus", "autorepondeur"]) assert.match(p, new RegExp(k));
  assert.match(p, /réponse à froid/i);
  assert.match(p, /confidence.{0,20}basse/i);
  assert.match(p, /Ne devine jamais/i);
  // Le skill est chargé : la qualification juge avec la même méthode que
  // l'écriture, sinon « positive » ne veut pas dire la même chose des deux côtés.
  assert.match(p, /appel de 15-20 minutes/i);
});

test("parse: verdict complet", () => {
  const v = parseVerdict('{"replied":true,"cold":true,"kind":"positive","excerpt":"Salut, oui toujours","confidence":"haute","reason":"il confirme"}');
  assert.deepEqual(v, {
    replied: true,
    kind: "positive",
    cold: true,
    excerpt: "Salut, oui toujours",
    confidence: "haute",
    reason: "il confirme",
  });
});

test("parse: aucune réponse → kind null, jamais un genre inventé", () => {
  const v = parseVerdict('{"replied":false,"cold":false,"kind":"positive","excerpt":"","confidence":"haute","reason":"aucune ligne lui:"}');
  assert.equal(v?.replied, false);
  assert.equal(v?.kind, null, "pas de réponse ⇒ pas de genre, même si le modèle en propose un");
});

test("parse: genre inconnu sur une réponse annoncée → rien à conclure", () => {
  // Surtout pas de repli sur « neutre » : ça polluerait les KPI d'accroche.
  assert.equal(parseVerdict('{"replied":true,"kind":"chaud","excerpt":"ok"}'), null);
  assert.equal(parseVerdict('{"replied":true,"excerpt":"ok"}'), null);
});

test("parse: confiance absente ou farfelue → « basse » (le doute par défaut)", () => {
  const v = parseVerdict('{"replied":true,"cold":true,"kind":"neutre","excerpt":"ok","confidence":"totale"}');
  assert.equal(v?.confidence, "basse");
});

test("parse: bloc de code et bavardage autour → quand même parsé", () => {
  const v = parseVerdict('Voici :\n```json\n{"replied":true,"cold":true,"kind":"refus","excerpt":"non merci"}\n```');
  assert.equal(v?.kind, "refus");
  assert.equal(v?.excerpt, "non merci");
});

test("parse: sortie inexploitable → null, jamais un verdict par défaut", () => {
  assert.equal(parseVerdict("je ne sais pas"), null);
  assert.equal(parseVerdict(""), null);
  assert.equal(parseVerdict("{cassé"), null);
});
