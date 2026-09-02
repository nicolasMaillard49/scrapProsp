/**
 * GP elec — la base des livrables sur la ZONE RETENUE : couronne Angers + Brissac.
 *
 * Pourquoi cette zone. Le controle du 02/09 a tranche les deux extremes :
 *
 *   - dix communes  : sature a 360,77 EUR / 360 clics. Trop etroit des que le
 *                     budget depasse ~360 EUR.
 *   - departement   : plafond 720,42 EUR / 686 clics, mais il fait PERDRE 5 % de
 *                     clics sous 300 EUR et arrose Cholet, Saumur et Segre, hors
 *                     rayon d'intervention.
 *
 * La zone retenue est l'agglomeration d'Angers plus la couronne jusqu'a Brissac,
 * Chalonnes, Le Lion-d'Angers, Seiches et Beaufort — ce que le client dessine
 * comme son rayon reel. Le dossier l'appelait "Z2 rayon 30 km" le 05/08.
 *
 * CONTRAINTE D'OUTIL. generateKeywordForecastMetrics accepte 20 geo_target_constants
 * (34 sont refusees en TOO_MANY, mesure du 05/08). La liste ci-dessous est donc
 * ORDONNEE par priorite : agglomeration d'abord, puis couronne par proximite a
 * Brissac. Elle est resolue, dedoublonnee — plusieurs communes partagent le meme
 * objet Google — puis tronquee a 20, et la troncature est journalisee.
 *
 * Deux series de previsions, pour deux usages differents :
 *
 *   Phase 3  matrice 3 strategies x 10 budgets a l'enchere DERIVEE de cette zone
 *            -> la base chiffree des livrables
 *   Phase 5  courbe budgetaire a 1,92 EUR, l'enchere de la passe departementale
 *            -> comparaison a variable unique avec les deux autres zones, dont le
 *               controle dix communes du 02/09 tourne deja a 1,92 EUR
 *
 * Lecture seule : aucune campagne, aucun plan, rien n'est cree cote Google.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-v3-zone-brissac-angers.mjs
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
const { resolveGeoTargetConstant } = await import("../app/lib/googleAds/keywordIdeas.ts");

const AUDIT = "C:/Users/n.maillard/audit-nmf/gpelec";
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const OUT = `${AUDIT}/data/donnees-zone-brissac-angers-2026-09-02.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const STEP = 10_000;
const round10k = (micros) => Math.max(STEP, Math.round(micros / STEP) * STEP);

const LANG = "languageConstants/1002";
const NETWORK = enums.KeywordPlanNetwork.GOOGLE_SEARCH;
const PERIOD = { start_date: "2026-09-03", end_date: "2026-10-02" };
const MAX_GEO = 20;
const BUDGETS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
const STRATEGIES = [
  "Presence (maximisation des clics)",
  "Haut de page (CPC manuel)",
  "Domination (CPC manuel majore)",
];
/** Enchere de la passe departementale, pour la serie de comparaison a variable unique. */
const BID_COMPARAISON = round10k(1.92 * 1e6);

/* Ordonnee par priorite : le siege et l'agglomeration d'abord, puis la couronne
   par proximite a Brissac. Au-dela de 20 cibles resolues distinctes, la fin de
   liste est ecartee et journalisee. */
const COMMUNES = [
  "Brissac Loire Aubance",
  "Angers",
  "Les Ponts-de-Ce",
  "Trelaze",
  "Avrille",
  "Saint-Barthelemy-d'Anjou",
  "Bouchemaine",
  "Beaucouze",
  "Verrieres-en-Anjou",
  "Ecouflant",
  "Montreuil-Juigne",
  "Loire-Authion",
  "Les Garennes sur Loire",
  "Murs-Erigne",
  "Sainte-Gemmes-sur-Loire",
  "Beaufort-en-Anjou",
  "Rochefort-sur-Loire",
  "Chalonnes-sur-Loire",
  "Bellevigne-en-Layon",
  "Briollay",
  "Tierce",
  "Seiches-sur-le-Loir",
  "Saint-Georges-sur-Loire",
  "Becon-les-Granits",
  "Longuenee-en-Anjou",
  "Le Lion-d'Angers",
  "Jarze Villages",
  "Maze-Milon",
  "La Menitre",
  "Gennes-Val-de-Loire",
  "Tuffalun",
  "Denee",
  "Moze-sur-Louet",
];

