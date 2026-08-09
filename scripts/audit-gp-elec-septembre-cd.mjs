/**
 * GP elec — quelle enchere faut-il pour depenser 200 EUR SANS la climatisation ?
 *
 * Motif : la recommandation du 04/08 (200 EUR, CPC plafonne 2,07 EUR, 133 clics)
 * ne tient que parce que la famille A (climatisation) absorbe 121 des 133 clics
 * a des encheres basses (1,28-2,43 EUR). En septembre la climatisation est a
 * -65 % de sa moyenne annuelle : le lancement se fera sur l'electricien general
 * (C) et la mise aux normes / Consuel (D).
 *
 * Or ces deux familles, seules, ne depensent que 24,13 EUR et 4,95 EUR sur
 * 200 EUR demandes — parce que leurs encheres hautes depassent le plafond de
 * 2,07 EUR (`electricien angers` 5,14 · `entreprise electricite` 5,31 ·
 * `electricien autour de moi` 3,31 · `electricien` 2,96).
 *
 * Ce script cherche le couple (plafond d'enchere, budget) qui rend une campagne
 * C+D reellement finançable en septembre. Il balaie 4 plafonds x 3 budgets sur
 * trois perimetres : C seule, C+D, C+D+G (domotique, si on l'accepte).
 *
 * Lecture seule cote Google : uniquement des previsions, rien n'est cree.
 *
 *   cd D:/projets/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-septembre-cd.mjs
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
const OUT = `${AUDIT}/data/septembre-sans-clim-2026-08-05.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const r10k = (micros) => Math.max(10_000, Math.round(micros / 10_000) * 10_000);

const LANG = "languageConstants/1002";
const GEO = BRUT.geo.map((g) => g.geo);
const PERIOD = { start_date: "2026-09-01", end_date: "2026-09-30" };

const PLAFONDS = [2.07, 3.00, 4.00, 5.20];   // 2,07 = plafond actuel ; 5,20 couvre `entreprise electricite` (5,31 arrondi)
const BUDGETS = [100, 200, 300];

const kwOf = (...codes) => PORTFOLIO.keywords.filter((k) => codes.includes(k.famille)).map((k) => k.text);
const PERIMETRES = [
  { cle: "C",     label: "Electricien general seul",                 keywords: kwOf("C") },
  { cle: "CD",    label: "Electricien general + renovation/Consuel", keywords: kwOf("C", "D") },
  { cle: "CDG",   label: "C + D + domotique",                       keywords: kwOf("C", "D", "G") },
];

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / generateKeywordForecastMetrics",
    question: "quel plafond d'enchere rend une campagne septembre sans climatisation finançable ?",
    fenetre: PERIOD,
    constant: { langue: LANG, reseau: "GOOGLE_SEARCH", devise: "EUR", geo: GEO.length, strategie: "CPC manuel plafonne" },
    variable: ["plafond d'enchere", "budget mensuel", "perimetre de familles"],
    plafonds: PLAFONDS,
    budgets: BUDGETS,
    perimetres: PERIMETRES.map((p) => ({ cle: p.cle, label: p.label, mots_cles: p.keywords.length })),
    reference_04_08: "famille C seule a 200 EUR / plafond 2,07 : 24,13 EUR depenses, 23 clics — famille D : 4,95 EUR, 7 clics",
    limite_api: "ni impressions, ni CTR, ni position — v24",
  },
  previsions: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];

async function forecast(plafond, monthly, keywords) {
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
          bidding_strategy: { manual_cpc_bidding_strategy: {
            max_cpc_bid_micros: r10k(plafond * 1e6),
            daily_budget_micros: r10k((monthly / 30.4) * 1e6),
          } },
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
      if (!/RESOURCE_EXHAUSTED|INTERNAL|DEADLINE/.test(code) || attempt === 6) {
        return { ok: false, error: code, message: msg, attempts: attempt };
      }
      console.log(`     quota — attente ${wait / 1000}s (essai ${attempt}/6)`);
      await sleep(wait);
      wait = Math.min(wait * 2, 180_000);
    }
  }
}

console.log(`Fenetre ${PERIOD.start_date} -> ${PERIOD.end_date} · ${GEO.length} communes`);
console.log(`${PERIMETRES.length} perimetres x ${PLAFONDS.length} plafonds x ${BUDGETS.length} budgets = ${PERIMETRES.length * PLAFONDS.length * BUDGETS.length} previsions\n`);

for (const p of PERIMETRES) {
  console.log(`\n=== ${p.cle} — ${p.label} (${p.keywords.length} mots-cles) ===`);
  for (const plafond of PLAFONDS) {
    for (const monthly of BUDGETS) {
      const r = await forecast(plafond, monthly, p.keywords);
      const taux = r.ok && r.cost != null ? Math.round(100 * r.cost / monthly) : null;
      out.previsions.push({ perimetre: p.cle, plafond, budget_mensuel: monthly, taux_de_depense_pct: taux, ...r });
      if (!r.ok) out.errors.push({ perimetre: p.cle, plafond, budget: monthly, error: r.error, message: r.message });
      console.log(r.ok
        ? `  plafond ${plafond.toFixed(2)} · budget ${String(monthly).padStart(3)} -> ${String(r.cost?.toFixed(2)).padStart(7)} EUR (${String(taux).padStart(3)}% du budget) · ${String(r.clicks?.toFixed(0)).padStart(4)} clics · CPC ${r.cpc?.toFixed(2)}`
        : `  plafond ${plafond.toFixed(2)} · budget ${String(monthly).padStart(3)} -> ERREUR ${r.error} — ${r.message}`);
      save();
      await sleep(9_000);
    }
  }
}

console.log(`\nerreurs API : ${out.errors.length}`);
console.log(`ecrit -> ${OUT}`);
save();
