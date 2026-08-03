import { test } from "node:test";
import assert from "node:assert/strict";
import { stripFence, balancedObjects, firstParsableObject } from "./jsonSalvage";

test("stripFence: retire le bloc de code, garde le JSON", () => {
  assert.equal(stripFence('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(stripFence('```\n{"a":1}\n```'), '{"a":1}');
  assert.equal(stripFence('  {"a":1}  '), '{"a":1}');
  assert.equal(stripFence(""), "");
});

test("balancedObjects: rend les objets imbriqués, y compris dans un JSON coupé", () => {
  const tronque = '{"suggestions":[{"label":"A","text":"un"},{"label":"B","text":"deux"},{"label":"C","text":"cou';
  const objs = balancedObjects(tronque);
  // L'objet extérieur n'est jamais refermé ; les deux premiers le sont.
  assert.equal(objs.length, 2);
  assert.deepEqual(JSON.parse(objs[0]), { label: "A", text: "un" });
});

test("firstParsableObject: prend le plus englobant qui se parse", () => {
  const o = firstParsableObject('bla {"a":{"b":2},"c":3} bla');
  assert.deepEqual(o, { a: { b: 2 }, c: 3 });
  // Objet extérieur coupé : on retombe sur l'objet interne complet.
  const coupe = '{"verdict":{"kind":"positive","cold":true},"reason":"inach';
  assert.deepEqual(firstParsableObject(coupe), { kind: "positive", cold: true });
  assert.equal(firstParsableObject("rien du tout"), null);
});
