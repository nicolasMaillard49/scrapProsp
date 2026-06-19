/**
 * Diag : teste le pipeline "meilleurs mots-clés via API" (option 2 — géo par ville).
 * Lecture seule (Keyword Plan Idea Service + GeoTargetConstant suggest), aucun
 * écrit Google. Requiert les 4 creds GOOGLE_ADS_* dans .env.local (copier depuis Vercel).
 *
 *   node --import tsx scripts/diag-keyword-ideas.mjs [metier] [ville] [url]
 *   node --import tsx scripts/diag-keyword-ideas.mjs couvreur "Cormelles-le-Royal"
 */
import { readFileSync } from "fs";

// Charge .env.local dans process.env AVANT d'importer le client (qui lit process.env).
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const metier = process.argv[2] || "couvreur";
const ville = process.argv[3] || "Cormelles-le-Royal";
const url = process.argv[4] || null;

const { googleAdsConfigured, mccCustomer, MCC_ID } = await import("../app/lib/googleAds/client.ts");
const { bestKeywordsForLead } = await import("../app/lib/googleAds/keywordIdeas.ts");

if (!googleAdsConfigured()) {
  console.error("❌ Credentials Google Ads incomplets dans .env.local (GOOGLE_ADS_DEVELOPER_TOKEN / CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN).");
  process.exit(1);
}

console.log(`🔎 Recherche des mots-clés pour "${metier}" — ville: ${ville}${url ? ` — url: ${url}` : ""}\n`);

const { keywords, geoUsed } = await bestKeywordsForLead(mccCustomer(), MCC_ID, {
  metier,
  service: metier,
  ville,
  department: null,
  url,
});

console.log(`Géo utilisée pour l'estimation de volume : ${geoUsed}`);
console.log(`${keywords.length / 2} mots-clés uniques retenus (chacun en PHRASE + EXACT) :\n`);
const uniques = [...new Set(keywords.map((k) => k.text))];
for (const t of uniques) console.log(`  • ${t}`);
if (!uniques.length) console.log("  (aucun — l'appelant retomberait sur les mots-clés rule-based city-free)");
