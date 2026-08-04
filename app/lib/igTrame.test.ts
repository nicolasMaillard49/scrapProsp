// app/lib/igTrame.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrame, type TrameProspect } from "./igTrame";

const laura: TrameProspect = {
  id: "a1b2c3d4-0000-0000-0000-000000000000",
  username: "laura_x", full_name: "Laura Dupont",
  bio: "Institut de beauté à Angers", category: "Beauty salon",
  metier: "estheticienne", ville: "Angers", booking_platform: "Planity",
  profession_ia: null, stage: "presentation", status: "contacted",
  followers: 1240, reply_count: 1, next_followup_at: null, score_tier: "hot",
  first_reply_at: "2026-07-22T09:00:00Z", last_reply_at: "2026-07-22T09:00:00Z",
  last_dm_at: "2026-07-23T08:00:00Z",
};

test("igTrame: prospect connu → 12 étapes personnalisées + nextStep depuis le stade", () => {
  const t = buildTrame(laura, "https://prospects.nmf-agence.com");
  assert.equal(t.prospect?.username, "laura_x");
  assert.equal(t.steps.length, 12); // M1..M9 + R1..R3
  assert.equal(t.nextStep, "M5"); // presentation → M5 (nextStepFor)
  // Personnalisation réelle : le prénom apparaît dans l'accroche.
  const m1 = t.steps.find((s) => s.step === "M1")!;
  assert.match(m1.text, /Laura/);
  // Le lien de démo (M9 questionnaire n'en a pas ; il passe par le param
  // demoLink de la séquence) est construit sur /di/ + les 8 premiers chars.
  // On vérifie au moins qu'aucune étape ne contient "undefined".
  for (const s of t.steps) assert.ok(!s.text.includes("undefined"), s.step);
});

test("igTrame: sequence close (call_booke / perdu / questionnaire) → nextStep null", () => {
  assert.equal(buildTrame({ ...laura, stage: "call_booke" }, "").nextStep, null);
  assert.equal(buildTrame({ ...laura, stage: "perdu" }, "").nextStep, null);
  assert.equal(buildTrame({ ...laura, stage: "questionnaire_envoye" }, "").nextStep, null);
});

test("igTrame: prospect inconnu → trame générique, nextStep M1, prospect null", () => {
  const t = buildTrame(null, "https://x.test");
  assert.equal(t.prospect, null);
  assert.equal(t.steps.length, 12);
  assert.equal(t.nextStep, "M1");
  const m1 = t.steps.find((s) => s.step === "M1")!;
  assert.ok(m1.text.length > 10);
});

test("igTrame site: 8 étapes (S1-S5 + relances) et la maquette EST dans S3", () => {
  const t = buildTrame(laura, "https://prospects.nmf-agence.com", "site");
  assert.equal(t.trame, "site");
  assert.deepEqual(t.steps.map((s) => s.step), ["S1", "S2", "S3", "S4", "S5", "R1", "R2", "R3"]);
  // Le lien d'aperçu est bâti sur les 8 premiers caractères de l'UUID.
  assert.equal(t.demoLink, "https://prospects.nmf-agence.com/di/a1b2c3d4");
  const s3 = t.steps.find((s) => s.step === "S3")!;
  assert.ok(s3.text.includes(t.demoLink), "S3 doit porter l'aperçu");
  for (const s of t.steps) assert.ok(!s.text.includes("undefined"), s.step);
});

test("igTrame site: la question nomme le métier ET la ville, comme un client les taperait", () => {
  const s2 = buildTrame(laura, "", "site").steps.find((s) => s.step === "S2")!;
  assert.match(s2.text, /« esthéticienne Angers »/);
  // Sans métier ni ville, la question tient debout seule — jamais de « «  » ».
  const nu = buildTrame({ ...laura, metier: "", profession_ia: null, category: null, bio: null, ville: null }, "", "site")
    .steps.find((s) => s.step === "S2")!;
  assert.doesNotMatch(nu.text, /«/);
  assert.match(nu.text, /cherche votre nom sur Google/);
});

test("igTrame site: le stade décide de l'étape, dans la trame servie", () => {
  // `presentation` = S2 envoyé → la maquette est la suite.
  assert.equal(buildTrame(laura, "", "site").nextStep, "S3");
  assert.equal(buildTrame({ ...laura, stage: "douleur" }, "", "site").nextStep, "S4");
  assert.equal(buildTrame({ ...laura, stage: "appel_propose" }, "", "site").nextStep, "S5");
  assert.equal(buildTrame({ ...laura, stage: "questionnaire_envoye" }, "", "site").nextStep, null);
  // Même stade, autre trame : autre étape. Les deux partitions coexistent.
  assert.equal(buildTrame(laura, "", "standard").nextStep, "M5");
});

test("igTrame site: prospect hors base → S1, et S3 ne montre AUCUN lien mort", () => {
  const t = buildTrame(null, "https://x.test", "site");
  assert.equal(t.nextStep, "S1");
  assert.equal(t.demoLink, "");
  const s3 = t.steps.find((s) => s.step === "S3")!;
  assert.doesNotMatch(s3.text, /https?:\/\//);
});

test("igTrame: metierEff — profession_ia prime, puis category+bio, puis metier", () => {
  // profession_ia précise → utilisée dans l'accroche (« vous étiez <noun> »)
  const withIa = buildTrame({ ...laura, profession_ia: "prothésiste ongulaire" }, "");
  assert.match(withIa.steps[0].text, /prothésiste ongulaire/i);
});
