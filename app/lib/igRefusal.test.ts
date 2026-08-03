import test from "node:test";
import assert from "node:assert/strict";
import { refusalAction } from "./igRefusal";
import { REPLY_KINDS } from "./igPipeline";

test("une réponse existe aujourd'hui → on la RECLASSE, on n'en empile pas une seconde", () => {
  // La règle du KPI est « une réponse par prospect et par jour, la plus
  // significative » : une 2ᵉ ligne ne bougerait aucun compteur et ferait
  // mentir le journal sur ce qui s'est dit.
  assert.equal(refusalAction("e41ff241-11b0-4f79-a642-ba84e7d426e2"), "reclass");
});

test("aucune réponse aujourd'hui → on journalise le refus", () => {
  assert.equal(refusalAction(null), "insert");
});

test("« refus » est bien un genre de réponse, pas un stade", () => {
  // Le piège d'origine : cliquer « Perdu » (un stade) n'écrivait rien dans
  // ig_replies, donc le KPI refus restait à 0.
  assert.ok((REPLY_KINDS as readonly string[]).includes("refus"));
});
