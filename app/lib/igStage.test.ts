import test from "node:test";
import assert from "node:assert/strict";
import { stagePatch, closesDayLine, parseStage } from "./igStage";
import { STAGES, nextStepFor, stageTone } from "./igPipeline";

test("les deux issues terminales coupent les relances", () => {
  assert.deepEqual(stagePatch("perdu"), { stage: "perdu", status: "negative", next_followup_at: null });
  assert.deepEqual(stagePatch("call_booke"), { stage: "call_booke", status: "positive", next_followup_at: null });
});

test("un stade intermédiaire ne touche NI au statut NI à la relance", () => {
  // Le bug d'origine était l'inverse : le recalage depuis l'extension
  // n'écrivait que `stage`, même pour « perdu ».
  for (const stage of ["accroche", "receptif", "presentation", "connexion", "douleur", "appel_propose", "questionnaire_envoye"] as const) {
    assert.deepEqual(stagePatch(stage), { stage }, `${stage} ne doit poser que le stade`);
  }
});

test("seul « perdu » ferme la ligne du jour", () => {
  assert.equal(closesDayLine("perdu"), true);
  // Un call booké garde sa ligne : le DM est parti, il compte aux KPI du jour.
  assert.equal(closesDayLine("call_booke"), false);
  // Les stades intermédiaires se posent PENDANT qu'on travaille le prospect.
  assert.equal(closesDayLine("connexion"), false);
  assert.equal(closesDayLine("receptif"), false);
});

test("parseStage refuse ce qui n'est pas un stade connu", () => {
  assert.equal(parseStage("perdu"), "perdu");
  assert.equal(parseStage("  PERDU "), "perdu", "casse et espaces tolérés");
  assert.equal(parseStage("receptif"), "receptif");
  assert.equal(parseStage("gagne"), null);
  assert.equal(parseStage(""), null);
  assert.equal(parseStage(null), null);
  assert.equal(parseStage(undefined), null);
  assert.equal(parseStage(42), null);
});

test("« réceptif » est un stade à part entière, pas un trou", () => {
  assert.ok((STAGES as readonly string[]).includes("receptif"));
  // Il se pose APRÈS l'accroche et AVANT la présentation.
  assert.equal(STAGES.indexOf("receptif"), STAGES.indexOf("accroche") + 1);
  assert.equal(STAGES.indexOf("receptif") + 1, STAGES.indexOf("presentation"));
  // Régression gardée : sans son cas dans nextStepFor, marquer un prospect
  // réceptif lui couperait sa trame (default → null).
  assert.equal(nextStepFor("receptif"), "M2");
  assert.equal(stageTone("receptif"), "progress");
});
