/**
 * Audit GP elec — collecte Google Ads complete (lecture seule).
 *
 *   Phase 1 : metriques historiques du portefeuille exact (66 mots-cles).
 *   Phase 2 : matrice multi-budgets, 3 strategies x 10 paliers = 30 appels forecast.
 *
 * Ecrit au fil de l'eau dans le scratchpad pour ne rien perdre en cas de coupure.
 *   node --import tsx scripts/audit-gp-elec-full.mjs
 */
import { readFileSync, writeFileSync } from "fs";

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

const OUT = "C:/Users/nicol/AppData/Local/Temp/claude/D--projets-audit/d8f84200-1c69-4971-a044-1c51d6037616/scratchpad/ads-data.json";
const PORTFOLIO = JSON.parse(readFileSync(
  "C:/Users/nicol/AppData/Local/Temp/claude/D--projets-audit/d8f84200-1c69-4971-a044-1c51d6037616/scratchpad/portfolio.json",
  "utf8",
));

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;

const LANG = "languageConstants/1002";
const PERIOD = { start_date: "2026-09-01", end_date: "2026-09-30" };
const COMMUNES = [
  "Angers", "Loire-Authion", "Trelaze", "Avrille", "Les Ponts-de-Ce",
  "Brissac Loire Aubance", "Saint-Barthelemy-d'Anjou", "Bouchemaine",
  "Verrieres-en-Anjou", "Beaufort-en-Anjou",
];
const BUDGETS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];

const out = {
  meta: {
    extraction: new Date(Number(process.env.AUDIT_TS || 0) || undefined).toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / KeywordPlanIdeaService",
    langue: LANG,
    reseau: "GOOGLE_SEARCH",
    devise: "EUR",
    periode_forecast: PERIOD,
    communes: COMMUNES,
    budgets: BUDGETS,
  },
  geo: [],
  historical: [],
  matrix: [],
  errors: [],
};
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

// ── Geo ────────────────────────────────────────────────────────────────────
for (const c of COMMUNES) {
  const g = await resolveGeoTargetConstant(cust, c);
  if (g) out.geo.push({ commune: c, geo: g });
  else out.errors.push({ phase: "geo", commune: c, error: "NON_RESOLU" });
}
const GEO = out.geo.map((g) => g.geo);
console.log(`Geo : ${GEO.length}/${COMMUNES.length} communes resolues`);
save();

// ── Phase 1 : metriques historiques du portefeuille ────────────────────────
const KEYWORDS = PORTFOLIO.keywords.map((k) => k.text);
console.log(`\nPhase 1 — metriques historiques de ${KEYWORDS.length} mots-cles`);
try {
  const res = await cust.keywordPlanIdeas.generateKeywordHistoricalMetrics({
    customer_id: MCC_ID,
    keywords: KEYWORDS,
    language: LANG,
    geo_target_constants: GEO,
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
  });
  const rows = res?.results ?? (Array.isArray(res) ? res : []);
  const COMP = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte", 2: "faible", 3: "moyenne", 4: "forte" };
  for (const r of rows) {
    const m = r.keyword_metrics ?? {};
    out.historical.push({
      text: r.text ?? "",
      closeVariants: r.close_variants ?? [],
      vol: m.avg_monthly_searches != null ? Number(m.avg_monthly_searches) : null,
      comp: COMP[m.competition] ?? null,
      compIndex: m.competition_index != null ? Number(m.competition_index) : null,
      bidLow: m.low_top_of_page_bid_micros != null ? euros(m.low_top_of_page_bid_micros) : null,
      bidHigh: m.high_top_of_page_bid_micros != null ? euros(m.high_top_of_page_bid_micros) : null,
      months: (m.monthly_search_volumes ?? []).map((x) => ({
        m: `${x.year}-${String(x.month)}`, v: x.monthly_searches != null ? Number(x.monthly_searches) : null,
      })),
    });
  }
  console.log(`  ${out.historical.length} lignes recuperees`);
} catch (e) {
  const err = e?.errors?.[0];
  out.errors.push({ phase: "historical", error: JSON.stringify(err?.error_code ?? e?.message ?? e) });
  console.log("  ECHEC :", JSON.stringify(err?.error_code ?? e?.message));
}
save();

// Enchere de reference = mediane des high_top_of_page du portefeuille.
const highs = out.historical.map((h) => h.bidHigh).filter((v) => v != null && v > 0).sort((a, b) => a - b);
const medianHigh = highs.length ? highs[Math.floor(highs.length / 2)] : 2.5;
// MinCpcBidMicros EUR : tout montant en micros doit etre un multiple de 10 000.
// Sans cet arrondi, l API renvoie keyword_plan_idea_error UNKNOWN avec le message
// "Invalid BudgetMicro: budget[...] must be a multiple of MinCpcBidMicros[10000]".
const STEP = 10_000;
const round10k = (micros) => Math.max(STEP, Math.round(micros / STEP) * STEP);

