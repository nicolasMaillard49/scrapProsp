/**
 * GP elec — complement a la passe "zone Brissac-Angers" du 02/09.
 *
 * Deux trous a boucher, tous deux causes par la meme decouverte :
 *
 *   generateKeywordHistoricalMetrics REFUSE 20 geo_target_constants
 *   -> keyword_plan_idea_error: INVALID_VALUE
 *
 * Le dossier affirmait depuis le 05/08 que seul generateKeywordIdeas plafonnait a
 * 10 cibles et que generateKeywordForecastMetrics en acceptait 20. C'est exact,
 * mais incomplet : l'appel HISTORIQUE est plafonne a 10 lui aussi. Les 20 cibles
 * ne valent que pour la prevision.
 *
 * Consequences reparees ici :
 *
 *   Phase 1  l'enchere de reference n'avait pas pu etre derivee du marche, le
 *            script est tombe sur son defaut de 2,50 EUR — et les 8 familles ont
 *            donc ete mesurees a une enchere arbitraire. On les refait a
 *            1,92 EUR, l'enchere du departement mesuree le meme jour sur un
 *            SUR-ENSEMBLE de la zone retenue, deja utilisee par les deux autres
 *            zones : les trois deviennent comparables a variable unique.
 *
 *   Phase 2  le volume de recherches de la zone retenue n'est pas mesurable
 *            directement (20 cibles refusees). On mesure la borne basse a date :
 *            les dix communes aujourd'hui. La borne haute est le departement,
 *            deja mesure (5 670). Le chiffre de la zone est entre les deux et
 *            doit etre presente comme tel, jamais comme une mesure.
 *
 * Lecture seule : aucune campagne, aucun plan, rien n'est cree cote Google.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-v3-zone-complement.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

/** .env.local du checkout + bloc GOOGLE_ADS_* du vault (absents du .env.local ici). */
const loadEnv = (path, filter = () => true) => {
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return 0; }
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(k) || !filter(k)) continue;
    if (process.env[k] === undefined) { process.env[k] = v; n++; }
  }
  return n;
};
loadEnv(new URL("../.env.local", import.meta.url));
const fromVault = loadEnv("C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md", (k) => k.startsWith("GOOGLE_ADS_"));
console.log(`Credentials : ${fromVault} variables GOOGLE_ADS_* reprises du vault`);

