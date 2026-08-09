/**
 * Sonde GP elec — decouvre ce que l API renvoie REELLEMENT.
 *
 *   1. Quels services keywordPlan* la lib v24 expose.
 *   2. La reponse BRUTE de generateKeywordForecastMetrics (impressions ? ctr ?).
 *
 *   node --import tsx scripts/audit-gp-elec-probe.mjs
 */
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const { enums } = await import("google-ads-api");
const { mccCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");
const { resolveGeoTargetConstant } = await import("../app/lib/googleAds/keywordIdeas.ts");

const cust = mccCustomer();

console.log("=== services keywordPlan* exposes ===");
const seen = new Set();
for (let o = cust; o; o = Object.getPrototypeOf(o)) {
  for (const k of Object.getOwnPropertyNames(o)) {
    if (/keywordPlan|geoTarget/i.test(k) && !seen.has(k)) { seen.add(k); console.log("  " + k); }
  }
}
for (const k of seen) {
  const svc = cust[k];
  if (!svc) continue;
  const methods = new Set();
  for (let o = svc; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const m of Object.getOwnPropertyNames(o)) if (typeof svc[m] === "function" && m !== "constructor") methods.add(m);
  }
  console.log(`  ${k} -> ${[...methods].join(", ")}`);
}

const LANG = "languageConstants/1002";
const geoAngers = await resolveGeoTargetConstant(cust, "Angers");
console.log("\ngeo Angers =", geoAngers);

console.log("\n=== generateKeywordForecastMetrics : reponse BRUTE ===");
const res = await cust.keywordPlanIdeas.generateKeywordForecastMetrics({
  customer_id: MCC_ID,
  currency_code: "EUR",
  forecast_period: { start_date: "2026-09-01", end_date: "2026-09-30" },
  campaign: {
    language_constants: [LANG],
    geo_target_constants: [geoAngers],
    bidding_strategy: { manual_cpc_bidding_strategy: { max_cpc_bid_micros: 2_060_000, daily_budget_micros: 6_580_000 } },
    ad_groups: [{
      keywords: [
        { text: "electricien angers", match_type: enums.KeywordMatchType.PHRASE },
        { text: "depannage electrique", match_type: enums.KeywordMatchType.PHRASE },
      ],
    }],
  },
});
console.log(JSON.stringify(res, null, 2));
