/**
 * GP elec — LA BASE CHIFFREE DES TROIS LIVRABLES. Zone retenue, enchere mesuree.
 *
 * Zone : agglomeration d'Angers + couronne jusqu'a Brissac, Chalonnes, Seiches,
 * Beaufort et Saint-Georges — 20 cibles, arretees avec le client le 02/09.
 * Le controle du meme jour a montre pourquoi ni l'un ni l'autre extreme :
 *
 *   dix communes  360,77 EUR / 360 clics de plafond — trop etroit des 360 EUR
 *   zone retenue  447,78 EUR / 437 clics            — a 1,92 EUR
 *   departement   720,42 EUR / 686 clics            — mais arrose Cholet et Saumur
 *
 * et surtout : a 200 EUR/mois les trois zones rendent la meme chose a 5 % pres.
 * Le choix de zone est un choix de PLAFOND DE BUDGET, pas de trafic.
 *
 * ENCHERE. Elle n'est pas un parametre libre : c'est la mediane des encheres
 * hautes du portefeuille. Elle ne peut pas etre mesuree sur les 20 cibles —
 * generateKeywordHistoricalMetrics refuse plus de 10 geo_target_constants
 * (INVALID_VALUE, mesure du 02/09) ; seul le forecast en accepte 20. On l'encadre
 * donc par deux mesures du jour :
 *
 *   1,92 EUR  mediane sur le departement, sur-ensemble de la zone
 *   2,12 EUR  mediane sur les dix cibles du coeur de la zone, sous-ensemble
 *
 * La vraie valeur est entre les deux. On retient 2,12 EUR : le departement dilue
 * avec des encheres rurales moins cheres que celles reellement affrontees autour
 * d'Angers. Retenir la borne basse sous-estimerait le niveau de concurrence.
 *
 * Lecture seule : aucune campagne, aucun plan, rien n'est cree cote Google.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-v3-base-livrables.mjs
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
const COMPL = JSON.parse(readFileSync(`${AUDIT}/data/zone-complement-2026-09-02.json`, "utf8"));
const OUT = `${AUDIT}/data/base-livrables-2026-09-02.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const STEP = 10_000;
const round10k = (micros) => Math.max(STEP, Math.round(micros / STEP) * STEP);

const LANG = "languageConstants/1002";
const NETWORK = enums.KeywordPlanNetwork.GOOGLE_SEARCH;
const PERIOD = { start_date: "2026-09-03", end_date: "2026-10-02" };
const BUDGETS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
const STRATEGIES = [
  "Presence (maximisation des clics)",
  "Haut de page (CPC manuel)",
  "Domination (CPC manuel majore)",
];

const GEO = ZONE.geo.map((g) => g.geo);
const MEDIANE_COEUR = COMPL.enchere_dix?.mediane_high_top_of_page ?? 2.12;
const BID_TOP = round10k(MEDIANE_COEUR * 1e6);
const BID_DOM = round10k(MEDIANE_COEUR * 1.5 * 1e6);
const KEYWORDS = PORTFOLIO.keywords.map((k) => k.text);

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / generateKeywordForecastMetrics",
    role: "base chiffree des trois livrables",
    zone_label: "Agglomeration d'Angers + couronne jusqu'a Brissac, Chalonnes, Seiches, Beaufort et Saint-Georges",
    zone_cibles: ZONE.geo.map((g) => g.commune),
    zone_couvertes_sans_cible: ZONE.zone.doublons,
    zone_hors_perimetre: ZONE.zone.ecartees_par_troncature.map((e) => e.commune),
    zone_non_resolue: ZONE.zone.non_resolues,
    zone_pourquoi: "A 200 EUR/mois les trois zones testees rendent la meme chose a 5 % pres (197 / 192 / 188 clics). Elles ne different que par le plafond d'inventaire : 360,77 / 447,78 / 720,42 EUR. Le choix de zone est un choix de plafond de budget.",
    enchere_reference: {
      retenue: BID_TOP / 1e6,
      domination: BID_DOM / 1e6,
      methode: "mediane des encheres hautes haut de page du portefeuille",
      mesuree_sur: "les 10 cibles du coeur de la zone, 02/09 (n=" + (COMPL.enchere_dix?.echantillon ?? "?") + ")",
      encadrement: { departement_sur_ensemble: 1.92, coeur_de_zone_sous_ensemble: MEDIANE_COEUR },
      limite: "generateKeywordHistoricalMetrics refuse 20 geo_target_constants (INVALID_VALUE) : la mediane de la zone entiere n'est pas mesurable. Elle est encadree par les deux valeurs ci-dessus.",
    },
    volume_marche: {
      coeur_de_zone_10_cibles: COMPL.historical_dix.reduce((a, k) => a + (k.vol || 0), 0),
      departement: 5670,
      note: "Le volume de la zone a 20 cibles n'est pas mesurable (meme limite). Il est encadre par ces deux valeurs, il ne doit jamais etre presente comme une mesure.",
    },
    limite_api: "KeywordForecastMetrics v24 ne renvoie ni impressions, ni CTR, ni position moyenne. Aucun livrable ne doit annoncer d'impressions ni de position.",
    langue: LANG, reseau: "GOOGLE_SEARCH", devise: "EUR",
    periode_forecast: PERIOD, correspondance: "PHRASE",
    budgets: BUDGETS, strategies: STRATEGIES,
  },
  matrix: [],
  familles: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];

const biddingFor = (name, monthly) => {
  const daily = round10k((monthly / 30.4) * 1e6);
  if (name === STRATEGIES[0]) return { maximize_clicks_bidding_strategy: { daily_target_spend_micros: daily } };
  if (name === STRATEGIES[1]) return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_TOP, daily_budget_micros: daily } };
  return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_DOM, daily_budget_micros: daily } };
};

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
          keyword_plan_network: NETWORK,
          bidding_strategy: biddingFor(strategyName, monthly),
          ad_groups: adGroupsFrom(keywords),
        },
      });
      const m = res?.campaign_forecast_metrics ?? {};
      return {
        ok: true,
        clicks: m.clicks != null ? Number(m.clicks) : null,
        cost: m.cost_micros != null ? euros(m.cost_micros) : null,
        cpc: m.average_cpc_micros != null ? euros(m.average_cpc_micros) : null,
        impressions: null, ctr: null, // non renvoyes par l API v24
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

console.log(`Zone : ${GEO.length} cibles`);
console.log(`Enchere retenue : ${(BID_TOP / 1e6).toFixed(2)} EUR (haut de page) · ${(BID_DOM / 1e6).toFixed(2)} EUR (domination)`);
console.log(`  encadrement mesure : departement 1,92 EUR — coeur de zone ${MEDIANE_COEUR.toFixed(2)} EUR`);
save();

console.log(`\nPhase 1 — matrice ${STRATEGIES.length} x ${BUDGETS.length} = ${STRATEGIES.length * BUDGETS.length} forecasts`);
for (const s of STRATEGIES) {
  console.log(`  ${s}`);
  for (const b of BUDGETS) {
    const r = await forecast(s, b, KEYWORDS);
    out.matrix.push({ strategy: s, budget_mensuel: b, ...r });
    if (!r.ok) out.errors.push({ phase: "matrix", strategy: s, budget: b, code: r.error, message: r.message });
    console.log(r.ok
      ? `    ${String(b).padStart(5)} EUR -> ${String(r.cost?.toFixed(2)).padStart(8)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
      : `    ${String(b).padStart(5)} EUR -> ECHEC ${r.error}`);
    save();
    await sleep(6_000);
  }
}

const REF_BUDGET = 200;
console.log(`\nPhase 2 — capacite par famille (haut de page, ${REF_BUDGET} EUR)`);
for (const [code, label] of Object.entries(PORTFOLIO.familles)) {
  const kws = PORTFOLIO.keywords.filter((k) => k.famille === code).map((k) => k.text);
  if (!kws.length) continue;
  const r = await forecast(STRATEGIES[1], REF_BUDGET, kws);
  out.familles.push({ code, label, mots_cles: kws.length, strategy: STRATEGIES[1], budget_mensuel: REF_BUDGET, ...r });
  if (!r.ok) out.errors.push({ phase: "famille", famille: code, code: r.error, message: r.message });
  console.log(r.ok
    ? `  ${code} ${String(label).padEnd(42)} ${String(kws.length).padStart(2)} kw -> ${String(r.cost?.toFixed(2)).padStart(7)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
    : `  ${code} ERREUR ${r.error}`);
  save();
  await sleep(6_000);
}

save();
console.log(`\nTermine — ${out.matrix.length} previsions, ${out.familles.length} familles, ${out.errors.length} erreur(s)`);
console.log(OUT);
