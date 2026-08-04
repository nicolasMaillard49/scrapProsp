import { test } from "node:test";
import assert from "node:assert/strict";
import {
  warmupCaps, clampToWindow, nextFollowup, stageForStep, nextStepFor, STAGES, VALID_STEPS, MAX_DAILY,
  isAccrocheStep, ACCROCHE_STEPS, trameOfStep,
} from "./igPipeline";

const day = (n: number, base = Date.parse("2026-07-01T12:00:00")) => base + (n - 1) * 24 * 3600 * 1000;

test("warmupCaps: chauffe J1 5/j, J2 10/j, J3 15/j puis +5/jour, jamais > 50/j (limite par jour, pas par heure)", () => {
  const start = "2026-07-01T00:00:00";
  assert.deepEqual(warmupCaps(start, "warmup", day(1)), { daily: 5, day: 1 });
  assert.deepEqual(warmupCaps(start, "warmup", day(2)), { daily: 10, day: 2 });
  assert.deepEqual(warmupCaps(start, "warmup", day(3)), { daily: 15, day: 3 });
  assert.deepEqual(warmupCaps(start, "warmup", day(4)), { daily: 20, day: 4 });
  assert.deepEqual(warmupCaps(start, "warmup", day(8)), { daily: 40, day: 8 });
  // Plafond atteint à J10 et jamais dépassé ensuite.
  assert.deepEqual(warmupCaps(start, "warmup", day(10)), { daily: MAX_DAILY, day: 10 });
  assert.deepEqual(warmupCaps(start, "warmup", day(12)), { daily: MAX_DAILY, day: 12 });
  assert.deepEqual(warmupCaps(start, "warmup", day(30)), { daily: MAX_DAILY, day: 30 });
  // Statut chaud → plafond max direct ; pause → zéro envoi.
  assert.deepEqual(warmupCaps(start, "chaud", day(1)).daily, MAX_DAILY);
  assert.deepEqual(warmupCaps(start, "pause", day(20)), { daily: 0, day: 0 });
});

test("MAX_DAILY est bien 50 — on ne dépasse plus jamais ce plafond", () => {
  assert.equal(MAX_DAILY, 50);
  for (const d of [1, 5, 10, 20, 100, 365]) {
    assert.ok(warmupCaps("2026-07-01T00:00:00", "warmup", day(d)).daily <= 50);
  }
});

test("clampToWindow: jamais entre 20 h et 8 h", () => {
  const at = (h: number) => {
    const d = new Date(2026, 6, 10, h, 30, 0, 0);
    return clampToWindow(d);
  };
  assert.equal(at(14).getHours(), 14); // dans la fenêtre : inchangé
  assert.equal(at(21).getHours(), 8); // 21 h 30 → lendemain 8 h
  assert.equal(at(21).getDate(), 11);
  assert.equal(at(6).getHours(), 8); // 6 h 30 → même jour 8 h
  assert.equal(at(6).getDate(), 10);
});

test("nextFollowup: R1 seule — vu → +1 h, pas de vu → +48 h", () => {
  const now = new Date(2026, 6, 10, 10, 0, 0, 0); // 10 h : la fenêtre absorbe +1 h
  assert.equal(nextFollowup(now, 0, true)!.getHours(), 11); // +1 h
  const noSeen = nextFollowup(now, 0, false)!; // +48 h
  assert.equal(noSeen.getDate(), 12);
  // Clamp : +48 h depuis 19 h = 19 h le surlendemain, dans la fenêtre.
  const late = nextFollowup(new Date(2026, 6, 10, 23, 0), 0, true)!;
  assert.equal(late.getHours(), 8); // 23 h + 1 h = minuit → clampé à 8 h
  assert.equal(late.getDate(), 11);
});

test("nextFollowup: plus de relance après R1 (R2/R3 supprimées)", () => {
  const now = new Date(2026, 6, 10, 10, 0, 0, 0);
  assert.equal(nextFollowup(now, 1, true), null);
  assert.equal(nextFollowup(now, 1, false), null);
  assert.equal(nextFollowup(now, 2, true), null);
  assert.equal(nextFollowup(now, 5, false), null);
});

test("stageForStep: mapping M1→accroche … M9→questionnaire, Rn→null", () => {
  assert.equal(stageForStep("M1"), "accroche");
  assert.equal(stageForStep("M3"), "presentation");
  assert.equal(stageForStep("M7"), "douleur");
  assert.equal(stageForStep("M8"), "appel_propose");
  assert.equal(stageForStep("M9"), "questionnaire_envoye");
  assert.equal(stageForStep("R2"), null);
  assert.ok(VALID_STEPS.has("R3") && !VALID_STEPS.has("M10"));
});

