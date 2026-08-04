import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseVariant, verdict, best, rate, MIN_SENT, type Variant } from "./igVariants";

const v = (id: string, sent: number, replied: number): Variant =>
  ({ id, step: "M1", label: id, text: `accroche ${id}`, sent, replied });

test("chooseVariant: une seule variante → pas de tirage", () => {
  assert.equal(chooseVariant([v("a", 100, 20)])!.id, "a");
  assert.equal(chooseVariant([]), null);
});

test("chooseVariant: tant qu'une variante est sous le seuil, elle passe d'abord", () => {
  // Sans ça, la « meilleure » se décide sur 3 envois — c'est-à-dire au hasard,
  // et le champion accidentel ne serait plus jamais départagé.
  const list = [v("champion", 500, 150), v("neuve", MIN_SENT - 1, 0)];
  // Quel que soit le tirage, c'est la jeune qui part.
  for (const r of [0, 0.4, 0.99]) {
    assert.equal(chooseVariant(list, () => r)!.id, "neuve");
  }
});

test("chooseVariant: matures → le champion la plupart du temps, une autre parfois", () => {
  const list = [v("bonne", 200, 60), v("moins", 200, 20)]; // 30 % contre 10 %
  // Tirage au-dessus d'epsilon : exploitation, c'est la meilleure.
  assert.equal(chooseVariant(list, () => 0.9)!.id, "bonne");
  // Tirage sous epsilon : exploration, et JAMAIS le champion — le réessayer
  // n'apprendrait rien.
  assert.equal(chooseVariant(list, () => 0.05)!.id, "moins");
});

test("rate / best : le taux de réponse départage, une variante jamais envoyée vaut 0", () => {
  assert.equal(rate(v("x", 0, 0)), 0);
  assert.equal(rate(v("x", 200, 50)), 0.25);
  assert.equal(best([v("a", 100, 10), v("b", 100, 30)])!.id, "b");
});

test("verdict: aucun gagnant tant que les données sont maigres ou l'écart faible", () => {
  // Deux variantes sous le seuil : rien à annoncer.
  assert.equal(verdict([v("a", 10, 5), v("b", 10, 1)]), null);
  // Matures mais au coude à coude (2 points d'écart) : on se tait. Annoncer un
  // gagnant sur du bruit ferait remplacer une accroche qui marche.
  assert.equal(verdict([v("a", 300, 60), v("b", 300, 54)]), null);
  // Une seule mature : il n'y a personne à battre.
  assert.equal(verdict([v("a", 300, 60), v("b", 5, 4)]), null);
});

test("verdict: écart net entre deux variantes matures → on annonce", () => {
  const out = verdict([v("gagnante", 300, 90), v("perdante", 300, 30)]);
  assert.ok(out, "un écart de 20 points doit se dire");
  assert.equal(out!.winner.id, "gagnante");
  assert.equal(out!.runnerUp.id, "perdante");
  assert.ok(out!.gap > 0.19 && out!.gap < 0.21, `écart ${out!.gap}`);
});
