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

test("prune: garde les plus recents, borne la taille", () => {
  const keys = Array.from({ length: 250 }, (_, i) => `k${i}`);
  const pruned = NMFUtil.prune(keys, 200);
  assert.equal(pruned.length, 200);
  assert.equal(pruned[0], "k50");
  assert.equal(pruned[199], "k249");
});
