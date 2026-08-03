import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanProofread, buildProofreadSystem } from "./igProofread";

test("prompt: corrige sans réécrire, et n'ajoute jamais signature ni lien", () => {
  const p = buildProofreadSystem();
  assert.match(p, /ne reformule pas/i);
  assert.match(p, /aucune signature/i);
  assert.match(p, /aucun lien/i);
  assert.match(p, /garde le tutoiement ou le vouvoiement/i);
});

test("prompt: français uniquement — jamais de traduction", () => {
  const p = buildProofreadSystem();
  assert.match(p, /FRANÇAIS/);
  assert.match(p, /ne traduis jamais/i);
});

test("prompt: embarque le vocabulaire métier, pour ne pas « corriger » un mot juste", () => {
  const p = buildProofreadSystem();
  assert.match(p, /prothésiste ongulaire/);
  assert.match(p, /slt, tjr/);
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

test("clean: aucune limite de longueur — un message long reste corrigé", () => {
  // Ajouter la ponctuation manquante rallonge légitimement le texte ; refuser
  // au-delà d'un ratio annulait des corrections parfaitement valables.
  const orig = "slt cv";
  assert.equal(cleanProofread("Salut, ça va ?", orig), "Salut, ça va ?");
  const long = "Bonjour. ".repeat(200).trim();
  assert.equal(cleanProofread(long, orig), long);
});

test("prompt: la ponctuation est poussée, pas seulement tolérée", () => {
  const p = buildProofreadSystem();
  assert.match(p, /PONCTUATION/);
  assert.match(p, /points d'interrogation/i);
  assert.match(p, /majuscule en début de chaque phrase/i);
});
