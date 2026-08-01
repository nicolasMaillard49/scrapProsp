import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearch, isSubsequence, editDistanceWithin, matchesProspect } from "./search";

test("normalizeSearch : ponctuation, casse et accents disparaissent", () => {
  assert.equal(normalizeSearch("M.led_xix"), "mledxix");
  assert.equal(normalizeSearch("menuiserie-lacroix"), "menuiserielacroix");
  assert.equal(normalizeSearch("Pâtisserie Éclair"), "patisserieeclair");
  assert.equal(normalizeSearch("  "), "");
});

test("le cas de terrain : « mledxix » retrouve @M.led_xix", () => {
  const l = { username: "M.led_xix" };
  assert.equal(matchesProspect(l, "mledxix"), true);
  assert.equal(matchesProspect(l, "MLEDXIX"), true);
  assert.equal(matchesProspect(l, "m.led.xix"), true);
  assert.equal(matchesProspect(l, "led"), true);
});

test("isSubsequence : caractères oubliés", () => {
  assert.equal(isSubsequence("mlxix", "mledxix"), true);
  assert.equal(isSubsequence("xixm", "mledxix"), false); // l'ordre compte
});

test("editDistanceWithin : borne respectée", () => {
  assert.equal(editDistanceWithin("menuisier", "menusier", 1), true); // lettre manquante
  assert.equal(editDistanceWithin("menuisier", "menuiziee", 2), true);
  assert.equal(editDistanceWithin("menuisier", "plombier", 2), false);
  assert.equal(editDistanceWithin("abc", "abcdef", 1), false); // longueurs trop écartées
});

test("une lettre fausse ne fait pas perdre le prospect", () => {
  const l = { username: "menuiserie_lacroix" };
  assert.equal(matchesProspect(l, "menuizerie"), true); // s → z
  assert.equal(matchesProspect(l, "lacroi"), true); // lettre en moins
  assert.equal(matchesProspect(l, "lacroux"), true); // lettre fausse au milieu
});

test("la recherche reste sélective — pas de faux positif grossier", () => {
  const l = { username: "menuiserie_lacroix", full_name: "Menuiserie Lacroix", ville: "Nantes" };
  assert.equal(matchesProspect(l, "plomberie"), false);
  assert.equal(matchesProspect(l, "coiffeur"), false);
});

test("requête trop courte : aucune tolérance, sinon tout matche", () => {
  const l = { username: "menuiserie_lacroix" };
  assert.equal(matchesProspect(l, "xy"), false);
  assert.equal(matchesProspect(l, "me"), true); // sous-chaîne exacte, elle
});

test("nom, ville et bio restent cherchables en sous-chaîne", () => {
  const l = { username: "abc123", full_name: "Atelier du Bois", ville: "Nantes", bio: "charpente sur mesure" };
  assert.equal(matchesProspect(l, "atelier du bois"), true);
  assert.equal(matchesProspect(l, "nantes"), true);
  assert.equal(matchesProspect(l, "charpente"), true);
});

test("requête vide : tout passe", () => {
  assert.equal(matchesProspect({ username: "quoi" }, ""), true);
  assert.equal(matchesProspect({ username: "quoi" }, "   "), true);
});
