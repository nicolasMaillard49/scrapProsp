import { test } from "node:test";
import assert from "node:assert/strict";
import { sinceParisDays } from "./igKpiWindow";

/**
 * Les agrégats KPI sont indexés par JOUR CIVIL Europe/Paris. Une fenêtre
 * glissante « maintenant moins N×24 h » tronque donc toujours le jour le plus
 * ancien — et le Sheet, qui se resynchronise toutes les 5 minutes, réécrivait
 * ce jour-là amputé d'une partie de ses messages.
 */

test("days=1 → depuis minuit (Paris) du jour même", () => {
  // 3 août 2026, 14h00 Paris (12h00 UTC, heure d'été → UTC+2).
  const now = new Date("2026-08-03T12:00:00Z");
  assert.equal(sinceParisDays(now, 1), "2026-08-02T22:00:00.000Z");
});

test("days=3 → depuis minuit (Paris) de l'avant-avant-veille, pas 72 h en arrière", () => {
  const now = new Date("2026-08-03T12:00:00Z");
  // 3 jours civils = 01, 02, 03 août → début le 1er août à 00h00 Paris.
  assert.equal(sinceParisDays(now, 3), "2026-07-31T22:00:00.000Z");
});

test("la borne ne dépend pas de l'heure d'appel — c'est tout l'intérêt", () => {
  const matin = sinceParisDays(new Date("2026-08-03T05:00:00Z"), 3);
  const soir = sinceParisDays(new Date("2026-08-03T21:00:00Z"), 3);
  assert.equal(matin, soir);
});

test("heure d'hiver : l'offset Paris suit (UTC+1)", () => {
  // 15 janvier 2026, 12h00 UTC → minuit Paris = 23h00 UTC la veille.
  const now = new Date("2026-01-15T12:00:00Z");
  assert.equal(sinceParisDays(now, 1), "2026-01-14T23:00:00.000Z");
});

test("passage à l'heure d'été : la borne reste un vrai minuit Paris", () => {
  // Le changement a lieu le 29 mars 2026. Au 30 mars, on est en UTC+2, mais
  // la borne du 28 (days=3) tombe un jour encore en UTC+1.
  const now = new Date("2026-03-30T12:00:00Z");
  assert.equal(sinceParisDays(now, 3), "2026-03-27T23:00:00.000Z");
});

test("franchit les mois et les années sans se tromper de jour", () => {
  assert.equal(sinceParisDays(new Date("2026-01-02T12:00:00Z"), 3), "2025-12-30T23:00:00.000Z");
});
