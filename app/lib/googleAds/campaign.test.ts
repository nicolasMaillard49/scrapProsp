import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomerId } from "./campaign";

test("normalizeCustomerId: strippe tirets/espaces -> 10 chiffres", () => {
  assert.equal(normalizeCustomerId("671-181-3801"), "6711813801");
  assert.equal(normalizeCustomerId("6711813801"), "6711813801");
  assert.equal(normalizeCustomerId(" 671 181 3801 "), "6711813801");
});

test("normalizeCustomerId: rejette ce qui n'est pas 10 chiffres", () => {
  assert.equal(normalizeCustomerId("123"), null);
  assert.equal(normalizeCustomerId("12345678901"), null); // 11 chiffres
  assert.equal(normalizeCustomerId(""), null);
  assert.equal(normalizeCustomerId(null), null);
  assert.equal(normalizeCustomerId(undefined), null);
  assert.equal(normalizeCustomerId("abcdefghij"), null);
});