test("nextStepFor: le stade dit quel message envoyer ensuite", () => {
  assert.equal(nextStepFor(null), "M1"); // jamais contacté
  assert.equal(nextStepFor(""), "M1");
  assert.equal(nextStepFor("accroche"), "M2");
  assert.equal(nextStepFor("presentation"), "M5"); // M2-M4 tiennent dans « présentation »
  assert.equal(nextStepFor("connexion"), "M7"); // M5-M6 tiennent dans « connexion »
  assert.equal(nextStepFor("douleur"), "M8");
  assert.equal(nextStepFor("appel_propose"), "M9");
});

test("nextStepFor: plus rien à envoyer une fois la séquence épuisée ou close", () => {
  // Après M9 c'est à lui de jouer ; booké et perdu sont des fins.
  assert.equal(nextStepFor("questionnaire_envoye"), null);
  assert.equal(nextStepFor("call_booke"), null);
  assert.equal(nextStepFor("perdu"), null);
  assert.equal(nextStepFor("stade_inconnu"), null);
});

test("nextStepFor: aller-retour cohérent avec stageForStep sur toute la séquence", () => {
  // Envoyer le message proposé doit faire AVANCER le stade, jamais reculer ni stagner.
  for (const stage of STAGES) {
    const step = nextStepFor(stage);
    if (!step) continue;
    const reached = stageForStep(step);
    assert.ok(reached, `${step} devrait mener à un stade`);
    assert.ok(
      STAGES.indexOf(reached!) > STAGES.indexOf(stage),
      `depuis « ${stage} », ${step} mène à « ${reached} » — ce n'est pas une avancée`,
    );
  }
  // Et le tout premier pas mène bien à l'accroche.
  assert.equal(stageForStep(nextStepFor(null)!), "accroche");
});

test("trame site: S1→S5 avancent le stade comme M1→M9, sans jamais reculer", () => {
  // Le même invariant que ci-dessus, appliqué à la seconde partition : c'est
  // lui qui garantit qu'un prospect ne peut pas boucler sur la même étape.
  for (const stage of STAGES) {
    const step = nextStepFor(stage, "site");
    if (!step) continue;
    const reached = stageForStep(step);
    assert.ok(reached, `${step} devrait mener à un stade`);
    assert.ok(
      STAGES.indexOf(reached!) > STAGES.indexOf(stage),
      `depuis « ${stage} », ${step} mène à « ${reached} » — ce n'est pas une avancée`,
    );
  }
  assert.equal(nextStepFor(null, "site"), "S1");
  assert.equal(stageForStep("S1"), "accroche");
  assert.equal(stageForStep("S3"), "douleur"); // la maquette EST le point de douleur
  assert.equal(stageForStep("S5"), "questionnaire_envoye");
});

test("trame site: la trame arrive à la douleur en 3 messages là où la standard en met 7", () => {
  // Ce n'est pas de la cosmétique : c'est la raison d'être de cette trame.
  const compte = (trame: "standard" | "site") => {
    let stage: string | null = null;
    let n = 0;
    while (n < 12) {
      const step = nextStepFor(stage, trame);
      if (!step) break;
      n++;
      if (stageForStep(step) === "douleur") return n;
      stage = stageForStep(step) ?? stage;
    }
    return null;
  };
  assert.equal(compte("site"), 3);
  assert.equal(compte("standard"), 4); // M1, M2(→M5), M5(→M7), M7 : 4 envois pilotés
});

test("isAccrocheStep: les deux trames ont une accroche — sinon la site serait invisible aux KPI", () => {
  assert.ok(isAccrocheStep("M1"));
  assert.ok(isAccrocheStep("S1"));
  assert.ok(!isAccrocheStep("S2"));
  assert.ok(!isAccrocheStep("R1"));
  assert.deepEqual(ACCROCHE_STEPS.filter(isAccrocheStep), ACCROCHE_STEPS);
  assert.equal(trameOfStep("S3"), "site");
  assert.equal(trameOfStep("M3"), "standard");
  assert.equal(trameOfStep("R1"), null); // les relances n'appartiennent à personne
  assert.ok(VALID_STEPS.has("S5") && !VALID_STEPS.has("S6"));
});
