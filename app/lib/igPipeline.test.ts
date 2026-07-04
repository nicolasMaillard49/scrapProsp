import { test } from "node:test";
import assert from "node:assert/strict";
import { warmupCaps, clampToWindow, nextFollowup, stageForStep, VALID_STEPS } from "./igPipeline";

const day = (n: number, base = Date.parse("2026-07-01T12:00:00")) => base + (n - 1) * 24 * 3600 * 1000;

test("warmupCaps: plan de chauffe progressif, jamais > 15/h ni 60/j", () => {
  const start = "2026-07-01T00:00:00";
  assert.deepEqual(warmupCaps(start, "warmup", day(1)), { hourly: 5, daily: 15, day: 1 });
  assert.deepEqual(warmupCaps(start, "warmup", day(3)), { hourly: 10, daily: 20, day: 3 });
  assert.deepEqual(warmupCaps(start, "warmup", day(6)), { hourly: 10, daily: 25, day: 6 });
  assert.deepEqual(warmupCaps(start, "warmup", day(9)), { hourly: 15, daily: 30, day: 9 });
  assert.deepEqual(warmupCaps(start, "warmup", day(12)), { hourly: 15, daily: 40, day: 12 });
  assert.deepEqual(warmupCaps(start, "warmup", day(20)), { hourly: 15, daily: 60, day: 20 });
  // Statut chaud → plafonds max direct ; pause → zéro envoi.
  assert.deepEqual(warmupCaps(start, "chaud", day(1)).daily, 60);
  assert.deepEqual(warmupCaps(start, "pause", day(20)), { hourly: 0, daily: 0, day: 0 });
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

test("nextFollowup: vu → R1 +1h, R2 +7h, R3 +6h ; pas de vu → +48h", () => {
  const now = new Date(2026, 6, 10, 10, 0, 0, 0); // 10 h : la fenêtre absorbe +1 h/+7 h
  assert.equal(nextFollowup(now, 0, true).getHours(), 11); // +1 h
  assert.equal(nextFollowup(now, 1, true).getHours(), 17); // +7 h
  assert.equal(nextFollowup(now, 2, true).getHours(), 16); // +6 h
  const noSeen = nextFollowup(now, 0, false); // +48 h
  assert.equal(noSeen.getDate(), 12);
  // Clamp : +7 h depuis 15 h = 22 h → lendemain 8 h.
  const late = nextFollowup(new Date(2026, 6, 10, 15, 0), 1, true);
  assert.equal(late.getHours(), 8);
  assert.equal(late.getDate(), 11);
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
