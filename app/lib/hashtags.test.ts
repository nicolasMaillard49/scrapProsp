import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, metierSynonyms, generateHashtags, generateMetierHashtags } from "./hashtags";

test("slugify: minuscules, sans accents/espaces/tirets/apostrophes", () => {
  assert.equal(slugify("Saint-Étienne"), "saintetienne");
  assert.equal(slugify("L'Haÿ-les-Roses"), "lhaylesroses");
  assert.equal(slugify("Mâcon"), "macon");
  assert.equal(slugify("Coiffeur "), "coiffeur");
  assert.equal(slugify(""), "");
});

test("metierSynonyms: niche connue étendue, sinon le slug seul", () => {
  assert.deepEqual(metierSynonyms("coiffeur"), ["coiffeur", "coiffure", "barbier", "salondecoiffure"]);
  assert.deepEqual(metierSynonyms("Plombier"), ["plombier", "plomberie"]);
  assert.deepEqual(metierSynonyms("serrurier"), ["serrurier"]); // inconnu → slug seul
  assert.deepEqual(metierSynonyms(""), []);
});

test("generateMetierHashtags: bibliothèque métier pur, sans ville", () => {
  const rows = generateMetierHashtags("menuisier");
  assert.ok(rows.length >= 10);
  assert.ok(rows.every((r) => r.ville === "" && r.population === 0 && r.pattern === "metier"));
  const tags = rows.map((r) => r.hashtag);
  assert.ok(tags.includes("menuiserie"));
  assert.ok(tags.includes("artisanmenuisier"));
  // dédupliqués
  assert.equal(new Set(tags).size, tags.length);
});

test("generateMetierHashtags: synonyme retrouve la clé canonique", () => {
  const rows = generateMetierHashtags("ébénisterie");
  assert.ok(rows.some((r) => r.hashtag === "menuisier"));
  assert.ok(rows.every((r) => r.metier === "menuisier"));
});

test("generateMetierHashtags: transversaux optionnels, marqués", () => {
  const rows = generateMetierHashtags("carreleur", { includeTransversal: true });
  const trans = rows.filter((r) => r.pattern === "transversal");
  assert.ok(trans.length >= 10);
  assert.ok(trans.some((r) => r.hashtag === "renovation"));
  // sans l'option → aucun transversal
  assert.ok(generateMetierHashtags("carreleur").every((r) => r.pattern === "metier"));
});

test("generateMetierHashtags: métier inconnu → synonymes slug, vide si vide", () => {
  const rows = generateMetierHashtags("serrurier");
  assert.deepEqual(rows.map((r) => r.hashtag), ["serrurier"]);
  assert.deepEqual(generateMetierHashtags(""), []);
});

test("generateHashtags: 2 patterns par (synonyme × ville), dédupliqués, triés par pop", () => {
  const rows = generateHashtags("serrurier", { limitTowns: 1 }); // 1 synonyme (inconnu), 1 ville
  assert.equal(rows.length, 2);
  const tags = rows.map((r) => r.hashtag);
  assert.ok(tags.some((t) => t.startsWith("serrurier"))); // metier+ville
  assert.ok(tags.some((t) => t.endsWith("serrurier"))); // ville+metier
  assert.ok(rows.every((r) => r.population <= 100_000 && r.population >= 1_000));
  // tri par population décroissante : la 1re ville est la plus peuplée du vivier
  assert.ok(rows[0].population >= 90_000);
});

test("generateHashtags: synonymes multiples → 2 patterns par synonyme", () => {
  const rows = generateHashtags("plombier", { limitTowns: 1 }); // 2 synonymes × 1 ville × 2 patterns
  assert.equal(rows.length, 4);
});

test("generateHashtags: filtre département", () => {
  const rows = generateHashtags("plombier", { departments: ["33"], limitTowns: 5 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.dept === "33"));
});

test("generateHashtags: métier inconnu → toujours des hashtags (slug seul)", () => {
  const rows = generateHashtags("serrurier", { limitTowns: 3 });
  assert.ok(rows.length === 6); // 3 villes × 1 synonyme × 2 patterns
  assert.ok(rows.every((r) => r.metier === "serrurier"));
});

test("generateHashtags: métier vide → liste vide", () => {
  assert.deepEqual(generateHashtags("", { limitTowns: 5 }), []);
});
