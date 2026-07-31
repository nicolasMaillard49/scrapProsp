// Remplit la SÉLECTION DU JOUR jusqu'au plafond du compte, en autonomie.
//
//   npx tsx scripts/fill-selection.mts                       # refill seul (trie le stock, puis scanne)
//   npx tsx scripts/fill-selection.mts electricien,plombier  # + amorce un scan sur ces métiers
//
// Déroulé :
//  1. déclare les métiers demandés comme cibles de chasse (ig_hunt_targets) ;
//  2. pour chaque métier AMORCÉ, scanne un hashtag jamais utilisé (variété du mix) ;
//  3. boucle `refillStock()` — trie d'abord le stock déjà scrapé (Claude seul),
//     ne paie un scan Apify que s'il n'y a plus rien à trier — jusqu'à ce que la
//     sélection soit pleine, qu'il n'y ait plus rien à faire, ou le plafond de tours.
//
// Les coûts (Apify + Claude) sont bornés : 1 hashtag et 1 lot de qualification par tour.

import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim();
}

const { supabase } = await import("../app/lib/supabase.ts");
const { ensureDailySelection, refillStock, countAvailableStock } = await import("../app/lib/igSelection.ts");
const { discoverHashtag } = await import("../app/lib/igDiscover.ts");
const { qualifyRun } = await import("../app/lib/igQualifyRun.ts");
const { generateMetierHashtags } = await import("../app/lib/hashtags.ts");

const SEED = (process.argv[2] ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const MAX_TOURS = Number(process.argv[3] ?? 14);
const PAR_HASHTAG = 40; // profils visés par scan — borne le coût Apify

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Déclare les métiers en cibles de chasse (idempotent). */
async function ajouterCibles(metiers: string[]) {
  for (const m of metiers) {
    const { error } = await supabase
      .from("ig_hunt_targets")
      .upsert({ metier: m, avatar_profession: m, active: true }, { onConflict: "metier", ignoreDuplicates: true });
    if (error) log(`  ⚠ cible ${m} : ${error.message}`);
  }
}

/** Prochain hashtag jamais scanné pour ce métier (même règle que le refill). */
async function hashtagNeuf(metier: string): Promise<string | null> {
  const rows = generateMetierHashtags(metier, { includeTransversal: false });
  if (!rows.length) return null;
  const { data } = await supabase
    .from("instagram_prospects")
    .select("hashtag_source")
    .in("hashtag_source", rows.map((r) => r.hashtag))
    .limit(10_000);
  const used = new Set((data ?? []).map((r) => r.hashtag_source as string));
  return rows.map((r) => r.hashtag).find((h) => !used.has(h)) ?? null;
}

async function etat(label: string) {
  const sel = await ensureDailySelection();
  log(
    `${label} — sélection ${sel.rows.filter((r) => !r.skipped_at).length}/${sel.slots}` +
      ` · manquants ${sel.shortfall} · réserve qualifiée ${await countAvailableStock()}`,
  );
  return sel;
}

log(`Cibles à amorcer : ${SEED.length ? SEED.join(", ") : "(aucune)"} · plafond ${MAX_TOURS} tours`);
if (SEED.length) await ajouterCibles(SEED);
let sel = await etat("Départ");

// ── Phase 1 : variété — un scan neuf par métier demandé ──
for (const m of SEED) {
  if (sel.shortfall === 0) break;
  const h = await hashtagNeuf(m);
  if (!h) {
    log(`  ${m} : plus de hashtag neuf, on passe`);
    continue;
  }
  log(`  scan #${h} (${m})…`);
  try {
    const scan = await discoverHashtag({ hashtag: h, target: PAR_HASHTAG });
    await supabase.from("ig_hunt_targets").update({ last_scan_at: new Date().toISOString() }).eq("metier", m);
    log(`  → ${scan.scanned} profils scannés, ${scan.inserted} insérés`);
    if (scan.inserted) {
      const q = await qualifyRun({
        hashtag: h,
        status: "todo",
        onlyUnqualified: true,
        limit: Math.min(scan.inserted, 400),
        avatar: { profession: m, minFollowers: 0, maxFollowers: 2500 },
      });
      log(`  → IA : ${q.processed} triés, ${q.qualified} retenus (${q.borderline} limites, ${q.rejected} écartés)`);
    }
  } catch (e) {
    log(`  ⚠ ${m} : ${e instanceof Error ? e.message : String(e)}`);
  }
  sel = await etat(`Après ${m}`);
}

// ── Phase 2 : refill en escalier jusqu'à remplir la sélection ──
for (let tour = 1; tour <= MAX_TOURS && sel.shortfall > 0; tour++) {
  const r = await refillStock();
  if (!r.ran) {
    log(`Tour ${tour} : stop — ${r.reason}`);
    break;
  }
  log(
    r.mode === "qualify"
      ? `Tour ${tour} : tri IA ${r.metier} — ${r.processed} triés, ${r.qualified} retenus`
      : `Tour ${tour} : scan #${r.hashtag} (${r.metier}) — ${r.inserted} insérés, ${r.qualified} retenus`,
  );
  sel = await etat(`Tour ${tour}`);
}

const finale = await ensureDailySelection();
const parMetier = new Map<string, number>();
for (const r of finale.rows) {
  const p = r.prospect as { profession_ia?: string | null; metier?: string | null };
  const k = (p.profession_ia || p.metier || "?").toLowerCase();
  parMetier.set(k, (parMetier.get(k) ?? 0) + 1);
}
log(`\n=== SÉLECTION DU JOUR : ${finale.rows.filter((r) => !r.skipped_at).length}/${finale.slots} ===`);
log([...parMetier.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}=${n}`).join(", "));
