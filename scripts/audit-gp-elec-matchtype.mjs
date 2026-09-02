/**
 * GP elec — le portefeuille climatisation est-il vraiment 12x plus performant,
 * ou juste 12x plus large ?
 *
 * Motif : sur la prevision du 05/08, la famille A (climatisation) capte 121 clics
 * pour 350 recherches en septembre (34,5 %), quand la famille C (electricien
 * general) capte 23 clics pour 820 recherches (2,8 %). Aucun taux de clic ne
 * fait 34 % : soit le PHRASE match ratisse pour A une longue traine absente des
 * volumes canoniques, soit la prevision de A est gonflee.
 *
 * Ce script rejoue le MEME forecast en EXACT, PHRASE et BROAD dans une seule
 * passe, pour que la comparaison soit interne et insensible a la derive de
 * Google (mesuree a +5 % en un jour le 05/08).
 *
 *   - si les clics de A s'effondrent en EXACT -> c'etait la longue traine
 *   - s'ils tiennent -> la prevision est gonflee, a signaler dans le rapport
 *
 * Lecture seule cote Google : uniquement des previsions, rien n'est cree.
 *
 *   cd C:/Users/n.maillard/VueJS/scrapProsp
 *   node --import tsx scripts/audit-gp-elec-matchtype.mjs
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
const VAULT = "C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md";
const fromVault = loadEnv(VAULT, (k) => k.startsWith("GOOGLE_ADS_"));
console.log(`Credentials : ${fromVault} variables GOOGLE_ADS_* reprises du vault`);

const { enums } = await import("google-ads-api");
const { mccCustomer, MCC_ID, googleAdsConfigured } = await import("../app/lib/googleAds/client.ts");
if (!googleAdsConfigured()) { console.error("ERREUR : credentials Google Ads incomplets."); process.exit(1); }

const AUDIT = "C:/Users/n.maillard/audit-nmf/gpelec";
const BRUT = JSON.parse(readFileSync(`${AUDIT}/data/donnees-google-ads-brutes-2026-08-04.json`, "utf8"));
const PORTFOLIO = JSON.parse(readFileSync(`${AUDIT}/data/portefeuille-mots-cles.json`, "utf8"));
const OUT = `${AUDIT}/data/matchtype-2026-09-02.json`;

const cust = mccCustomer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const euros = (m) => Number(m || 0) / 1e6;
const r10k = (micros) => Math.max(10_000, Math.round(micros / 10_000) * 10_000);

const LANG = "languageConstants/1002";
const GEO = BRUT.geo.map((g) => g.geo);
/* La fenetre de reference (septembre 2026) a commence hier : l'API refuse une
   date passee. On prend 30 jours a partir de demain — meme creux de saison. */
const PERIOD = { start_date: "2026-09-03", end_date: "2026-10-02" };

const PLAFOND = 2.07;   // plafond retenu par l'audit
const BUDGET = 200;     // budget de reference

const kwOf = (...codes) => PORTFOLIO.keywords.filter((k) => codes.includes(k.famille)).map((k) => k.text);
const PERIMETRES = [
  { cle: "A",    label: "Climatisation et PAC air/air", keywords: kwOf("A") },
  { cle: "C",    label: "Electricien general",          keywords: kwOf("C") },
  { cle: "TOUT", label: "Portefeuille entier",          keywords: PORTFOLIO.keywords.map((k) => k.text) },
];
const MATCHS = [
  { cle: "EXACT",  enumValue: enums.KeywordMatchType.EXACT },
  { cle: "PHRASE", enumValue: enums.KeywordMatchType.PHRASE },
  { cle: "BROAD",  enumValue: enums.KeywordMatchType.BROAD },
];

const out = {
  meta: {
    extraction: new Date().toISOString(),
    mcc: MCC_ID,
    api: "google-ads-api v24 / generateKeywordForecastMetrics",
    question: "le portefeuille A est-il 12x plus performant que C, ou 12x plus large ?",
    fenetre: PERIOD,
    fenetre_note: "la reference du 05/08 portait sur 2026-09-01 -> 2026-09-30 ; cette fenetre est passee, les valeurs ne sont pas comparables terme a terme. Seuls les ecarts INTERNES a cette passe font foi.",
    constant: { langue: LANG, reseau: "GOOGLE_SEARCH", devise: "EUR", geo: GEO.length, strategie: "CPC manuel plafonne", plafond: PLAFOND, budget: BUDGET },
    variable: ["type de correspondance", "perimetre de familles"],
    perimetres: PERIMETRES.map((p) => ({ cle: p.cle, label: p.label, mots_cles: p.keywords.length })),
    matchs: MATCHS.map((m) => m.cle),
    reference_05_08: "A (phrase, 200 EUR, plafond 2,07) : 121 clics / 197,40 EUR — C : 23 clics / 24,26 EUR",
    recherches_septembre: { A: 350, C: 820, TOUT: 2870 },
    limite_api: "ni impressions, ni CTR, ni position — v24",
  },
  previsions: [],
  errors: [],
};
mkdirSync(dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

async function forecast(keywords, matchType) {
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
            max_cpc_bid_micros: r10k(PLAFOND * 1e6),
            daily_budget_micros: r10k((BUDGET / 30.4) * 1e6),
          } },
          ad_groups: [{ keywords: keywords.map((t) => ({ text: t, match_type: matchType })) }],
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

console.log(`Fenetre ${PERIOD.start_date} -> ${PERIOD.end_date} · ${GEO.length} communes · plafond ${PLAFOND} EUR · budget ${BUDGET} EUR`);
console.log(`${PERIMETRES.length} perimetres x ${MATCHS.length} correspondances = ${PERIMETRES.length * MATCHS.length} previsions\n`);

for (const p of PERIMETRES) {
  console.log(`=== ${p.cle} — ${p.label} (${p.keywords.length} mots-cles) ===`);
  for (const m of MATCHS) {
    const r = await forecast(p.keywords, m.enumValue);
    const row = { perimetre: p.cle, match: m.cle, mots_cles: p.keywords.length, ...r };
    out.previsions.push(row);
    if (!r.ok) { out.errors.push(row); console.log(`  ${m.cle.padEnd(6)} ECHEC ${r.error}`); }
    else console.log(`  ${m.cle.padEnd(6)} ${r.clicks.toFixed(0).padStart(4)} clics · ${r.cost.toFixed(2).padStart(7)} EUR · CPC ${r.cpc.toFixed(2)}`);
    save();
    await sleep(2000);
  }
  console.log("");
}

const val = (per, match) => out.previsions.find((x) => x.perimetre === per && x.match === match && x.ok);
console.log("=== Lecture ===");
for (const per of ["A", "C"]) {
  const e = val(per, "EXACT"), ph = val(per, "PHRASE"), b = val(per, "BROAD");
  if (!e || !ph) continue;
  const chute = (1 - e.clicks / ph.clicks) * 100;
  console.log(`${per} : exact ${e.clicks.toFixed(0)} cl · phrase ${ph.clicks.toFixed(0)} cl · broad ${b ? b.clicks.toFixed(0) : "?"} cl  -> l'exact perd ${chute.toFixed(0)} % des clics du phrase`);
}
const ae = val("A", "EXACT"), ce = val("C", "EXACT");
if (ae && ce) console.log(`Rapport A/C en EXACT : ${(ae.clicks / ce.clicks).toFixed(1)}x (il etait de 5,3x en phrase le 05/08)`);
save();
console.log(`\nEcrit : ${OUT}`);
