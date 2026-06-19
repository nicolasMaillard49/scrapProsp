import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, metierSynonyms, generateHashtags } from "./hashtags";

test("slugify: minuscules, sans accents/espaces/tirets/apostrophes", () => {
  assert.equal(slugify("Saint-Étienne"), "saintetienne");
  assert.equal(slugify("L'Haÿ-les-Roses"), "lhaylesroses");
  assert.equal(slugify("Mâcon"), "macon");
  assert.equal(slugify("Coiffeur "), "coiffeur");
  assert.equal(slugify(""), "");
});

test("metierSynonyms: niche connue étendue, sinon le slug seul", () => {
  assert.deepEqual(metierSynonyms("coiffeur"), ["coiffeur", "coiffure", "barbier", "salondecoiffure"]);
  assert.deepEqual(metierSynonyms("Plombier"), ["plombier"]);
  assert.deepEqual(metierSynonyms(""), []);
});

test("generateHashtags: 2 patterns par (synonyme × ville), dédupliqués, triés par pop", () => {
  const rows = generateHashtags("plombier", { limitTowns: 1 }); // 1 synonyme, 1 ville
  assert.equal(rows.length, 2);
  const tags = rows.map((r) => r.hashtag);
  assert.ok(tags.some((t) => t.startsWith("plombier"))); // metier+ville
  assert.ok(tags.some((t) => t.endsWith("plombier"))); // ville+metier
  assert.ok(rows.every((r) => r.population <= 100_000 && r.population >= 1_000));
  // tri par population décroissante : la 1re ville est la plus peuplée du vivier
  assert.ok(rows[0].population >= 90_000);
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
