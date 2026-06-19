import { test } from "node:test";
import assert from "node:assert/strict";
import { selectKeywords, seedKeywordsFor, type KeywordIdea } from "./keywordIdeas";

const idea = (text: string, vol: number): KeywordIdea => ({ text, avgMonthlySearches: vol });

test("selectKeywords: exclut les mots-clés contenant la ville du lead (le bug d'origine)", () => {
  const ideas = [
    idea("couvreur cormelles-le-royal", 500), // fort volume mais ville dedans → exclu
    idea("couvreur", 1000),
  ];
  const kw = selectKeywords(ideas, { ville: "Cormelles-le-Royal" });
  const texts = kw.map((k) => k.text);
  assert.ok(!texts.includes("couvreur cormelles-le-royal"), "la ville ne doit jamais rester dans le mot-clé");
  assert.ok(texts.includes("couvreur"));
});

test("selectKeywords: match ville insensible aux accents et aux tirets", () => {
  const ideas = [
    idea("devis couvreur cormelles le royal", 300), // sans tirets → doit quand même être exclu
    idea("réparation toiture", 200),
  ];
  const kw = selectKeywords(ideas, { ville: "Cormelles-le-Royal" });
  const texts = kw.map((k) => k.text);
  assert.ok(!texts.some((t) => t.includes("cormelles")));
  assert.ok(texts.includes("réparation toiture"));
});

test("selectKeywords: filtre le volume sous le seuil (Volume de recherche faible)", () => {
  const ideas = [
    idea("couvreur zingueur", 90),
    idea("couvreur ardoise mousse", 3), // trop faible → serait 'Non éligible'
  ];
  const kw = selectKeywords(ideas, { ville: "Caen", minVolume: 10 });
  const texts = kw.map((k) => k.text);
  assert.ok(texts.includes("couvreur zingueur"));
  assert.ok(!texts.includes("couvreur ardoise mousse"));
});

test("selectKeywords: priorise l'intention commerciale (devis/prix/réparation) à volume comparable", () => {
  const ideas = [
    idea("toiture", 1000),
    idea("devis couvreur", 80),
    idea("prix réparation toiture", 60),
  ];
  const kw = selectKeywords(ideas, { ville: "Caen", limit: 2 });
  const texts = [...new Set(kw.map((k) => k.text))];
  // Les 2 retenus doivent être les 2 à forte intention, pas le générique "toiture".
  assert.deepEqual(texts, ["devis couvreur", "prix réparation toiture"]);
});

test("selectKeywords: chaque mot-clé retenu est décliné en PHRASE et EXACT", () => {
  const kw = selectKeywords([idea("couvreur zingueur", 100)], { ville: "Caen" });
  assert.deepEqual(kw, [
    { text: "couvreur zingueur", match: "PHRASE" },
    { text: "couvreur zingueur", match: "EXACT" },
  ]);
});

test("selectKeywords: dédoublonne et respecte la limite", () => {
  const ideas = [
    idea("devis couvreur", 100),
    idea("Devis Couvreur", 100), // doublon (casse)
    idea("réparation toiture", 90),
    idea("couvreur zingueur", 80),
  ];
  const kw = selectKeywords(ideas, { ville: "Caen", limit: 2 });
  const texts = [...new Set(kw.map((k) => k.text))];
  assert.equal(texts.length, 2, "limite = 2 mots-clés uniques");
});

test("selectKeywords: liste vide en entrée → liste vide (déclenche le fallback chez l'appelant)", () => {
  assert.deepEqual(selectKeywords([], { ville: "Caen" }), []);
});

test("seedKeywordsFor: produit des graines SANS ville, incluant le service et des variantes d'intention", () => {
  const seeds = seedKeywordsFor({ metier: "couvreur", service: "réparation toiture" });
  assert.ok(seeds.includes("réparation toiture"));
  assert.ok(seeds.includes("couvreur"));
  assert.ok(seeds.some((s) => s.startsWith("devis")));
  assert.ok(!seeds.some((s) => /cormelles|caen/i.test(s)), "aucune ville dans les graines");
  assert.equal(seeds.length, new Set(seeds).size, "graines dédoublonnées");
});
