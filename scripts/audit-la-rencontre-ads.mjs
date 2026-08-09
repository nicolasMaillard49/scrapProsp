/**
 * Audit Restaurant La Rencontre (Bordeaux) — collecte Google Ads en lecture seule.
 *
 *   Phase 0 : resolution des zones geographiques (Bordeaux + premiere couronne).
 *   Phase 1 : metriques historiques du portefeuille exact.
 *   Phase 2 : matrice multi-budgets, 3 strategies x 10 paliers = 30 appels forecast.
 *   Phase 3 : idees de mots-cles Google sur graines "diner gastronomique" (controle
 *             de couverture du portefeuille, non injecte dans le forecast).
 *
 * Ecrit au fil de l'eau pour ne rien perdre en cas de coupure.
 *   node --import tsx scripts/audit-la-rencontre-ads.mjs
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

const DIR = "D:/projets/audit/la-rencontre/data";
const OUT = `${DIR}/donnees-google-ads-brutes.json`;
const PORTFOLIO = JSON.parse(readFileSync(`${DIR}/portefeuille-mots-cles.json`, "utf8"));

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;

const LANG = "languageConstants/1002";
const PERIOD = { start_date: "2026-09-01", end_date: "2026-09-30" };
const COMMUNES = [
  "Bordeaux", "Merignac", "Pessac", "Talence", "Begles",
  "Le Bouscat", "Bruges", "Villenave-d'Ornon", "Cenon", "Floirac",
];
const BUDGETS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];

const out = {
  meta: {
    client: "Restaurant La Rencontre",
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api / KeywordPlanIdeaService",
    langue: LANG,
    langue_libelle: "Francais",
    reseau: "GOOGLE_SEARCH",
    devise: "EUR",
    periode_forecast: PERIOD,
    communes: COMMUNES,
    budgets: BUDGETS,
    nb_mots_cles: PORTFOLIO.keywords.length,
  },
  geo: [],
  historical: [],
  matrix: [],
  ideas: [],
  errors: [],
};
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

// ── Phase 0 : zones geographiques ──────────────────────────────────────────
for (const c of COMMUNES) {
  try {
    const res = await cust.geoTargetConstants.suggestGeoTargetConstants({
      locale: "fr", country_code: "FR", location_names: { names: [c] },
    });
    const s = (res?.geo_target_constant_suggestions ?? [])[0]?.geo_target_constant;
    if (s?.resource_name) {
      out.geo.push({
        commune: c, geo: s.resource_name, nom_google: s.name ?? null,
        type: s.target_type ?? null, statut: s.status ?? null,
      });
      console.log(`  ${c.padEnd(22)} -> ${s.resource_name}  (${s.name} / ${s.target_type})`);
    } else {
      out.errors.push({ phase: "geo", commune: c, error: "NON_RESOLU" });
      console.log(`  ${c.padEnd(22)} -> NON RESOLU`);
    }
  } catch (e) {
    out.errors.push({ phase: "geo", commune: c, error: String(e?.message ?? e) });
  }
}
const GEO = out.geo.map((g) => g.geo);
console.log(`\nGeo : ${GEO.length}/${COMMUNES.length} communes resolues`);
save();

// ── Phase 1 : metriques historiques du portefeuille exact ──────────────────
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
  out.errors.push({ phase: "historical", error: JSON.stringify(err?.error_code ?? e?.message ?? e), message: err?.message ?? String(e?.message ?? "") });
  console.log("  ECHEC :", err?.message ?? e?.message);
}
save();

// Enchere de reference = mediane des high_top_of_page du portefeuille.
const highs = out.historical.map((h) => h.bidHigh).filter((v) => v != null && v > 0).sort((a, b) => a - b);
const medianHigh = highs.length ? highs[Math.floor(highs.length / 2)] : 1.5;
const STEP = 10_000; // MinCpcBidMicros EUR : tout montant doit etre un multiple de 10 000.
const round10k = (micros) => Math.max(STEP, Math.round(micros / STEP) * STEP);

const BID_TOP = round10k(medianHigh * 1e6);
const BID_DOM = round10k(medianHigh * 1.5 * 1e6);
out.meta.enchere_reference = {
  mediane_high_top_of_page: medianHigh,
  bid_haut_de_page: BID_TOP / 1e6,
  bid_domination: BID_DOM / 1e6,
  echantillon: highs.length,
};
console.log(`\nEnchere mediane haut de page : ${medianHigh.toFixed(2)} EUR (n=${highs.length})`);
console.log(`  "Haut de page"  -> max_cpc ${(BID_TOP / 1e6).toFixed(2)} EUR`);
console.log(`  "Domination"    -> max_cpc ${(BID_DOM / 1e6).toFixed(2)} EUR`);
save();

// ── Phase 2 : matrice multi-budgets ────────────────────────────────────────
const adGroups = [{
  keywords: PORTFOLIO.keywords.map((k) => ({ text: k.text, match_type: enums.KeywordMatchType.PHRASE })),
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
      // UNKNOWN n'est PAS retryable : l'API y loge aussi des erreurs de validation.
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

console.log(`\nPhase 2 — matrice ${STRATEGIES.length} x ${BUDGETS.length} = ${STRATEGIES.length * BUDGETS.length} appels`);
for (const strategy of STRATEGIES) {
  console.log(`\n  ${strategy}`);
  for (const monthly of BUDGETS) {
    const r = await forecast(strategy, monthly);
    out.matrix.push({ strategy, budget_mensuel: monthly, budget_journalier: +(monthly / 30.4).toFixed(2), ...r });
    if (!r.ok) out.errors.push({ phase: "forecast", strategy, budget: monthly, error: r.error, message: r.message });
    console.log(r.ok
      ? `    ${String(monthly).padStart(4)} EUR -> depense ${String(r.cost?.toFixed(2)).padStart(8)} · ${String(r.clicks?.toFixed(0)).padStart(5)} clics · ${String(r.impressions?.toFixed(0)).padStart(7)} impr. · CPC ${r.cpc?.toFixed(2)}`
      : `    ${String(monthly).padStart(4)} EUR -> ERREUR ${r.error}`);
    save();
    await sleep(9_000);
  }
}

// ── Phase 3 : idees Google (controle de couverture) ────────────────────────
console.log(`\nPhase 3 — idees de mots-cles Google (controle de couverture)`);
try {
  const res = await cust.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: MCC_ID,
    language: LANG,
    geo_target_constants: GEO,
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
    keyword_and_url_seed: {
      url: "https://restaurantlarencontre.com/",
      keywords: [
        "restaurant gastronomique bordeaux", "diner bordeaux",
        "restaurant italien bordeaux", "reserver restaurant bordeaux",
      ],
    },
  });
  const rows = res?.results ?? (Array.isArray(res) ? res : []);
  const COMP = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte", 2: "faible", 3: "moyenne", 4: "forte" };
  for (const r of rows) {
    const m = r.keyword_idea_metrics ?? {};
    out.ideas.push({
      text: r.text ?? "",
      vol: m.avg_monthly_searches != null ? Number(m.avg_monthly_searches) : null,
      comp: COMP[m.competition] ?? null,
      bidLow: m.low_top_of_page_bid_micros != null ? euros(m.low_top_of_page_bid_micros) : null,
      bidHigh: m.high_top_of_page_bid_micros != null ? euros(m.high_top_of_page_bid_micros) : null,
    });
  }
  out.ideas.sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0));
  console.log(`  ${out.ideas.length} idees recuperees`);
} catch (e) {
  const err = e?.errors?.[0];
  out.errors.push({ phase: "ideas", error: JSON.stringify(err?.error_code ?? e?.message ?? e), message: err?.message ?? String(e?.message ?? "") });
  console.log("  ECHEC :", err?.message ?? e?.message);
}

save();
console.log(`\nTermine. ${out.matrix.filter((m) => m.ok).length}/${out.matrix.length} forecasts OK, ${out.errors.length} erreur(s).`);
console.log(`JSON : ${OUT}`);
