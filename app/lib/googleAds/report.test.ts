import { test } from "node:test";
import assert from "node:assert/strict";
import { microsToEur, enumName, normalizeMetrics } from "./report";

test("microsToEur: convertit et arrondit au centime", () => {
  assert.equal(microsToEur(1_500_000), 1.5);
  assert.equal(microsToEur(12_345_678), 12.35);
  assert.equal(microsToEur(0), 0);
  assert.equal(microsToEur(null), 0);
  assert.equal(microsToEur(undefined), 0);
});

test("enumName: string telle quelle, number reverse-mappé, fallback String", () => {
  assert.equal(enumName("ENABLED"), "ENABLED");
  assert.equal(enumName(2, { UNSPECIFIED: 0, UNKNOWN: 1, ENABLED: 2, PAUSED: 3 }), "ENABLED");
  assert.equal(enumName(2), "2"); // pas d'enum fourni
  assert.equal(enumName(null), "");
  assert.equal(enumName(undefined), "");
});

test("normalizeMetrics: lit metrics.* et convertit les micros", () => {
  const m = normalizeMetrics({
    metrics: {
      impressions: 1000,
      clicks: 50,
      ctr: 0.05,
      average_cpc: 800_000, // 0.80 €
      cost_micros: 40_000_000, // 40 €
      conversions: 3.5,
      phone_calls: 7,
      cost_per_conversion: 11_428_571, // ~11.43 €
      search_budget_lost_impression_share: 0.12,
    },
  });
  assert.equal(m.impressions, 1000);
  assert.equal(m.clicks, 50);
  assert.equal(m.ctr, 0.05);
  assert.equal(m.avgCpcEur, 0.8);
  assert.equal(m.costEur, 40);
  assert.equal(m.conversions, 3.5);
  assert.equal(m.phoneCalls, 7);
  assert.equal(m.costPerConvEur, 11.43);
  assert.equal(m.searchBudgetLostIs, 0.12);
});

test("normalizeMetrics: row vide → tout à zéro, ratios optionnels à null", () => {
  const m = normalizeMetrics({});
  assert.equal(m.impressions, 0);
  assert.equal(m.costEur, 0);
  assert.equal(m.costPerConvEur, null);
  assert.equal(m.searchBudgetLostIs, null);
});
