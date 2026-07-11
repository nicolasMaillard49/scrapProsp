// Rapport concurrentiel d'un prospect Instagram.
//
// À partir d'un prospect IG (métier + ville), interroge le scraper Maps
// (POST {SCRAPER_URL}/scrape) pour :
//   1. son CLASSEMENT sur « métier ville » (rang dans le pack Maps, ou absent) ;
//   2. la LISTE de ses concurrents (noms, note, avis) ;
//   3. QUI fait des Google Ads : résultat sponsorisé Maps ("/aclk…") = ads en
//      direct ; sinon on va lire leur site et on cherche le tag de conversion Ads.
//
// Usage :
//   npx tsx scripts/ig-competitor-report.mts <username|uuid> [--full] [--json]
//   --full : scrape complet (quick:false, ~4× plus lent) si le mode rapide ne
//            remonte pas les résultats sponsorisés.
//   --json : sort le rapport en JSON brut (pour brancher une UI ensuite).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

const SCRAPER_URL = env.SCRAPER_URL || "http://51.255.200.169:8001";
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);

// ── Prospect IG ──────────────────────────────────────────────────────────────
const COLS = "id, username, full_name, metier, profession_ia, ville";
let { data: found } = await sb.from("instagram_prospects").select(COLS).eq("username", arg).limit(1);
if (!found?.length && /^[0-9a-f-]{6,}$/i.test(arg)) {
  found = (await sb.from("instagram_prospects").select(COLS).eq("id", arg).limit(1)).data;
}
const p = found?.[0];
if (!p) {
  console.error(`Prospect introuvable : « ${arg} » (essaie le username exact ou l'UUID complet).`);
  process.exit(1);
}

const metier = (p.profession_ia || p.metier || "").trim();
const ville = (p.ville || "").trim();
if (!metier || !ville) {
  console.error(
    `Impossible de classer @${p.username} : ${!metier ? "métier" : ""}${!metier && !ville ? " et " : ""}${!ville ? "ville" : ""} manquant en base.`,
  );
  process.exit(1);
}

// ── Scraper Maps ─────────────────────────────────────────────────────────────
interface Comp {
  name: string;
  rating?: string;
  reviews?: string;
  website?: string;
  phone?: string;
  address?: string;
  maps_url?: string;
}
const LIMIT = 20;
console.error(`Scrape « ${metier} ${ville} » (limit ${LIMIT}, ${FULL ? "complet" : "rapide"})…`);
const res = await fetch(`${SCRAPER_URL}/scrape`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ metier, ville, limit: LIMIT, quick: !FULL }),
  signal: AbortSignal.timeout(FULL ? 240_000 : 120_000),
});
if (!res.ok) {
  console.error(`Scraper HTTP ${res.status} : ${await res.text().catch(() => "")}`);
  process.exit(1);
}
const competitors: Comp[] = (await res.json()).competitors ?? [];
if (!competitors.length) {
  console.error("Le scraper n'a renvoyé aucun résultat pour cette recherche.");
  process.exit(1);
}

// ── Détection Google Ads ─────────────────────────────────────────────────────
const isSponsored = (c: Comp) => (c.website ?? "").trim().startsWith("/aclk");
const cleanSite = (c: Comp) => {
  const w = (c.website ?? "").trim();
  return w.startsWith("http") ? w : null;
};
async function hasGoogleAdsTag(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!r.ok) return false;
    const html = await r.text();
    return /AW-\d{6,}/.test(html) || /googleads\.g\.doubleclick\.net|googleadservices\.com/.test(html);
  } catch {
    return false;
  }
}

// Signal ads par concurrent : "sponso" (annonce Maps en direct), "tag" (tag de
// conversion Ads sur le site), ou "non". Les checks site tournent en parallèle.
const tagChecks = await Promise.all(
  competitors.map(async (c) => {
    if (isSponsored(c)) return "sponso" as const;
    const site = cleanSite(c);
    return site && (await hasGoogleAdsTag(site)) ? ("tag" as const) : ("non" as const);
  }),
);

