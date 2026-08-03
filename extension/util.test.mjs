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

test("pickAccountId: un seul compte declare = pas de choix a faire", () => {
  const one = [{ id: "a1", username: "nmfagence" }];
  assert.equal(NMFUtil.pickAccountId(one, "nmfagence"), "a1");
  // Meme si la detection du compte connecte echoue ou ne correspond pas :
  // avec un seul emetteur possible il n'y a rien a deviner.
  assert.equal(NMFUtil.pickAccountId(one, null), "a1");
  assert.equal(NMFUtil.pickAccountId(one, "autre_compte"), "a1");
});

test("pickAccountId: plusieurs comptes = appariement strict, sinon aucun", () => {
  const many = [
    { id: "a1", username: "nmfagence" },
    { id: "a2", username: "nmf.pro" },
  ];
  assert.equal(NMFUtil.pickAccountId(many, "nmf.pro"), "a2");
  // Pseudo inconnu ou non detecte : surtout pas de choix par defaut,
  // sinon un DM part au credit du mauvais compte de chauffe.
  assert.equal(NMFUtil.pickAccountId(many, "inconnu"), null);
  assert.equal(NMFUtil.pickAccountId(many, null), null);
});

test("pickAccountId: aucune liste exploitable = null, jamais une exception", () => {
  assert.equal(NMFUtil.pickAccountId([], "nmfagence"), null);
  assert.equal(NMFUtil.pickAccountId(undefined, "nmfagence"), null);
  assert.equal(NMFUtil.pickAccountId(null, null), null);
});

test("prune: garde les plus recents, borne la taille", () => {
  const keys = Array.from({ length: 250 }, (_, i) => `k${i}`);
  const pruned = NMFUtil.prune(keys, 200);
  assert.equal(pruned.length, 200);
  assert.equal(pruned[0], "k50");
  assert.equal(pruned[199], "k249");
});
