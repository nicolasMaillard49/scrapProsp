/**
 * GP elec — la prevision par famille tient-elle compte de la saison ?
 *
 * Motif : la passe du 04/08 credite la famille A (climatisation) de 121 des 133
 * clics a 200 EUR sur une fenetre de prevision de SEPTEMBRE. Or les volumes
 * mensuels reels de la famille A donnent 350 recherches en septembre contre
 * 1 011 en moyenne annuelle (-65 %), et 5 830 en juin. 121 clics sur 350
 * recherches supposerait qu'un tiers des recherches soient cliquees ; sur la
 * moyenne annuelle, 121 clics font 12 %, un taux plausible. D'ou le soupcon :
 * la prevision serait calculee sur la moyenne annuelle, pas sur la fenetre.
 *
 * Ce script rejoue generateKeywordForecastMetrics a budget et strategie
 * constants, en ne faisant varier QUE la fenetre de prevision :
 *   - septembre 2026 (creux de la climatisation)
 *   - mai 2027      (montee de la climatisation)
 *   - juin 2027     (pic de la climatisation)
 * sur les 8 familles + le portefeuille entier.
 *
 * Si les trois fenetres rendent les memes chiffres, la prevision ignore la
 * saison et la conclusion « campagne climatisation » est un artefact.
 * Si elles divergent, la saison est prise en compte et il faut requalifier la
 * recommandation fenetre par fenetre.
 *
 * Geo repris du fichier brut du 04/08 : aucun appel geo refait.
 * Lecture seule cote Google : uniquement des previsions, rien n'est cree.
 *
 *   cd D:/projets/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-saisonnalite.mjs
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

const AUDIT = "D:/projets/audit/gpelec";
const BRUT = JSON.parse(readFileSync(`${AUDIT}/data/donnees-google-ads-brutes-2026-08-04.json`, "utf8"));
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const OUT = `${AUDIT}/data/saisonnalite-forecast-2026-08-05.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;

const LANG = "languageConstants/1002";
const GEO = BRUT.geo.map((g) => g.geo);
const BID_TOP = Math.round(BRUT.meta.enchere_reference.bid_haut_de_page * 1e6 / 10_000) * 10_000;
const REF_BUDGET = 200;

const FENETRES = [
  { cle: "septembre-2026", start_date: "2026-09-01", end_date: "2026-09-30" },
  { cle: "mai-2027",       start_date: "2027-05-01", end_date: "2027-05-31" },
  { cle: "juin-2027",      start_date: "2027-06-01", end_date: "2027-06-30" },
];

/* volumes mensuels reels par famille, pour confronter la prevision a la saison */
const MOIS = ["2025-JULY","2025-AUGUST","2025-SEPTEMBER","2025-OCTOBER","2025-NOVEMBER","2025-DECEMBER",
  "2026-JANUARY","2026-FEBRUARY","2026-MARCH","2026-APRIL","2026-MAY","2026-JUNE"];
const volParFamille = {};
for (const k of BRUT.historical) {
  const f = k.famille || "?";
  volParFamille[f] = volParFamille[f] || {};
  for (const m of k.months || []) volParFamille[f][m.m] = (volParFamille[f][m.m] || 0) + m.v;
}
const moyenne = (o) => Math.round(MOIS.reduce((s, m) => s + (o[m] || 0), 0) / 12);

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / KeywordPlanIdeaService.generateKeywordForecastMetrics",
    question: "la prevision par famille varie-t-elle avec la fenetre de prevision ?",
    constant: { budget_mensuel: REF_BUDGET, strategie: "Haut de page (CPC manuel)", max_cpc: BID_TOP / 1e6, langue: LANG, reseau: "GOOGLE_SEARCH", devise: "EUR", geo: GEO.length },
    variable: "forecast_period uniquement",
    fenetres: FENETRES,
    geo_source: "reprise du brut du 2026-08-04, aucun appel geo refait",
    limite_api: "ni impressions, ni CTR, ni position — v24",
  },
  volumes_mensuels_reels: { par_famille: volParFamille, moyenne_annuelle: Object.fromEntries(Object.entries(volParFamille).map(([f, o]) => [f, moyenne(o)])) },
  previsions: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];

async function forecast(periode, keywords) {
  let wait = 25_000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await cust.keywordPlanIdeas.generateKeywordForecastMetrics({
        customer_id: MCC_ID,
        currency_code: "EUR",
        forecast_period: { start_date: periode.start_date, end_date: periode.end_date },
        campaign: {
          language_constants: [LANG],
          geo_target_constants: GEO,
          bidding_strategy: { manual_cpc_bidding_strategy: { max_cpc_bid_micros: BID_TOP, daily_budget_micros: Math.round((REF_BUDGET / 30.4) * 1e6 / 10_000) * 10_000 } },
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
      /* UNKNOWN n est PAS retryable : c est une erreur de validation deguisee */
      if (!/RESOURCE_EXHAUSTED|INTERNAL|DEADLINE/.test(code) || attempt === 6) {
        return { ok: false, error: code, message: msg, attempts: attempt };
      }
      console.log(`     quota — attente ${wait / 1000}s (essai ${attempt}/6)`);
      await sleep(wait);
      wait = Math.min(wait * 2, 180_000);
    }
  }
}

const CIBLES = [
  { code: "TOUT", label: "Portefeuille entier", keywords: PORTFOLIO.keywords.map((k) => k.text) },
  ...Object.entries(PORTFOLIO.familles).map(([code, label]) => ({
    code, label, keywords: PORTFOLIO.keywords.filter((k) => k.famille === code).map((k) => k.text),
  })).filter((c) => c.keywords.length),
];

console.log(`Enchere plafond ${(BID_TOP / 1e6).toFixed(2)} EUR · budget ${REF_BUDGET} EUR · ${GEO.length} communes`);
console.log(`${CIBLES.length} cibles x ${FENETRES.length} fenetres = ${CIBLES.length * FENETRES.length} previsions\n`);

for (const f of FENETRES) {
  console.log(`\n=== ${f.cle} ===`);
  for (const c of CIBLES) {
    const r = await forecast(f, c.keywords);
    out.previsions.push({ fenetre: f.cle, code: c.code, label: c.label, mots_cles: c.keywords.length, ...r });
    if (!r.ok) out.errors.push({ fenetre: f.cle, code: c.code, error: r.error, message: r.message });
    console.log(r.ok
      ? `  ${c.code.padEnd(5)} ${String(c.keywords.length).padStart(2)} kw -> ${String(r.cost?.toFixed(2)).padStart(8)} EUR · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
      : `  ${c.code.padEnd(5)} ERREUR ${r.error} — ${r.message}`);
    save();
    await sleep(9_000);
  }
}

console.log(`\n--- verdict ---`);
for (const c of CIBLES) {
  const vals = FENETRES.map((f) => out.previsions.find((p) => p.fenetre === f.cle && p.code === c.code)?.clicks).filter((v) => v != null);
  if (vals.length < 2) { console.log(`  ${c.code.padEnd(5)} donnees insuffisantes`); continue; }
  const min = Math.min(...vals), max = Math.max(...vals);
  const ecart = min > 0 ? Math.round(100 * (max / min - 1)) : null;
  console.log(`  ${c.code.padEnd(5)} clics ${vals.map((v) => String(Math.round(v)).padStart(5)).join(" ")}  ecart max ${ecart}%`);
}
console.log(`\nerreurs API : ${out.errors.length}`);
console.log(`ecrit -> ${OUT}`);
save();