// ── Rang du prospect (match par nom) ─────────────────────────────────────────
const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const rawTokens = (s: string) => norm(s).split(" ").filter(Boolean);
// Mots à ignorer pour le match : génériques + LA VILLE et LE MÉTIER cherchés
// (sinon on matche un concurrent sur « biarritz » ou « paysagiste », qui sont
// dans la requête et donc du bruit). C'est ce qui créait le faux positif.
const STOP = new Set([
  "paysagiste", "paysagisme", "elagage", "jardin", "jardins", "espace", "vert", "verts",
  "sarl", "eurl", "entreprise", "sas", "fils", "and", "et", "de", "la", "le", "les", "du", "des",
  ...rawTokens(ville),
  ...rawTokens(metier),
]);
const tokens = (s: string) => rawTokens(s).filter((t) => t.length >= 4 && !STOP.has(t));

const pTokens = new Set([...tokens(p.full_name || ""), ...tokens(p.username)]);
let selfRank = -1;
let selfMatchName = "";
competitors.forEach((c, i) => {
  if (selfRank !== -1) return;
  const cTok = tokens(c.name);
  const overlap = cTok.filter((t) => pTokens.has(t));
  if (overlap.length >= 1) {
    selfRank = i + 1;
    selfMatchName = c.name;
  }
});

// ── Sortie ───────────────────────────────────────────────────────────────────
const adsCount = tagChecks.filter((t) => t !== "non").length;
const sponsoCount = tagChecks.filter((t) => t === "sponso").length;

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        prospect: { username: p.username, name: p.full_name, metier, ville },
        self_rank: selfRank === -1 ? null : selfRank,
        self_match: selfMatchName || null,
        ads_advertisers: adsCount,
        sponsored_now: sponsoCount,
        competitors: competitors.map((c, i) => ({
          rank: i + 1,
          name: c.name,
          rating: c.rating ?? null,
          reviews: c.reviews ?? null,
          website: isSponsored(c) ? null : cleanSite(c),
          ads: tagChecks[i],
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const LABEL = { sponso: "🟢 ADS (sponsorisé)", tag: "🟡 ads (tag site)", non: "⚪ pas d'ads" } as const;
console.log("");
console.log(`═══ Rapport concurrentiel — @${p.username} ═══`);
console.log(`  ${p.full_name || "?"} · ${metier} · ${ville}`);
console.log("");
console.log(
  selfRank === -1
    ? `  📍 Classement Google Maps : ABSENT du top ${LIMIT} — invisible quand un client cherche « ${metier} ${ville} ».`
    : `  📍 Classement Google Maps : #${selfRank}/${competitors.length} (fiche « ${selfMatchName} »).`,
);
console.log(`  💸 Concurrents qui font des Google Ads : ${adsCount}/${competitors.length}  (dont ${sponsoCount} sponsorisés en direct).`);
console.log("");
console.log("  Rang  Ads                    Note   Avis   Concurrent");
console.log("  ────  ─────────────────────  ─────  ─────  ──────────────────────────────");
competitors.forEach((c, i) => {
  const me = selfRank === i + 1 ? " ← LUI" : "";
  const rating = c.rating ? String(c.rating).padStart(4) : "   –";
  const reviews = c.reviews ? String(c.reviews).padStart(4) : "   –";
  console.log(`  #${String(i + 1).padStart(2)}   ${LABEL[tagChecks[i]].padEnd(21)}  ${rating}   ${reviews}   ${c.name}${me}`);
});
console.log("");
console.log("  Pour le DM :");
if (selfRank === -1) {
  console.log(`  « J'ai regardé "${metier} ${ville}" sur Google : t'apparais pas dans les résultats,`);
} else {
  console.log(`  « J'ai regardé "${metier} ${ville}" sur Google : t'es #${selfRank},`);
}
console.log(`    et ${adsCount} de tes concurrents paient déjà pour passer devant toi. »`);
console.log("");
