import { test } from "node:test";
import assert from "node:assert/strict";
import { parisDayKey, countEnvois, envoisParJour, kpiEnvoiFields } from "./igDmLog";

// ── Jour civil Paris ──────────────────────────────────────────────────────
// C'est la clé d'unicité d'un envoi : (prospect, étape, CE jour-là). Se tromper
// de jour, c'est autoriser un doublon à minuit ou en refuser un légitime.

test("parisDayKey : un envoi du soir reste au jour même", () => {
  // 5 août 21 h Paris (heure d'été = UTC+2) → 19 h UTC, toujours le 5.
  assert.equal(parisDayKey("2026-08-05T19:00:00.000Z"), "2026-08-05");
});

test("parisDayKey : après minuit Paris on bascule, même si UTC est encore la veille", () => {
  // 22 h 30 UTC le 5 août = 00 h 30 le 6 à Paris.
  assert.equal(parisDayKey("2026-08-05T22:30:00.000Z"), "2026-08-06");
});

test("parisDayKey : l'hiver suit le changement d'heure (UTC+1)", () => {
  // 23 h 30 UTC le 10 janvier = 00 h 30 le 11 à Paris.
  assert.equal(parisDayKey("2026-01-10T23:30:00.000Z"), "2026-01-11");
  // 23 h 30 UTC le 10 juillet = 01 h 30 le 11 à Paris (UTC+2).
  assert.equal(parisDayKey("2026-07-10T23:30:00.000Z"), "2026-07-11");
});

test("parisDayKey accepte un Date comme une chaîne ISO", () => {
  assert.equal(parisDayKey(new Date("2026-08-05T10:00:00.000Z")), "2026-08-05");
});

// ── Comptage des envois ───────────────────────────────────────────────────
// « Messages envoyés » = les ACCROCHES. Un M2-M9 est la suite d'une
// conversation déjà engagée — souvent une réponse à ce que le prospect vient
// d'écrire. Le compter comme un envoi gonfle le chiffre et écrase le taux de
// réponse, dont il est le dénominateur.

test("countEnvois sépare accroches, suites et relances", () => {
  const c = countEnvois([
    { step: "M1" }, { step: "M1" }, { step: "S1" },
    { step: "M2" }, { step: "M7" }, { step: "S3" },
    { step: "R1" }, { step: "R2" },
  ]);
  assert.equal(c.accroches, 3); // M1 ×2 + S1
  assert.equal(c.suites, 3); // M2, M7, S3
  assert.equal(c.relances, 2);
  assert.equal(c.total, 8);
});

test("une réponse dans la conversation n'est jamais comptée comme un message envoyé", () => {
  // La journée type qui a produit le bug : des accroches, plus des réponses
  // écrites à la main dans des conversations déjà ouvertes.
  const c = countEnvois([...Array(50).fill({ step: "M1" }), ...Array(25).fill({ step: "M3" })]);
  assert.equal(c.accroches, 50);
  assert.notEqual(c.accroches, 75);
  assert.equal(c.suites, 25);
});

test("countEnvois sur un journal vide ne renvoie que des zéros", () => {
  const c = countEnvois([]);
  assert.deepEqual(c, { accroches: 0, suites: 0, relances: 0, total: 0 });
});

// ── Dédoublonnage ─────────────────────────────────────────────────────────
// Le vrai défaut derrière le « 75 » : trois chemins journalisent le même
// envoi, et rien ne garantissait qu'il ne s'inscrive qu'une fois.

test("countEnvois compte les LIGNES — c'est la base qui doit être unique", () => {
  // Deux lignes M1 pour le même prospect le même jour : le compteur les voit
  // toutes les deux. La déduplication ne peut donc pas vivre ici, elle doit
  // vivre à l'écriture (contrainte d'unicité + garde côté API).
  const c = countEnvois([{ step: "M1" }, { step: "M1" }]);
  assert.equal(c.accroches, 2);
});

// ── Ventilation par jour ──────────────────────────────────────────────────

test("envoisParJour range chaque envoi dans son jour civil Paris", () => {
  const m = envoisParJour([
    { step: "M1", sent_at: "2026-08-05T08:00:00.000Z" }, // 10 h le 5
    { step: "M3", sent_at: "2026-08-05T16:00:00.000Z" }, // 18 h le 5
    { step: "R1", sent_at: "2026-08-05T22:30:00.000Z" }, // 00 h 30 le 6 à Paris
  ]);
  assert.deepEqual(m.get("2026-08-05"), { accroches: 1, suites: 1, relances: 0, total: 2 });
  assert.deepEqual(m.get("2026-08-06"), { accroches: 0, suites: 0, relances: 1, total: 1 });
});

// ── Le contrat servi au Google Sheet ──────────────────────────────────────
// L'Apps Script du Sheet de tracking lit la clé `sent`, et il vit dans Google
// Sheets : impossible de le redéployer depuis ce dépôt. C'est donc la VALEUR
// derrière `sent` qui doit être la bonne. Ces tests sont le verrou.

test("le compteur servi au Sheet (`sent`) = les accroches, jamais le total", () => {
  // La journée du 05/08/2026 telle que l'API la voyait : 49 accroches et
  // 11 suites de conversation. Le Sheet affichait 60, la page 49.
  const f = kpiEnvoiFields({ accroches: 49, suites: 11, relances: 0, total: 60 });
  assert.equal(f.sent, 49);
  assert.notEqual(f.sent, 60);
  assert.equal(f.accroches, f.sent); // le nom explicite et la clé historique s'accordent
});

test("rien n'est perdu : la suite et l'ancien total restent exposés", () => {
  const f = kpiEnvoiFields({ accroches: 49, suites: 11, relances: 3, total: 63 });
  assert.equal(f.suite, 11);
  assert.equal(f.sentAll, 60); // = l'ancienne sémantique de `sent`
  assert.equal(f.relances, 3); // les relances n'ont jamais été dans `sent`
});

test("une trame site accroche autant qu'une standard — S1 compte comme M1", () => {
  const f = kpiEnvoiFields(countEnvois([{ step: "M1" }, { step: "S1" }, { step: "S3" }]));
  assert.equal(f.sent, 2);
  assert.equal(f.suite, 1);
});

test("une journée passée à répondre sans accroche affiche 0 message envoyé", () => {
  // Le cas qui rendait le chiffre du Sheet indéfendable : 25 messages partis,
  // zéro prise de contact. « Messages envoyés » doit dire 0.
  const f = kpiEnvoiFields(countEnvois(Array(25).fill({ step: "M4" })));
  assert.equal(f.sent, 0);
  assert.equal(f.sentAll, 25);
});
