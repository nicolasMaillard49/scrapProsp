/**
 * Audit GP elec — extraction Keyword Planner réelle (lecture seule).
 * Volumes + concurrence + fourchettes d'enchères haut de page, géo Angers / Maine-et-Loire.
 *
 *   node --import tsx scripts/audit-gp-elec-keywords.mjs
 *
 * Script jetable (audit ponctuel) — aucune écriture côté Google.
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
const { googleAdsConfigured, mccCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");
const { resolveGeoTargetConstant } = await import("../app/lib/googleAds/keywordIdeas.ts");

if (!googleAdsConfigured()) { console.error("❌ creds incomplets"); process.exit(1); }

const cust = mccCustomer();

const SEEDS = [
  "climatisation", "climatisation reversible", "installateur climatisation",
  "pompe a chaleur air air", "devis climatisation",
  "electricien", "depannage electrique", "electricien urgence", "panne electrique",
  "devis electricien", "mise aux normes electrique", "renovation electrique",
  "tableau electrique", "installation electrique", "consuel",
  "domotique", "amenagement cuisine electricite",
];

const euros = (micros) => (Number(micros || 0) / 1e6);
const COMP = { 0: "?", 1: "?", 2: "FAIBLE", 3: "MOYENNE", 4: "FORTE", UNSPECIFIED: "?", UNKNOWN: "?", LOW: "FAIBLE", MEDIUM: "MOYENNE", HIGH: "FORTE" };

async function ideas(geo, seeds, url) {
  const seed = url
    ? { keyword_and_url_seed: { keywords: seeds, url } }
    : { keyword_seed: { keywords: seeds } };
  const res = await cust.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: MCC_ID,
    language: "languageConstants/1002",
    geo_target_constants: [geo],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
    ...seed,
  });
  const rows = Array.isArray(res) ? res : (res?.results ?? []);
  if (!rows.length) {
    console.log("  [debug] type=", Array.isArray(res) ? "array" : typeof res,
      "keys=", res && !Array.isArray(res) ? Object.keys(res).slice(0, 12) : "-",
      "len=", rows.length);
  }
  return rows.map((r) => {
    const m = r.keyword_idea_metrics ?? {};
    return {
      text: (r.text ?? "").trim(),
      vol: Number(m.avg_monthly_searches ?? 0),
      comp: COMP[m.competition] ?? String(m.competition ?? "?"),
      compIndex: m.competition_index != null ? Number(m.competition_index) : null,
      bidLow: euros(m.low_top_of_page_bid_micros),
      bidHigh: euros(m.high_top_of_page_bid_micros),
      months: (m.monthly_search_volumes ?? []).slice(-12).map((x) => ({
        m: `${x.year}-${String(x.month).padStart(2, "0")}`, v: Number(x.monthly_searches ?? 0),
      })),
    };
  }).filter((k) => k.text);
}

const out = {};
for (const loc of ["Angers", "Maine-et-Loire", "Brissac Loire Aubance"]) {
  const geo = await resolveGeoTargetConstant(cust, loc);
  console.log(`\n${"=".repeat(70)}\n📍 ${loc} → ${geo || "NON RÉSOLU"}`);
  if (!geo) continue;
  let rows;
  try {
    rows = await ideas(geo, SEEDS, "https://gp-elec-49.com/");
  } catch (e) {
    console.error("  échec:", e?.errors?.[0]?.message || e?.message || e);
    continue;
  }
  rows.sort((a, b) => b.vol - a.vol);
  out[loc] = { geo, rows };
  console.log(`  ${rows.length} idées — top 45 (vol ≥ 10) :\n`);
  console.log("  " + "mot-clé".padEnd(44) + "vol/mois".padStart(9) + "  conc.".padEnd(10) + "  enchère haut de page");
  for (const r of rows.filter((r) => r.vol >= 10).slice(0, 45)) {
    console.log(
      "  " + r.text.slice(0, 43).padEnd(44) +
      String(r.vol).padStart(9) + "  " +
      (r.comp + (r.compIndex != null ? `(${r.compIndex})` : "")).padEnd(12) +
      `${r.bidLow.toFixed(2)} – ${r.bidHigh.toFixed(2)} €`,
    );
  }
}
writeFileSync("C:/Users/nicol/AppData/Local/Temp/claude/D--projets-audit/d8f84200-1c69-4971-a044-1c51d6037616/scratchpad/kw-gp-elec.json", JSON.stringify(out, null, 1));
console.log("\n✅ JSON complet écrit dans le scratchpad.");
