// Rapport concurrentiel d'un prospect Instagram (CLI).
//
// À partir d'un prospect IG (métier + ville), utilise la lib partagée
// app/lib/igCompetitor.ts (même code que l'endpoint cockpit) pour :
//   1. son CLASSEMENT sur « métier ville » (rang Maps, ou absent) ;
//   2. la LISTE de ses concurrents (noms, note, avis) ;
//   3. QUI fait des Google Ads (sponsorisé "/aclk…" en direct, ou tag de
//      conversion détecté sur leur site).
//
// Usage :
//   npx tsx scripts/ig-competitor-report.mts <username|uuid> [--full] [--json]
//   --full : scrape complet (plus lent) ; --json : rapport JSON brut.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { buildCompetitorReport } from "../app/lib/igCompetitor";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const arg = process.argv[2];
const FULL = process.argv.includes("--full");
const JSON_OUT = process.argv.includes("--json");
if (!arg) {
  console.error("Usage : npx tsx scripts/ig-competitor-report.mts <username|uuid> [--full] [--json]");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);

// ── Prospect IG ──────────────────────────────────────────────────────────────
const COLS = "id, username, full_name, metier, profession_ia, ville";
let { data: found } = await sb.from("instagram_prospects").select(COLS).eq("username", arg).limit(1);
if (!found?.length && /^[0-9a-f-]{6,}$/i.test(arg)) {
  found = (await sb.from("instagram_prospects").select(COLS).eq("id", arg).limit(1)).data;
}
const p = found?.[0];
if (!p) {
  console.error(`Prospect introuvable : « ${arg} » (username exact ou UUID complet).`);
  process.exit(1);
}

const metier = (p.profession_ia || p.metier || "").trim();
const ville = (p.ville || "").trim();
if (!metier || !ville) {
  console.error(`Impossible de classer @${p.username} : ${!metier ? "métier" : ""}${!metier && !ville ? " et " : ""}${!ville ? "ville" : ""} manquant en base.`);
  process.exit(1);
}

// ── Rapport (lib partagée) ───────────────────────────────────────────────────
const LIMIT = 20;
console.error(`Scrape « ${metier} ${ville} » (limit ${LIMIT}, ${FULL ? "complet" : "rapide"})…`);
const r = await buildCompetitorReport(
  { metier, ville, fullName: p.full_name, username: p.username },
  { scraperUrl: env.SCRAPER_URL, limit: LIMIT, full: FULL },
);

// ── Sortie ───────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ prospect: { username: p.username, name: p.full_name, metier, ville }, ...r }, null, 2));
  process.exit(0);
}

const LABEL = { sponso: "🟢 ADS (sponsorisé)", tag: "🟡 ads (tag site)", non: "⚪ pas d'ads" } as const;
console.log("");
console.log(`═══ Rapport concurrentiel — @${p.username} ═══`);
console.log(`  ${p.full_name || "?"} · ${metier} · ${ville}`);
console.log("");
console.log(
  r.selfRank === null
    ? `  📍 Classement Google Maps : ABSENT du top ${r.total} — invisible quand un client cherche « ${metier} ${ville} ».`
    : `  📍 Classement Google Maps : #${r.selfRank}/${r.total} (fiche « ${r.selfMatch} »).`,
);
console.log(`  💸 Concurrents qui font des Google Ads : ${r.adsCount}/${r.total}  (dont ${r.sponsoredCount} sponsorisés en direct).`);
console.log("");
console.log("  Rang  Ads                    Note   Avis   Concurrent");
console.log("  ────  ─────────────────────  ─────  ─────  ──────────────────────────────");
for (const c of r.competitors) {
  const me = c.isSelf ? " ← LUI" : "";
  const rating = c.rating != null ? String(c.rating).padStart(4) : "   –";
  const reviews = c.reviews != null ? String(c.reviews).padStart(4) : "   –";
  console.log(`  #${String(c.rank).padStart(2)}   ${LABEL[c.ads].padEnd(21)}  ${rating}   ${reviews}   ${c.name}${me}`);
}
console.log("");
console.log("  Pour le DM :");
console.log(
  r.selfRank === null
    ? `  « J'ai regardé "${metier} ${ville}" sur Google : t'apparais pas dans les résultats,`
    : `  « J'ai regardé "${metier} ${ville}" sur Google : t'es #${r.selfRank},`,
);
console.log(`    et ${r.adsCount} de tes concurrents paient déjà pour passer devant toi. »`);
console.log("");
