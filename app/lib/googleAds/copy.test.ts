import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackKeywords } from "./copy";

test("fallbackKeywords: ne contient JAMAIS la ville (la géoloc localise déjà)", () => {
  const kw = fallbackKeywords("couvreur");
  assert.ok(kw.length > 0, "doit produire des mots-clés");
  assert.ok(
    !kw.some((k) => /cormelles|caen|paris/i.test(k.text)),
    "aucune ville ne doit apparaître dans un mot-clé",
  );
});

test("fallbackKeywords: décline chaque base en PHRASE + EXACT", () => {
  const kw = fallbackKeywords("couvreur");
  const phrase = kw.filter((k) => k.match === "PHRASE").map((k) => k.text);
  const exact = kw.filter((k) => k.match === "EXACT").map((k) => k.text);
  assert.deepEqual(phrase, exact, "mêmes bases en PHRASE et EXACT");
});

test("fallbackKeywords: inclut le service et des variantes à intention commerciale", () => {
  const kw = fallbackKeywords("couvreur").map((k) => k.text);
  assert.ok(kw.includes("couvreur"));
  assert.ok(kw.some((t) => t.startsWith("devis")));
});