const KEYWORDS = PORTFOLIO.keywords.map((k) => k.text);
const FAMILLE_OF = Object.fromEntries(PORTFOLIO.keywords.map((k) => [norm(k.text), k.famille]));

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / KeywordPlanIdeaService",
    role: "base chiffree des trois livrables — zone retenue pour le test et la campagne",
    zone_label: "Agglomeration d'Angers + couronne jusqu'a Brissac, Chalonnes, Le Lion-d'Angers, Seiches et Beaufort",
    zone_pourquoi: "Dix communes : sature a 360,77 EUR. Departement : +90 % d'inventaire mais -5 % de clics sous 300 EUR et arrosage hors rayon d'intervention. Zone intermediaire retenue avec le client le 02/09.",
    limite_geo: `generateKeywordForecastMetrics accepte ${MAX_GEO} geo_target_constants ; 34 sont refusees en TOO_MANY (mesure du 05/08). La liste est ordonnee par priorite puis tronquee.`,
    appels: [
      "generateKeywordHistoricalMetrics (portefeuille)",
      "generateKeywordForecastMetrics (matrice budgets, enchere de la zone)",
      "generateKeywordForecastMetrics (par famille)",
      "generateKeywordForecastMetrics (courbe de comparaison a 1,92 EUR)",
    ],
    decouverte: "non rejouee ici : le portefeuille a ete confronte a generateKeywordIdeas le meme jour sur le departement, zone qui contient celle-ci (donnees-google-ads-brutes-2026-09-02.json).",
    limite_api: "KeywordForecastMetrics v24 ne renvoie ni impressions, ni CTR, ni position moyenne.",
    langue: LANG,
    reseau: "GOOGLE_SEARCH",
    devise: "EUR",
    periode_forecast: PERIOD,
    correspondance: "PHRASE",
    budgets: BUDGETS,
    strategies: STRATEGIES,
    enchere_comparaison: BID_COMPARAISON / 1e6,
  },
  zone: { demandees: COMMUNES, resolues: [], doublons: [], non_resolues: [], ecartees_par_troncature: [] },
  geo: [],
  historical: [],
  matrix: [],
  familles: [],
  comparaison_1_92: [],
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
// keyword_metrics peut etre NULL : normaliser explicitement, un defaut de
// parametre ne couvre que undefined et la phase entiere leverait.
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

// ── Phase 0 : geo, dedoublonnage, troncature ───────────────────────────────
console.log(`Phase 0 — resolution de ${COMMUNES.length} communes, plafond ${MAX_GEO} cibles`);
const vus = new Map();
for (const c of COMMUNES) {
  const g = await resolveGeoTargetConstant(cust, c);
  if (!g) { out.zone.non_resolues.push(c); console.log(`  — ${c} : non resolue`); continue; }
  if (vus.has(g)) { out.zone.doublons.push({ commune: c, meme_objet_que: vus.get(g), geo: g }); continue; }
  if (out.geo.length >= MAX_GEO) { out.zone.ecartees_par_troncature.push({ commune: c, geo: g }); continue; }
  vus.set(g, c);
  out.geo.push({ commune: c, geo: g });
  out.zone.resolues.push(c);
}
const GEO = out.geo.map((g) => g.geo);
console.log(`  ${GEO.length} cibles retenues`);
if (out.zone.doublons.length) console.log(`  ${out.zone.doublons.length} doublon(s) d'objet Google : ${out.zone.doublons.map((d) => `${d.commune} = ${d.meme_objet_que}`).join(", ")}`);
if (out.zone.ecartees_par_troncature.length) console.log(`  ${out.zone.ecartees_par_troncature.length} ecartee(s) par la troncature a ${MAX_GEO} : ${out.zone.ecartees_par_troncature.map((e) => e.commune).join(", ")}`);
if (out.zone.non_resolues.length) console.log(`  ${out.zone.non_resolues.length} non resolue(s) : ${out.zone.non_resolues.join(", ")}`);
save();

// ── Phase 1 : historique du portefeuille sur la zone ───────────────────────
console.log(`\nPhase 1 — historical metrics, ${KEYWORDS.length} mots-cles`);
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

