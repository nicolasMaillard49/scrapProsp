// Scan one-shot : repère les prospects source=ads (avec site) qui font DÉJÀ de la pub
// Google, et les écarte du pool Ads (source -> "ads_exclu", uniquement status=todo).
// Usage : node .preview/scan-ads-existing.mjs [--apply]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPLY = process.argv.includes("--apply");

const ROOT = resolve(import.meta.dirname, "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  if (!(key in process.env)) process.env[key] = t.slice(eq + 1).trim();
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// Tous les prospects ads avec site (pagination)
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(
    `${SB_URL}/rest/v1/prospects?select=id,name,website,metier,ville,status&source=eq.ads&website=not.is.null&limit=1000&offset=${offset}`,
    { headers },
  );
  if (!res.ok) throw new Error(`Supabase: ${res.status}`);
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
console.log(`${rows.length} prospects source=ads avec site à vérifier${APPLY ? " (mode APPLY)" : " (dry-run)"}\n`);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

async function hasGoogleAdsTag(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (!res.ok) return false;
    const html = await res.text();
    return /AW-\d{6,}/.test(html) || /googleads\.g\.doubleclick\.net|googleadservices\.com/.test(html);
  } catch {
    return false;
  }
}

// Concurrence 10
const hits = [];
let done = 0;
const queue = [...rows];
await Promise.all(
  Array.from({ length: 10 }, async () => {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      const has = await hasGoogleAdsTag(p.website);
      done++;
      if (done % 50 === 0) console.log(`  …${done}/${rows.length}`);
      if (has) {
        hits.push(p);
        console.log(`🟠 ${p.name} (${p.metier}, ${p.ville}) [${p.status}] — ${p.website}`);
      }
    }
  }),
);

console.log(`\n=> ${hits.length}/${rows.length} font déjà de la pub Google`);

const todoHits = hits.filter((p) => p.status === "todo");
const engagedHits = hits.filter((p) => p.status !== "todo");
if (engagedHits.length) {
  console.log(`⚠️ ${engagedHits.length} déjà engagés (non modifiés) : ${engagedHits.map((p) => `${p.name} [${p.status}]`).join(", ")}`);
}

if (APPLY && todoHits.length) {
  let updated = 0;
  for (const p of todoHits) {
    const res = await fetch(`${SB_URL}/rest/v1/prospects?id=eq.${p.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ source: "ads_exclu" }),
    });
    if (res.ok) updated++;
    else console.log(`ERREUR update ${p.name}: ${res.status} ${await res.text().catch(() => "")}`);
  }
  console.log(`✔ ${updated}/${todoHits.length} passés en source=ads_exclu`);
} else if (todoHits.length) {
  console.log(`(dry-run — relance avec --apply pour écarter les ${todoHits.length} en todo)`);
}