const { enums } = await import("google-ads-api");
const { mccCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");

const AUDIT = "C:/Users/n.maillard/audit-nmf/gpelec";
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const ZONE = JSON.parse(readFileSync(`${AUDIT}/data/donnees-zone-brissac-angers-2026-09-02.json`, "utf8"));
const OUT = `${AUDIT}/data/zone-complement-2026-09-02.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const STEP = 10_000;
const round10k = (micros) => Math.max(STEP, Math.round(micros / STEP) * STEP);

const LANG = "languageConstants/1002";
const NETWORK = enums.KeywordPlanNetwork.GOOGLE_SEARCH;
const PERIOD = { start_date: "2026-09-03", end_date: "2026-10-02" };
const BID = round10k(1.92 * 1e6);

/* Les 20 cibles de la zone retenue, reprises telles quelles de la passe du 02/09. */
const GEO_ZONE = ZONE.geo.map((g) => g.geo);
/* Les dix communes de l'audit : le maximum que l'appel historique accepte. */
const GEO_DIX = ZONE.geo.slice(0, 10).map((g) => g.geo);
const NOM_DIX = ZONE.geo.slice(0, 10).map((g) => g.commune);

const KEYWORDS = PORTFOLIO.keywords.map((k) => k.text);
const FAMILLE_OF = Object.fromEntries(PORTFOLIO.keywords.map((k) => [norm(k.text), k.famille]));

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24",
    role: "complement de la passe zone Brissac-Angers : familles a l'enchere comparable, et borne basse de volume",
    decouverte_api: "generateKeywordHistoricalMetrics refuse 20 geo_target_constants (INVALID_VALUE). Le plafond de 10 vaut pour l'appel historique comme pour generateKeywordIdeas ; seul generateKeywordForecastMetrics accepte 20.",
    enchere: BID / 1e6,
    enchere_pourquoi: "mediane des encheres hautes mesuree sur le DEPARTEMENT le 02/09, sur-ensemble de la zone retenue. Elle ne peut pas etre mesuree sur les 20 cibles ; la retenir rend les trois zones comparables a variable unique.",
    zone_previsions: `${GEO_ZONE.length} cibles — la zone retenue`,
    zone_volumes: `${GEO_DIX.length} cibles — borne basse, les dix premieres de la zone`,
    borne_haute_volume: "5 670 recherches/mois sur le departement (donnees-google-ads-brutes-2026-09-02.json)",
    langue: LANG, reseau: "GOOGLE_SEARCH", devise: "EUR",
    periode_forecast: PERIOD, correspondance: "PHRASE",
    limite_api: "KeywordForecastMetrics v24 ne renvoie ni impressions, ni CTR, ni position moyenne.",
  },
  communes_volumes: NOM_DIX,
  historical_dix: [],
  enchere_dix: null,
  familles_zone: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

const COMP = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte", 2: "faible", 3: "moyenne", 4: "forte" };
// keyword_metrics peut etre NULL : normaliser explicitement.
const mapMetrics = (raw) => ((m) => ({
  vol: m.avg_monthly_searches != null ? Number(m.avg_monthly_searches) : null,
  comp: COMP[m.competition] ?? null,
  bidLow: m.low_top_of_page_bid_micros != null ? euros(m.low_top_of_page_bid_micros) : null,
  bidHigh: m.high_top_of_page_bid_micros != null ? euros(m.high_top_of_page_bid_micros) : null,
  months: (m.monthly_search_volumes ?? []).map((x) => ({
    m: `${x.year}-${String(x.month)}`, v: x.monthly_searches != null ? Number(x.monthly_searches) : null,
  })),
}))(raw || {});

// ── Phase 1 : volumes du jour sur dix cibles (borne basse) ─────────────────
console.log(`Phase 1 — historical metrics sur ${GEO_DIX.length} cibles (le maximum accepte)`);
console.log(`  ${NOM_DIX.join(", ")}`);
try {
  const res = await cust.keywordPlanIdeas.generateKeywordHistoricalMetrics({
    customer_id: MCC_ID,
    keywords: KEYWORDS,
    language: LANG,
    geo_target_constants: GEO_DIX,
    keyword_plan_network: NETWORK,
    include_adult_keywords: false,
  });
  const rows = res?.results ?? (Array.isArray(res) ? res : []);
  for (const r of rows) {
    out.historical_dix.push({
      text: r.text ?? "",
      famille: FAMILLE_OF[norm(r.text)] ?? null,
      closeVariants: r.close_variants ?? [],
      ...mapMetrics(r.keyword_metrics),
    });
  }
  const vol = out.historical_dix.reduce((a, k) => a + (k.vol || 0), 0);
  const highs = out.historical_dix.map((h) => h.bidHigh).filter((v) => v != null && v > 0).sort((a, b) => a - b);
  out.enchere_dix = {
    mediane_high_top_of_page: highs.length ? highs[Math.floor(highs.length / 2)] : null,
    echantillon: highs.length,
  };
  console.log(`  ${out.historical_dix.length} lignes canoniques, volume cumule ${vol}`);
  console.log(`  enchere mediane haut de page : ${out.enchere_dix.mediane_high_top_of_page?.toFixed(2)} EUR (n=${highs.length})`);
} catch (e) {
  const err = e?.errors?.[0];
  out.errors.push({ phase: "historical_dix", code: JSON.stringify(err?.error_code ?? e?.message ?? e), message: err?.message ?? String(e?.message ?? e) });
  console.log(`  ECHEC : ${out.errors.at(-1).message}`);
}
save();
await sleep(6_000);

// ── Phase 2 : capacite par famille sur la zone retenue, a 1,92 EUR ─────────
const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];

async function forecast(monthly, keywords) {
  let wait = 25_000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await cust.keywordPlanIdeas.generateKeywordForecastMetrics({
        customer_id: MCC_ID,
        currency_code: "EUR",
        forecast_period: PERIOD,
        campaign: {
          language_constants: [LANG],
          geo_target_constants: GEO_ZONE,
          keyword_plan_network: NETWORK,
          bidding_strategy: {
            manual_cpc_bidding_strategy: {
              max_cpc_bid_micros: BID,
              daily_budget_micros: round10k((monthly / 30.4) * 1e6),
            },
          },
          ad_groups: adGroupsFrom(keywords),
        },
      });
      const m = res?.campaign_forecast_metrics ?? {};
      return {
        ok: true,
        clicks: m.clicks != null ? Number(m.clicks) : null,
        cost: m.cost_micros != null ? euros(m.cost_micros) : null,
        cpc: m.average_cpc_micros != null ? euros(m.average_cpc_micros) : null,
        attempts: attempt,
      };
    } catch (e) {
      const err = e?.errors?.[0];
      const code = JSON.stringify(err?.error_code ?? e?.message ?? e);
      const msg = err?.message ?? String(e?.message ?? "");
      // UNKNOWN est une erreur de validation deguisee : ne jamais rejouer dessus.
      if (!/RESOURCE_EXHAUSTED|INTERNAL|DEADLINE/.test(code) || attempt === 6) {
        return { ok: false, error: code, message: msg, attempts: attempt };
      }
      console.log(`     quota — attente ${wait / 1000}s (essai ${attempt}/6)`);
      await sleep(wait);
      wait = Math.min(wait * 2, 180_000);
    }
  }
}

console.log(`\nPhase 2 — capacite par famille sur ${GEO_ZONE.length} cibles, 200 EUR, ${(BID / 1e6).toFixed(2)} EUR`);
for (const [code, label] of Object.entries(PORTFOLIO.familles)) {
  const kws = PORTFOLIO.keywords.filter((k) => k.famille === code).map((k) => k.text);
  if (!kws.length) continue;
  const r = await forecast(200, kws);
  out.familles_zone.push({ code, label, mots_cles: kws.length, budget_mensuel: 200, enchere: BID / 1e6, ...r });
  if (!r.ok) out.errors.push({ phase: "famille", famille: code, code: r.error, message: r.message });
  console.log(r.ok
    ? `  ${code} ${String(label).padEnd(42)} ${String(kws.length).padStart(2)} kw -> ${String(r.cost?.toFixed(2)).padStart(7)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
    : `  ${code} ERREUR ${r.error}`);
  save();
  await sleep(6_000);
}

save();
console.log(`\nTermine — ${out.historical_dix.length} lignes historiques, ${out.familles_zone.length} familles, ${out.errors.length} erreur(s)`);
console.log(OUT);