const BID_TOP = round10k(medianHigh * 1e6);
const BID_DOM = round10k(medianHigh * 1.5 * 1e6);
out.meta.enchere_reference = { mediane_high_top_of_page: medianHigh, bid_haut_de_page: BID_TOP / 1e6, bid_domination: BID_DOM / 1e6 };
console.log(`\nEnchere mediane haut de page : ${medianHigh.toFixed(2)} EUR`);
console.log(`  strategie "Haut de page"  -> max_cpc ${(BID_TOP / 1e6).toFixed(2)} EUR`);
console.log(`  strategie "Domination"    -> max_cpc ${(BID_DOM / 1e6).toFixed(2)} EUR`);
save();

// ── Phase 2 : matrice multi-budgets ────────────────────────────────────────
const adGroups = [{
  keywords: PORTFOLIO.keywords.map((k) => ({
    text: k.text, match_type: enums.KeywordMatchType.PHRASE,
  })),
}];

function strategyFor(name, monthly) {
  const daily = round10k((monthly / 30.4) * 1e6);
  if (name === "Presence (maximisation des clics)") {
    return { maximize_clicks_bidding_strategy: { daily_target_spend_micros: daily } };
  }
  if (name === "Haut de page (CPC manuel)") {
    return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_TOP, daily_budget_micros: daily } };
  }
  return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_DOM, daily_budget_micros: daily } };
}

async function forecast(strategyName, monthly) {
  let wait = 25_000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await cust.keywordPlanIdeas.generateKeywordForecastMetrics({
        customer_id: MCC_ID,
        currency_code: "EUR",
        forecast_period: PERIOD,
        campaign: {
          language_constants: [LANG],
          geo_target_constants: GEO,
          bidding_strategy: strategyFor(strategyName, monthly),
          ad_groups: adGroups,
        },
      });
      const m = res?.campaign_forecast_metrics ?? {};
      return {
        ok: true,
        impressions: m.impressions != null ? Number(m.impressions) : null,
        clicks: m.clicks != null ? Number(m.clicks) : null,
        cost: m.cost_micros != null ? euros(m.cost_micros) : null,
        cpc: m.average_cpc_micros != null ? euros(m.average_cpc_micros) : null,
        ctr: m.click_through_rate != null ? Number(m.click_through_rate) : null,
        attempts: attempt,
      };
    } catch (e) {
      const err = e?.errors?.[0];
      const code = JSON.stringify(err?.error_code ?? e?.message ?? e);
      const msg = err?.message ?? String(e?.message ?? "");
      // UNKNOWN n est PAS retryable en soi : l API y loge aussi des erreurs de
      // validation. On ne rejoue que sur un vrai epuisement de quota.
      if (!/RESOURCE_EXHAUSTED|INTERNAL|DEADLINE/.test(code) || attempt === 6) {
        return { ok: false, error: code, message: msg, attempts: attempt };
      }
      console.log(`     quota — attente ${wait / 1000}s (essai ${attempt}/6) — ${msg}`);
      await sleep(wait);
      wait = Math.min(wait * 2, 180_000);
    }
  }
}

const STRATEGIES = [
  "Presence (maximisation des clics)",
  "Haut de page (CPC manuel)",
  "Domination (CPC manuel majore)",
];

console.log(`\nPhase 2 — matrice ${STRATEGIES.length} strategies x ${BUDGETS.length} paliers = ${STRATEGIES.length * BUDGETS.length} appels`);
for (const strategy of STRATEGIES) {
  console.log(`\n  ${strategy}`);
  for (const monthly of BUDGETS) {
    const r = await forecast(strategy, monthly);
    const row = { strategy, budget_mensuel: monthly, budget_journalier: +(monthly / 30.4).toFixed(2), ...r };
    out.matrix.push(row);
    if (!r.ok) out.errors.push({ phase: "forecast", strategy, budget: monthly, error: r.error });
    console.log(r.ok
      ? `    ${String(monthly).padStart(4)} EUR -> depense ${String(r.cost?.toFixed(2)).padStart(8)} · ${String(r.clicks?.toFixed(0)).padStart(5)} clics · ${String(r.impressions?.toFixed(0)).padStart(7)} impr. · CPC ${r.cpc?.toFixed(2)}`
      : `    ${String(monthly).padStart(4)} EUR -> ERREUR ${r.error}`);
    save();
    await sleep(9_000);
  }
}

save();
console.log(`\nTermine. ${out.matrix.filter((m) => m.ok).length}/${out.matrix.length} appels reussis, ${out.errors.length} erreur(s).`);
console.log(`JSON : ${OUT}`);

