import test from "node:test";
import assert from "node:assert/strict";
import { boardColumnWeight } from "./crmBoard";

test("les colonnes CRM gagnent de la largeur selon leur nombre de clients, sans écraser les autres", () => {
  assert.equal(boardColumnWeight(0), 1);
  assert.ok(boardColumnWeight(3) > boardColumnWeight(1));
  assert.equal(boardColumnWeight(100), 2.5);
  assert.equal(boardColumnWeight(-4), 1);
});
