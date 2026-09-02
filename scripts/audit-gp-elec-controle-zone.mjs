/**
 * GP elec — CONTROLE : qu'achete exactement l'elargissement de la zone ?
 *
 * La passe departementale du 02/09 rend 188 clics a 1,05 EUR pour 200 EUR, contre
 * 133 clics a 1,49 EUR sur dix communes le 04/08. Attribuer cet ecart a la zone
 * serait faux : DEUX choses ont bouge entre les deux passes.
 *
 *   - la zone (dix communes -> departement) ;
 *   - l'enchere de reference, qui est derivee du marche lui-meme : mediane des
 *     encheres hautes du portefeuille, soit 2,07 EUR sur dix communes contre
 *     1,92 EUR sur le departement.
 *
 * Et Google reprevoit en continu : la passe matchtype du matin donne deja 187
 * clics pour les DIX COMMUNES a 200 EUR, contre 133 le 04/08. Presque tout
 * l'ecart mesure pourrait n'etre que de la derive.
 *
 * Ce script rejoue donc les dix communes avec la meme fenetre, le meme
 * portefeuille, la meme correspondance et surtout la MEME ENCHERE (1,92 EUR) que
 * la passe departementale. Seule la zone varie : la comparaison devient interne.
 *
 * Lecture seule : uniquement des previsions, rien n'est cree.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-controle-zone.mjs
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
const OUT = `${AUDIT}/data/controle-zone-2026-09-02.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const STEP = 10_000;
const round10k = (micros) => Math.max(STEP, Math.round(micros / STEP) * STEP);

const LANG = "languageConstants/1002";
const NETWORK = enums.KeywordPlanNetwork.GOOGLE_SEARCH;
const PERIOD = { start_date: "2026-09-03", end_date: "2026-10-02" };
/* L'enchere de la passe departementale, imposee ici pour ne faire varier QUE la zone. */
const BID = round10k(1.92 * 1e6);
const BUDGETS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
const COMMUNES = [
  "Angers", "Loire-Authion", "Trelaze", "Avrille", "Les Ponts-de-Ce",
  "Brissac Loire Aubance", "Saint-Barthelemy-d'Anjou", "Bouchemaine",
  "Verrieres-en-Anjou", "Beaufort-en-Anjou",
];

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / generateKeywordForecastMetrics",
    question: "l'elargissement au departement achete-t-il des clics, ou la derive de Google explique-t-elle tout ?",
    constant: {
      fenetre: PERIOD,
      langue: LANG,
      reseau: "GOOGLE_SEARCH",
      devise: "EUR",
      correspondance: "PHRASE",
      strategie: "CPC manuel plafonne",
      enchere: BID / 1e6,
      portefeuille: PORTFOLIO.keywords.length,
    },
    variable: ["zone"],
    reference_departement:
      "passe v3 du 02/09, meme fenetre, meme enchere : 188 clics / 197,40 EUR a 200 EUR ; plafond 720,42 EUR / 686 clics",
    note_enchere:
      "1,92 EUR est la mediane des encheres hautes du portefeuille SUR LE DEPARTEMENT. Sur dix communes cette mediane vaut 2,07 EUR : elle est volontairement ignoree ici, sinon deux variables changeraient a la fois.",
    limite_api: "ni impressions, ni CTR, ni position — v24",
  },
  geo: [],
  budgets: [],
  familles: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log("Phase 0 — resolution des dix communes");
for (const c of COMMUNES) {
  const g = await resolveGeoTargetConstant(cust, c);
  if (g) out.geo.push({ commune: c, geo: g });
  else out.errors.push({ phase: "geo", commune: c, code: "NON_RESOLU" });
}
const GEO = out.geo.map((g) => g.geo);
console.log(`  ${GEO.length}/${COMMUNES.length} resolues`);
save();

const adGroupsFrom = (kw) => [{ keywords: kw.map((t) => ({ text: t, match_type: enums.KeywordMatchType.PHRASE })) }];
const ALL_KW = PORTFOLIO.keywords.map((k) => k.text);

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
          geo_target_constants: GEO,
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

console.log(`\nPhase 1 — courbe budgetaire, dix communes a ${(BID / 1e6).toFixed(2)} EUR`);
for (const b of BUDGETS) {
  const r = await forecast(b, ALL_KW);
  out.budgets.push({ budget_mensuel: b, ...r });
  console.log(
    `  ${String(b).padStart(5)} EUR -> ${r.ok ? `${r.cost.toFixed(2)} EUR · ${Math.round(r.clicks)} cl · ${r.cpc.toFixed(2)} EUR` : "ECHEC " + r.error}`,
  );
  if (!r.ok) out.errors.push({ phase: "budget", budget: b, ...r });
  save();
  await sleep(6_000);
}

console.log(`\nPhase 2 — capacite des familles A et C a 200 EUR`);
for (const f of ["A", "C"]) {
  const kw = PORTFOLIO.keywords.filter((k) => k.famille === f).map((k) => k.text);
  const r = await forecast(200, kw);
  out.familles.push({ famille: f, mots_cles: kw.length, ...r });
  console.log(
    `  ${f} (${kw.length} mots) -> ${r.ok ? `${r.cost.toFixed(2)} EUR · ${Math.round(r.clicks)} cl · ${r.cpc.toFixed(2)} EUR` : "ECHEC " + r.error}`,
  );
  if (!r.ok) out.errors.push({ phase: "famille", famille: f, ...r });
  save();
  await sleep(6_000);
}

save();
console.log(`\nTermine — ${out.budgets.length + out.familles.length} previsions, ${out.errors.length} erreur(s)`);
console.log(OUT);
