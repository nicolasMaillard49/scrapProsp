/**
 * Audit GP elec — collecte Google Ads v2, complete (lecture seule).
 *
 * Ce que la passe du 31/07 ne faisait pas et que celle-ci fait :
 *   Phase 1  generateKeywordIdeas sur graines metier   -> decouverte, jamais appelee
 *   Phase 2  generateKeywordIdeas sur l URL du site    -> ce que Google comprend du site
 *   Phase 3  historical metrics du portefeuille exact  -> volumes/encheres rafraichis
 *   Phase 4  historical metrics des candidats decouverts absents du portefeuille
 *   Phase 5  matrice 3 strategies x 10 budgets         -> clics / cout / CPC
 *   Phase 6  forecast par famille de service           -> qui porte les clics
 *   Phase 7  generateAdGroupThemes                     -> structure de campagne
 *
 * NOTE API : KeywordForecastMetrics (v24) ne contient que average_cpc_micros,
 * clicks, cost_micros, conversions, average_cpa_micros. Ni impressions, ni CTR,
 * ni position. KeywordPlanService n expose plus que MutateKeywordPlans : la route
 * historique qui rendait les impressions n existe plus. Ne rien affirmer dessus.
 *
 *   node --import tsx scripts/audit-gp-elec-v2.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

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

const AUDIT = "D:/projets/audit/gpelec";
const OUT = `${AUDIT}/data/donnees-google-ads-brutes-2026-08-04.json`;
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const LANG = "languageConstants/1002";
const NETWORK = enums.KeywordPlanNetwork.GOOGLE_SEARCH;
const PERIOD = { start_date: "2026-09-01", end_date: "2026-09-30" };
const SITE = "https://gp-elec-49.com";
const COMMUNES = [
  "Angers", "Loire-Authion", "Trelaze", "Avrille", "Les Ponts-de-Ce",
  "Brissac Loire Aubance", "Saint-Barthelemy-d'Anjou", "Bouchemaine",
  "Verrieres-en-Anjou", "Beaufort-en-Anjou",
];
const BUDGETS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
const STRATEGIES = [
  "Presence (maximisation des clics)",
  "Haut de page (CPC manuel)",
  "Domination (CPC manuel majore)",
];
// KeywordSeed.keywords est plafonne a 20 par requete cote Google.
const SEED_BATCHES = [
  ["climatisation reversible", "installateur climatisation", "pompe a chaleur air air", "devis climatisation",
   "electricien", "electricien depannage", "depannage electrique", "urgence electricien",
   "entreprise electricite", "artisan electricien", "renovation electrique", "mise aux normes electrique",
   "consuel", "tableau electrique", "installation electrique maison", "electricite neuf",
   "domotique maison", "prise de courant", "eclairage interieur", "devis electricien"],
  ["borne de recharge voiture electrique", "installation borne de recharge", "electricien cuisine",
   "branchement plaque induction", "remplacement tableau electrique", "recherche de panne electrique",
   "interphone videophone", "alarme maison", "volet roulant electrique", "chauffe eau electrique",
   "radiateur electrique installation", "plancher chauffant electrique", "vmc installation",
   "tarif electricien heure", "prix installation electrique", "electricien pas cher",
   "depannage electrique 24h", "coupure electricite maison", "climatisation prix", "entretien climatisation"],
];

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / KeywordPlanIdeaService",
    appels: [
      "generateKeywordIdeas (keyword_seed)",
      "generateKeywordIdeas (url_seed)",
      "generateKeywordHistoricalMetrics (portefeuille)",
      "generateKeywordHistoricalMetrics (candidats decouverts)",
      "generateKeywordForecastMetrics (matrice budgets)",
      "generateKeywordForecastMetrics (par famille)",
      "generateAdGroupThemes",
    ],
    limite_api: "KeywordForecastMetrics v24 ne renvoie ni impressions, ni CTR, ni position moyenne. KeywordPlanService n expose plus que MutateKeywordPlans. Aucune route API ne donne les impressions previsionnelles.",
    langue: LANG,
    reseau: "GOOGLE_SEARCH",
    devise: "EUR",
    periode_forecast: PERIOD,
    url_seed: SITE,
    communes: COMMUNES,
    budgets: BUDGETS,
    strategies: STRATEGIES,
  },
  geo: [],
  ideas_seed: [],
  ideas_url: [],
  historical: [],
  historical_candidats: [],
  matrix: [],
  familles: [],
  themes: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));
const fail = (phase, e, extra = {}) => {
  const err = e?.errors?.[0];
  const row = { phase, ...extra, code: JSON.stringify(err?.error_code ?? e?.message ?? e), message: err?.message ?? String(e?.message ?? e) };
  out.errors.push(row);
  console.log(`  ECHEC ${phase} : ${row.code} — ${row.message}`);
  save();
};

const COMP = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte", 2: "faible", 3: "moyenne", 4: "forte" };
// Google renvoie keyword_metrics/keyword_idea_metrics a NULL sur les mots-cles
// sans donnee (non eligibles, volume masque). Un defaut de parametre ne couvre
// que undefined : il faut normaliser null explicitement, sinon la phase entiere
// leve et on perd toutes les lignes deja mappees.
const mapMetrics = (raw) => ((m) => ({
  vol: m.avg_monthly_searches != null ? Number(m.avg_monthly_searches) : null,
  comp: COMP[m.competition] ?? null,
  compIndex: m.competition_index != null ? Number(m.competition_index) : null,
  bidLow: m.low_top_of_page_bid_micros != null ? euros(m.low_top_of_page_bid_micros) : null,
  bidHigh: m.high_top_of_page_bid_micros != null ? euros(m.high_top_of_page_bid_micros) : null,
  months: (m.monthly_search_volumes ?? []).map((x) => ({
    m: `${x.year}-${String(x.month)}`, v: x.monthly_searches != null ? Number(x.monthly_searches) : null,
  })),
}))(raw || {});

// ── Phase 0 : geo ──────────────────────────────────────────────────────────
console.log("Phase 0 — resolution geographique");
for (const c of COMMUNES) {
  const g = await resolveGeoTargetConstant(cust, c);
  if (g) out.geo.push({ commune: c, geo: g });
  else out.errors.push({ phase: "geo", commune: c, code: "NON_RESOLU", message: "aucune suggestion" });
}
const GEO = out.geo.map((g) => g.geo);
console.log(`  ${GEO.length}/${COMMUNES.length} communes resolues`);
save();

// ── Phase 1 : decouverte par graines metier ────────────────────────────────
console.log(`\nPhase 1 — generateKeywordIdeas, ${SEED_BATCHES.length} lots de graines`);
for (const [i, seeds] of SEED_BATCHES.entries()) {
  try {
    const res = await cust.keywordPlanIdeas.generateKeywordIdeas({
      customer_id: MCC_ID,
      language: LANG,
      geo_target_constants: GEO,
      keyword_plan_network: NETWORK,
      include_adult_keywords: false,
      keyword_seed: { keywords: seeds },
    });
    const rows = res?.results ?? (Array.isArray(res) ? res : []);
    for (const r of rows) {
      out.ideas_seed.push({
        text: r.text ?? "", lot: i + 1,
        closeVariants: r.close_variants ?? [],
        ...mapMetrics(r.keyword_idea_metrics),
      });
    }
    console.log(`  lot ${i + 1} (${seeds.length} graines) -> ${rows.length} idees`);
  } catch (e) { fail("ideas_seed", e, { lot: i + 1 }); }
  save();
  await sleep(6_000);
}

// ── Phase 2 : decouverte par l URL du site ─────────────────────────────────
console.log(`\nPhase 2 — generateKeywordIdeas sur ${SITE}`);
try {
  const res = await cust.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: MCC_ID,
    language: LANG,
    geo_target_constants: GEO,
    keyword_plan_network: NETWORK,
    include_adult_keywords: false,
    url_seed: { url: SITE },
  });
  const rows = res?.results ?? (Array.isArray(res) ? res : []);
  for (const r of rows) {
    out.ideas_url.push({ text: r.text ?? "", closeVariants: r.close_variants ?? [], ...mapMetrics(r.keyword_idea_metrics) });
  }
  console.log(`  ${rows.length} idees deduites du site`);
} catch (e) { fail("ideas_url", e); }
save();
await sleep(6_000);

// ── Phase 3 : metriques historiques du portefeuille exact ──────────────────
const KEYWORDS = PORTFOLIO.keywords.map((k) => k.text);
const FAMILLE_OF = Object.fromEntries(PORTFOLIO.keywords.map((k) => [norm(k.text), k.famille]));
console.log(`\nPhase 3 — historical metrics du portefeuille (${KEYWORDS.length} mots-cles)`);
try {
  const res = await cust.keywordPlanIdeas.generateKeywordHistoricalMetrics({
    customer_id: MCC_ID,
    keywords: KEYWORDS,
    language: LANG,
    geo_target_constants: GEO,
    keyword_plan_network: NETWORK,
    include_adult_keywords: false,
  });
  const rows = res?.results ?? (Array.isArray(res) ? res : []);
  for (const r of rows) {
    out.historical.push({
      text: r.text ?? "",
      famille: FAMILLE_OF[norm(r.text)] ?? null,
      closeVariants: r.close_variants ?? [],
      ...mapMetrics(r.keyword_metrics),
    });
  }
  console.log(`  ${out.historical.length} lignes canoniques, volume cumule ${out.historical.reduce((a, k) => a + (k.vol || 0), 0)}`);
} catch (e) { fail("historical", e); }
save();
await sleep(6_000);

// ── Phase 4 : candidats decouverts absents du portefeuille ─────────────────
const known = new Set();
for (const k of KEYWORDS) known.add(norm(k));
for (const h of out.historical) { known.add(norm(h.text)); for (const v of h.closeVariants) known.add(norm(v)); }
// Bruit a ecarter : marques, occasion, gratuit, emploi, formation, DIY, produit nu.
const NOISE = /\b(emploi|recrutement|salaire|formation|cap |bts |stage|occasion|gratuit|leroy merlin|castorama|brico|amazon|darty|boulanger|but |conforama|ikea|pdf|schema|cours|def |wikipedia|jeu|film)\b/;
const candidats = [...new Map(
  [...out.ideas_seed, ...out.ideas_url]
    .filter((k) => k.vol && k.vol >= 30 && !known.has(norm(k.text)) && !NOISE.test(norm(k.text)))
    .sort((a, b) => b.vol - a.vol)
    .map((k) => [norm(k.text), k]),
).values()].slice(0, 80);
console.log(`\nPhase 4 — ${candidats.length} candidats hors portefeuille (vol >= 30)`);
if (candidats.length) {
  try {
    const res = await cust.keywordPlanIdeas.generateKeywordHistoricalMetrics({
      customer_id: MCC_ID,
      keywords: candidats.map((c) => c.text),
      language: LANG,
      geo_target_constants: GEO,
      keyword_plan_network: NETWORK,
      include_adult_keywords: false,
    });
    const rows = res?.results ?? (Array.isArray(res) ? res : []);
    for (const r of rows) {
      out.historical_candidats.push({ text: r.text ?? "", closeVariants: r.close_variants ?? [], ...mapMetrics(r.keyword_metrics) });
    }
    console.log(`  ${out.historical_candidats.length} lignes canoniques, volume cumule ${out.historical_candidats.reduce((a, k) => a + (k.vol || 0), 0)}`);
  } catch (e) { fail("historical_candidats", e); }
}
save();
await sleep(6_000);

// ── Encheres de reference ──────────────────────────────────────────────────
const highs = out.historical.map((h) => h.bidHigh).filter((v) => v != null && v > 0).sort((a, b) => a - b);
const medianHigh = highs.length ? highs[Math.floor(highs.length / 2)] : 2.5;
// MinCpcBidMicros EUR : tout montant en micros doit etre un multiple de 10 000.
// Sans cet arrondi l API repond keyword_plan_idea_error UNKNOWN, qui masque en
// realite "must be a multiple of MinCpcBidMicros". UNKNOWN n est donc PAS retryable.
const STEP = 10_000;
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
console.log(`  Haut de page -> max_cpc ${(BID_TOP / 1e6).toFixed(2)} EUR · Domination -> ${(BID_DOM / 1e6).toFixed(2)} EUR`);
save();

// ── Forecast ───────────────────────────────────────────────────────────────
const adGroupsFrom = (keywords) => [{
  keywords: keywords.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })),
}];
const ALL_KW = PORTFOLIO.keywords.map((k) => k.text);

function strategyFor(name, monthly) {
  const daily = round10k((monthly / 30.4) * 1e6);
  if (name === STRATEGIES[0]) return { maximize_clicks_bidding_strategy: { daily_target_spend_micros: daily } };
  if (name === STRATEGIES[1]) return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_TOP, daily_budget_micros: daily } };
  return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_DOM, daily_budget_micros: daily } };
}

async function forecast(strategyName, monthly, keywords) {
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
          ad_groups: adGroupsFrom(keywords),
        },
      });
      const m = res?.campaign_forecast_metrics ?? {};
      return {
        ok: true,
        clicks: m.clicks != null ? Number(m.clicks) : null,
        cost: m.cost_micros != null ? euros(m.cost_micros) : null,
        cpc: m.average_cpc_micros != null ? euros(m.average_cpc_micros) : null,
        impressions: null, ctr: null, // non renvoyes par l API v24 — voir meta.limite_api
        attempts: attempt,
      };
    } catch (e) {
      const err = e?.errors?.[0];
      const code = JSON.stringify(err?.error_code ?? e?.message ?? e);
      const msg = err?.message ?? String(e?.message ?? "");
      if (!/RESOURCE_EXHAUSTED|INTERNAL|DEADLINE/.test(code) || attempt === 6) {
        return { ok: false, error: code, message: msg, attempts: attempt };
      }
      console.log(`     quota — attente ${wait / 1000}s (essai ${attempt}/6) — ${msg}`);
      await sleep(wait);
      wait = Math.min(wait * 2, 180_000);
    }
  }
}

// ── Phase 5 : matrice multi-budgets ────────────────────────────────────────
console.log(`\nPhase 5 — matrice ${STRATEGIES.length} x ${BUDGETS.length} = ${STRATEGIES.length * BUDGETS.length} forecasts`);
for (const strategy of STRATEGIES) {
  console.log(`\n  ${strategy}`);
  for (const monthly of BUDGETS) {
    const r = await forecast(strategy, monthly, ALL_KW);
    out.matrix.push({ strategy, budget_mensuel: monthly, budget_journalier: +(monthly / 30.4).toFixed(2), ...r });
    if (!r.ok) out.errors.push({ phase: "forecast", strategy, budget: monthly, code: r.error, message: r.message });
    console.log(r.ok
      ? `    ${String(monthly).padStart(4)} EUR -> depense ${String(r.cost?.toFixed(2)).padStart(8)} · ${String(r.clicks?.toFixed(0)).padStart(5)} clics · CPC ${r.cpc?.toFixed(2)}`
      : `    ${String(monthly).padStart(4)} EUR -> ERREUR ${r.error}`);
    save();
    await sleep(9_000);
  }
}

// ── Phase 6 : forecast par famille de service ──────────────────────────────
const REF_BUDGET = 200;
const REF_STRAT = STRATEGIES[1];
console.log(`\nPhase 6 — forecast par famille (${REF_STRAT}, ${REF_BUDGET} EUR)`);
for (const [code, label] of Object.entries(PORTFOLIO.familles)) {
  const kws = PORTFOLIO.keywords.filter((k) => k.famille === code).map((k) => k.text);
  if (!kws.length) continue;
  const r = await forecast(REF_STRAT, REF_BUDGET, kws);
  out.familles.push({ code, label, mots_cles: kws.length, strategy: REF_STRAT, budget_mensuel: REF_BUDGET, ...r });
  if (!r.ok) out.errors.push({ phase: "famille", famille: code, code: r.error, message: r.message });
  console.log(r.ok
    ? `  ${code} ${label.padEnd(42)} ${String(kws.length).padStart(2)} kw -> ${String(r.cost?.toFixed(2)).padStart(7)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
    : `  ${code} ERREUR ${r.error}`);
  save();
  await sleep(9_000);
}

// ── Phase 7 : abandonnee ───────────────────────────────────────────────────
// generateAdGroupThemes repartit des mots-cles dans des groupes d annonces DEJA
// crees : "Field 'ad_groups' is required for 'theming' operation". Sans compte
// client ni campagne existante, l appel n a pas d objet. La repartition par
// famille de service (phase 6) couvre le meme besoin sans rien ecrire.
out.meta.themes_non_appele = "generateAdGroupThemes exige des ad_groups existants (REQUIRED_FIELD_MISSING). Sans campagne creee, l appel est sans objet ; la phase 6 le remplace.";
save();

// ── Bilan ──────────────────────────────────────────────────────────────────
const okMatrix = out.matrix.filter((m) => m.ok).length;
console.log(`\n=== Termine ===`);
console.log(`  idees graines        ${out.ideas_seed.length}`);
console.log(`  idees URL            ${out.ideas_url.length}`);
console.log(`  portefeuille         ${out.historical.length} canoniques, ${out.historical.reduce((a, k) => a + (k.vol || 0), 0)} recherches/mois`);
console.log(`  candidats manquants  ${out.historical_candidats.length} canoniques, ${out.historical_candidats.reduce((a, k) => a + (k.vol || 0), 0)} recherches/mois`);
console.log(`  matrice              ${okMatrix}/${out.matrix.length}`);
console.log(`  familles             ${out.familles.filter((f) => f.ok).length}/${out.familles.length}`);
console.log(`  themes               ${out.themes.length}`);
console.log(`  erreurs              ${out.errors.length}`);
console.log(`  JSON : ${OUT}`);
