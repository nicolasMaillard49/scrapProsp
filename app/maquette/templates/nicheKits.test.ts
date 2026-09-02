import { test } from "node:test";
import assert from "node:assert/strict";
import { matchNiche, kitForMetier, NICHE_KITS, type NicheKey } from "./nicheKits";
import { templateForMetier, TEMPLATES, TEMPLATE_LABELS, NICHE_TEMPLATE } from "../../lib/demoTemplate";
import { SHOWCASE } from "./showcase";

/* Le routage métier → maquette n'a pas de garde-fou ailleurs : une regex mal
 * ordonnée envoie silencieusement un prospect sur la page d'un autre métier, et
 * ça ne se voit qu'au moment de lui montrer sa démo. */

test("un traiteur ne reçoit plus la maquette du restaurant", () => {
  assert.equal(matchNiche("traiteur"), "traiteur");
  assert.equal(templateForMetier("traiteur"), "traiteur");
});

test("« restaurant traiteur » vend des réceptions, pas des tables", () => {
  // L'ordre des MATCHERS est ce qui décide : traiteur est testé avant restaurant.
  assert.equal(matchNiche("Restaurant traiteur"), "traiteur");
  assert.equal(matchNiche("Traiteur événementiel"), "traiteur");
  assert.equal(matchNiche("Charcuterie traiteur"), "traiteur");
  assert.equal(matchNiche("Salle de réception"), "traiteur");
});

test("le restaurant garde ses propres libellés", () => {
  for (const m of ["restaurant", "Pizzeria Napoli", "brasserie du port", "resto japonais sushi"]) {
    assert.equal(matchNiche(m), "restaurant", m);
  }
});

test("les autres niches ne bougent pas", () => {
  const cas: Array<[string, NicheKey]> = [
    ["barbier", "barbier"],
    ["salon de coiffure", "coiffure"],
    ["onglerie", "onglerie"],
    ["institut de beauté", "esthetique"],
    ["fleuriste", "fleuriste"],
    ["tatoueur", "tatoueur"],
  ];
  for (const [metier, attendu] of cas) assert.equal(matchNiche(metier), attendu, metier);
});

test("un métier hors périmètre reste null — sinon tout le monde reçoit une page de salon", () => {
  assert.equal(matchNiche("serrurier"), null);
  assert.equal(matchNiche(""), null);
  assert.equal(matchNiche(null), null);
});

test("le kit traiteur affiche des prix par convive et vend la réservation", () => {
  const kit = kitForMetier("traiteur");
  assert.equal(kit.offer, "booking");
  // Sans unité, « dès 32 € » laisse croire que le cocktail coûte 32 € au total.
  const reception = kit.services.filter((s) => s.cat === "Réceptions");
  assert.ok(reception.length > 0);
  for (const s of reception) assert.equal(s.unit, "/pers.", s.name);
});

test("chaque niche a un kit, une maquette et une entrée de planche de contact", () => {
  for (const niche of Object.keys(NICHE_KITS) as NicheKey[]) {
    const key = NICHE_TEMPLATE[niche];
    assert.ok(key, `${niche} n'est routée vers aucune maquette`);
    assert.ok(TEMPLATES[key], `${key} n'a pas de composant`);
    assert.ok(TEMPLATE_LABELS[key], `${key} n'a pas de libellé`);
    assert.ok(
      SHOWCASE.some((e) => e.key === key),
      `${key} est absente de la planche de contact`,
    );
  }
});

test("le prix annoncé suit l'offre que la maquette montre", () => {
  for (const e of SHOWCASE) {
    if (e.offer === "variable") assert.equal(e.price, null, e.key);
    else assert.equal(e.price, e.offer === "booking" ? 500 : 300, e.key);
  }
});
