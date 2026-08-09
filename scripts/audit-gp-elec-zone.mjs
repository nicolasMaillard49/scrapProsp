/**
 * Audit GP elec — volumes réels sur la ZONE DE CAMPAGNE (Angers + ~30 km autour
 * de Brissac Loire Aubance), obtenue en agrégeant les geo targets des principales
 * communes du rayon. Lecture seule.
 *
 *   node --import tsx scripts/audit-gp-elec-zone.mjs
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

const cust = mccCustomer();

// Communes principales dans un rayon ~30 km autour de Brissac Loire Aubance.
// Limite API : 10 geo targets max par requête. On prend les 10 communes les plus
// peuplées du rayon (~245 000 hab. sur ~400 000) → estimation CONSERVATRICE.
const COMMUNES = [
  "Angers", "Loire-Authion", "Trelaze", "Avrille", "Les Ponts-de-Ce",
  "Brissac Loire Aubance", "Saint-Barthelemy-d'Anjou", "Bouchemaine",
  "Verrieres-en-Anjou", "Beaufort-en-Anjou",
];

const SEEDS = [
  "climatisation", "climatisation reversible", "installateur climatisation",
  "pompe a chaleur air air", "devis climatisation", "clim reversible",
  "electricien", "depannage electrique", "electricien urgence", "panne electrique",
  "devis electricien", "mise aux normes electrique", "renovation electrique",
  "tableau electrique", "installation electrique", "consuel", "domotique",
];

const geos = [];
for (const c of COMMUNES) {
  const g = await resolveGeoTargetConstant(cust, c);
  if (g) geos.push(g); else console.warn("  ⚠ non résolu:", c);
}
console.log(`📍 Zone agrégée : ${geos.length}/${COMMUNES.length} communes résolues\n`);

const euros = (m) => Number(m || 0) / 1e6;
const COMP = { LOW: "FAIBLE", MEDIUM: "MOYENNE", HIGH: "FORTE", 2: "FAIBLE", 3: "MOYENNE", 4: "FORTE" };

const res = await cust.keywordPlanIdeas.generateKeywordIdeas({
  customer_id: MCC_ID,
  language: "languageConstants/1002",
  geo_target_constants: geos,
  keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
  include_adult_keywords: false,
  keyword_and_url_seed: { keywords: SEEDS, url: "https://gp-elec-49.com/" },
});

const rows = (Array.isArray(res) ? res : res?.results ?? []).map((r) => {
  const m = r.keyword_idea_metrics ?? {};
  return {
    text: (r.text ?? "").trim(),
    vol: Number(m.avg_monthly_searches ?? 0),
    comp: COMP[m.competition] ?? "?",
    compIndex: m.competition_index != null ? Number(m.competition_index) : null,
    bidLow: euros(m.low_top_of_page_bid_micros),
    bidHigh: euros(m.high_top_of_page_bid_micros),
    months: (m.monthly_search_volumes ?? []).map((x) => ({ m: `${x.year}-${String(x.month).padStart(2, "0")}`, v: Number(x.monthly_searches ?? 0) })),
  };
}).filter((k) => k.text && k.vol >= 10).sort((a, b) => b.vol - a.vol);

console.log("mot-clé".padEnd(42) + "vol/mois".padStart(9) + "  conc.".padEnd(13) + "enchère haut de page");
for (const r of rows.slice(0, 60)) {
  console.log(
    r.text.slice(0, 41).padEnd(42) + String(r.vol).padStart(9) + "  " +
    (r.comp + (r.compIndex != null ? `(${r.compIndex})` : "")).padEnd(13) +
    `${r.bidLow.toFixed(2)} – ${r.bidHigh.toFixed(2)} €`,
  );
}
console.log(`\n${rows.length} mots-clés avec volume ≥ 10 sur la zone.`);

// Saisonnalité 12 mois du mot-clé climatisation (argument saison).
const clim = rows.find((r) => r.text === "climatisation") || rows.find((r) => r.text.includes("climatisation"));
if (clim) {
  console.log(`\nSaisonnalité "${clim.text}" (12 derniers mois) :`);
  for (const m of clim.months.slice(-12)) console.log(`  ${m.m}  ${String(m.v).padStart(6)}`);
}
const elec = rows.find((r) => r.text === "electricien");
if (elec) {
  console.log(`\nSaisonnalité "electricien" (12 derniers mois) :`);
  for (const m of elec.months.slice(-12)) console.log(`  ${m.m}  ${String(m.v).padStart(6)}`);
}

writeFileSync("C:/Users/nicol/AppData/Local/Temp/claude/D--projets-audit/d8f84200-1c69-4971-a044-1c51d6037616/scratchpad/kw-zone.json", JSON.stringify({ geos, rows }, null, 1));
console.log("\n✅ JSON zone écrit.");
