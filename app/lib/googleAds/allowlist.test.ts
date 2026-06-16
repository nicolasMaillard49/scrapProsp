import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAllowlist, isRealAllowed } from "./allowlist";

test("parseAllowlist: vide => set vide", () => {
  assert.equal(parseAllowlist("").size, 0);
  assert.equal(parseAllowlist(undefined).size, 0);
  assert.equal(parseAllowlist(null).size, 0);
});

test("parseAllowlist: normalise casse + espaces, ignore vides", () => {
  const s = parseAllowlist(" A@B.com , c@d.fr ,, ");
  assert.deepEqual([...s].sort(), ["a@b.com", "c@d.fr"]);
});

test("isRealAllowed: match insensible à la casse", () => {
  assert.equal(isRealAllowed("Nico@Test.fr", "nico@test.fr"), true);
  assert.equal(isRealAllowed("autre@x.fr", "nico@test.fr"), false);
  assert.equal(isRealAllowed(null, "nico@test.fr"), false);
  assert.equal(isRealAllowed("nico@test.fr", ""), false);
});
