// Professions libérales : la détection ne doit pas voler de prospects aux
// niches existantes. Deux collisions sont volontairement piégeuses —
// « massage » (esthétique vs kiné) et « avocat » (le fruit vs le cabinet).

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMetier, instagramDmSequence } from "./instagram";

test("détecte les professions de santé libérales", () => {
  assert.equal(detectMetier("Kinésithérapeute", "Cabinet de rééducation"), "kine");
  assert.equal(detectMetier(null, "Ostéopathe D.O. — nourrissons et sportifs"), "osteopathe");
  assert.equal(detectMetier("Chirurgien-dentiste", "Cabinet dentaire à Bordeaux"), "dentiste");
  assert.equal(detectMetier(null, "Pédicure-podologue, semelles orthopédiques"), "podologue");
  assert.equal(detectMetier(null, "Orthophoniste, bilans et rééducation du langage"), "orthophoniste");
  assert.equal(detectMetier(null, "Sage-femme libérale, préparation à la naissance"), "sagefemme");
  assert.equal(detectMetier("Clinique vétérinaire", "Soins pour chiens et chats"), "veterinaire");
  assert.equal(detectMetier(null, "Psychologue clinicienne, thérapie brève"), "psychologue");
  assert.equal(detectMetier(null, "Diététicienne nutritionniste"), "dieteticien");
  assert.equal(detectMetier(null, "Sophrologue certifiée, gestion du stress"), "sophrologue");
  assert.equal(detectMetier(null, "Médecin généraliste, maison de santé"), "medecin");
});

test("détecte le juridique et le chiffre", () => {
  assert.equal(detectMetier(null, "Avocate au barreau de Paris"), "avocat");
  assert.equal(detectMetier(null, "Cabinet d'avocats, droit du travail"), "avocat");
  assert.equal(detectMetier(null, "Étude notariale — transactions immobilières"), "notaire");
  assert.equal(detectMetier("Expert-comptable", "Accompagnement des TPE"), "expertcomptable");
});

test("collision « massage » : le kiné prime sur l'esthétique, l'institut reste institut", () => {
  // Le mot « massage » appartient à la regex esthéticienne : sans priorité, un
  // masseur-kiné y tombait.
  assert.equal(detectMetier(null, "Masseur-kinésithérapeute, massage thérapeutique"), "kine");
  // À l'inverse, un institut qui propose des massages ne devient pas un cabinet.
  assert.equal(detectMetier("Institut de beauté", "Massage et soins du visage"), "estheticienne");
});

test("collision « avocat » : le fruit ne fabrique pas un cabinet", () => {
  assert.equal(detectMetier("Restaurant", "Toast avocat saumon, brunch fait maison"), "restaurant");
  assert.equal(detectMetier(null, "Avocat spécialisé en droit de la famille"), "avocat");
});

test("« médecine esthétique » reste de l'esthétique, pas un cabinet médical", () => {
  assert.equal(detectMetier(null, "Médecine esthétique : hifu, cryolipolyse"), "estheticienne");
});

test("les artisans du bâtiment gardent la priorité", () => {
  // « rééducation » (kiné) ne doit pas capter un menuisier qui rénove.
  assert.equal(detectMetier("Menuiserie", "Agencement sur mesure"), "menuisier");
  assert.equal(detectMetier(null, "Plombier chauffagiste, salle de bain"), "plombier");
});

test("le DM d'une libérale vouvoie et ne promet pas de patients", () => {
  const steps = instagramDmSequence(
    { username: "cabinet_kine_bx", metier: "kine", ville: "Bordeaux" } as never,
    "https://exemple.test/demo",
  );
  const m1 = steps.find((s) => s.step === "M1");
  assert.ok(m1, "M1 doit exister");
  // Aucune promesse de patientèle : la publicité des soignants est encadrée.
  assert.doesNotMatch(m1!.text, /patients?|client[eè]le|plus de rendez-vous garantis/i);
  // Bornes explicites plutôt que \b : en JS, « ê » n'est pas un caractère de mot,
  // donc /\btes\b/ matcherait « êtes ». Faux positif garanti en français.
  assert.doesNotMatch(m1!.text, /(^|\s)(tu|ton|ta|tes|toi)(\s|[,.!?]|$)/i);
});
