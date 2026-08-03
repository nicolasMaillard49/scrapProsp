import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanProofread, PROOFREAD_SYSTEM } from "./igProofread";

test("prompt: corrige sans réécrire, et n'ajoute jamais signature ni lien", () => {
  assert.match(PROOFREAD_SYSTEM, /ne reformule pas/i);
  assert.match(PROOFREAD_SYSTEM, /aucune signature/i);
  assert.match(PROOFREAD_SYSTEM, /aucun lien/i);
  assert.match(PROOFREAD_SYSTEM, /garde le tutoiement ou le vouvoiement/i);
});

test("prompt: français uniquement — jamais de traduction", () => {
  assert.match(PROOFREAD_SYSTEM, /FRANÇAIS/);
  assert.match(PROOFREAD_SYSTEM, /ne traduis jamais/i);
});

test("clean: texte corrigé rendu tel quel", () => {
  assert.equal(cleanProofread("Salut, ça va ?", "slt ca va"), "Salut, ça va ?");
});

test("clean: préambule bavard, guillemets et bloc de code retirés", () => {
  const orig = "vous ete dispo";
  assert.equal(cleanProofread('Voici le texte corrigé : "Vous êtes dispo"', orig), "Vous êtes dispo");
  assert.equal(cleanProofread("« Vous êtes dispo »", orig), "Vous êtes dispo");
  assert.equal(cleanProofread("```\nVous êtes dispo\n```", orig), "Vous êtes dispo");
});

test("clean: emojis, retours à la ligne et liens préservés", () => {
  const corrected = "Top ! 👉 https://exemple.fr\n\nDites-moi.";
  assert.equal(cleanProofread(corrected, "top 👉 https://exemple.fr\n\ndite moi"), corrected);
});

test("clean: réponse vide → on garde l'original, jamais un champ vidé", () => {
  assert.equal(cleanProofread("", "mon message"), "mon message");
  assert.equal(cleanProofread("   ", "mon message"), "mon message");
  assert.equal(cleanProofread('""', "mon message"), "mon message");
});

test("clean: réécriture ou explication (longueur qui explose) → original conservé", () => {
  const orig = "slt cv";
  const bavard =
    "Le message contient plusieurs fautes. Voici mon analyse détaillée point par point, " +
    "puis la version corrigée avec des explications sur chaque correction apportée au texte.";
  assert.equal(cleanProofread(bavard, orig), orig);
  // Une vraie correction d'un message court reste acceptée.
  assert.equal(cleanProofread("Salut, ça va ?", orig), "Salut, ça va ?");
});
