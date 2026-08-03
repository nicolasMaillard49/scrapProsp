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

test("igTrame: metierEff — profession_ia prime, puis category+bio, puis metier", () => {
  // profession_ia précise → utilisée dans l'accroche (« vous étiez <noun> »)
  const withIa = buildTrame({ ...laura, profession_ia: "prothésiste ongulaire" }, "");
  assert.match(withIa.steps[0].text, /prothésiste ongulaire/i);
});