// ── Phase 2 : enchere de reference, derivee de CETTE zone ──────────────────
const highs = out.historical.map((h) => h.bidHigh).filter((v) => v != null && v > 0).sort((a, b) => a - b);
const medianHigh = highs.length ? highs[Math.floor(highs.length / 2)] : 2.5;
const BID_TOP = round10k(medianHigh * 1e6);
const BID_DOM = round10k(medianHigh * 1.5 * 1e6);
out.meta.enchere_reference = {
  mediane_high_top_of_page: medianHigh,
  bid_haut_de_page: BID_TOP / 1e6,
  bid_domination: BID_DOM / 1e6,
  echantillon: highs.length,
};
console.log(`\nPhase 2 — enchere mediane haut de page : ${medianHigh.toFixed(2)} EUR (n=${highs.length})`);
console.log(`  Haut de page -> ${(BID_TOP / 1e6).toFixed(2)} EUR · Domination -> ${(BID_DOM / 1e6).toFixed(2)} EUR`);
save();

// ── Forecast ───────────────────────────────────────────────────────────────
const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];

const biddingFor = (name, monthly, bidOverride) => {
  const daily = round10k((monthly / 30.4) * 1e6);
  if (bidOverride) return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: bidOverride, daily_budget_micros: daily } };
  if (name === STRATEGIES[0]) return { maximize_clicks_bidding_strategy: { daily_target_spend_micros: daily } };
  if (name === STRATEGIES[1]) return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_TOP, daily_budget_micros: daily } };
  return { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_DOM, daily_budget_micros: daily } };
};

async function forecast(strategyName, monthly, keywords, bidOverride = null) {
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
          bidding_strategy: biddingFor(strategyName, monthly, bidOverride),
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

// ── Phase 3 : matrice multi-budgets, enchere de la zone ────────────────────
console.log(`\nPhase 3 — matrice ${STRATEGIES.length} x ${BUDGETS.length} = ${STRATEGIES.length * BUDGETS.length} forecasts`);
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

// ── Phase 4 : capacite par famille ─────────────────────────────────────────
const REF_BUDGET = 200;
const REF_STRAT = STRATEGIES[1];
console.log(`\nPhase 4 — capacite par famille (${REF_STRAT}, ${REF_BUDGET} EUR)`);
for (const [code, label] of Object.entries(PORTFOLIO.familles)) {
  const kws = PORTFOLIO.keywords.filter((k) => k.famille === code).map((k) => k.text);
  if (!kws.length) continue;
  const r = await forecast(REF_STRAT, REF_BUDGET, kws);
  out.familles.push({ code, label, mots_cles: kws.length, strategy: REF_STRAT, budget_mensuel: REF_BUDGET, ...r });
  if (!r.ok) out.errors.push({ phase: "famille", famille: code, code: r.error, message: r.message });
  console.log(r.ok
    ? `  ${code} ${String(label).padEnd(42)} ${String(kws.length).padStart(2)} kw -> ${String(r.cost?.toFixed(2)).padStart(7)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
    : `  ${code} ERREUR ${r.error}`);
  save();
  await sleep(6_000);
}

// ── Phase 5 : courbe de comparaison a enchere imposee ──────────────────────
console.log(`\nPhase 5 — courbe de comparaison a ${(BID_COMPARAISON / 1e6).toFixed(2)} EUR (enchere des autres zones)`);
for (const b of BUDGETS) {
  const r = await forecast(STRATEGIES[1], b, KEYWORDS, BID_COMPARAISON);
  out.comparaison_1_92.push({ budget_mensuel: b, enchere: BID_COMPARAISON / 1e6, ...r });
  if (!r.ok) out.errors.push({ phase: "comparaison", budget: b, code: r.error, message: r.message });
  console.log(r.ok
    ? `  ${String(b).padStart(5)} EUR -> ${String(r.cost?.toFixed(2)).padStart(8)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
    : `  ${String(b).padStart(5)} EUR -> ECHEC ${r.error}`);
  save();
  await sleep(6_000);
}

save();
console.log(`\nTermine — ${out.matrix.length} matrice + ${out.familles.length} familles + ${out.comparaison_1_92.length} comparaison, ${out.errors.length} erreur(s)`);
console.log(OUT);
