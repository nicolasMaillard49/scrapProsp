// Supprime les prospects dont le numéro est une ligne FIXE géographique (01-05).
// On ne garde que les mobiles (06/07) et les éventuels 08/09 ; les fixes ne
// reçoivent pas de SMS et sont écartés de la prospection.
//
// Dry-run par défaut : affiche la répartition par préfixe sans rien toucher.
// Pour supprimer réellement : node scripts/delete-fixes.mjs --apply
//
// Préfixes ciblés configurables : PREFIXES=1,2,3,4,5 (défaut = tous les fixes).
// Lit les clés depuis .env.local (SUPABASE_SECRET_KEY = service role,
// nécessaire pour passer outre la RLS sur DELETE). Les FK vers prospects sont
// toutes ON DELETE CASCADE / SET NULL → la suppression suffit.

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

const APPLY = process.argv.includes("--apply");
const PREFIXES = new Set((process.env.PREFIXES || "1,2,3,4,5").split(",").map((s) => s.trim()));

/** Forme canonique FR = 9 derniers chiffres (sans 0/+33). "" si inexploitable. */
function normalizePhoneFR(phone) {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length >= 11) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.slice(-9);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

// PostgREST plafonne chaque requête à ~1000 lignes → on pagine.
const PAGE = 1000;
const data = [];
for (let from = 0; ; from += PAGE) {
  const { data: rows, error } = await sb
    .from("prospects")
    .select("id, name, phone, status")
    .order("id", { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error("Fetch error:", error.message);
    process.exit(1);
  }
  data.push(...rows);
  if (rows.length < PAGE) break;
}

console.log(`Prospects en base: ${data.length}`);

// Répartition par préfixe + collecte des cibles (fixes).
const byPrefix = {};
const targets = [];
let unclassifiable = 0;
for (const p of data) {
  const c = normalizePhoneFR(p.phone);
  if (c.length !== 9) {
    unclassifiable++;
    continue;
  }
  const prefix = `0${c[0]}`;
  byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  if (PREFIXES.has(c[0])) targets.push(p);
}

console.log("Par préfixe:", byPrefix);
console.log(`Numéros non classables (vides / non FR): ${unclassifiable}`);
console.log(`\nFixes ${[...PREFIXES].map((d) => `0${d}`).join("/")} détectés: ${targets.length}`);

// On PRÉSERVE tout prospect ayant un rapport concurrent (FK NOT NULL + CASCADE :
// supprimer le prospect détruirait le rapport). On les retire des cibles.
const withReport = new Set();
for (let from = 0; ; from += PAGE) {
  const { data: rows, error } = await sb
    .from("competitor_reports")
    .select("prospect_id")
    .order("prospect_id", { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error("Fetch competitor_reports error:", error.message);
    process.exit(1);
  }
  for (const r of rows) if (r.prospect_id) withReport.add(r.prospect_id);
  if (rows.length < PAGE) break;
}

const spared = targets.filter((p) => withReport.has(p.id));
const toDelete = targets.filter((p) => !withReport.has(p.id));
console.log(`Préservés (rapport concurrent existant): ${spared.length}`);
console.log(`\nCibles finales à supprimer: ${toDelete.length}`);
targets.length = 0;
targets.push(...toDelete);

const byStatus = {};
for (const p of targets) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
console.log("Cibles par statut:", byStatus);

if (targets.length === 0) {
  console.log("Rien à supprimer.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nExemples:", targets.slice(0, 8).map((p) => `${p.name} (${p.phone})`));
  console.log("\n[DRY-RUN] Aucune suppression effectuée. Relance avec --apply pour supprimer.");
  process.exit(0);
}

// Suppression par lots : un .in() de milliers d'UUID dépasse la limite d'URL (414).
const ids = targets.map((p) => p.id);
const CHUNK = 200;
let deleted = 0;
for (let i = 0; i < ids.length; i += CHUNK) {
  const slice = ids.slice(i, i + CHUNK);
  const { error: dErr } = await sb.from("prospects").delete().in("id", slice);
  if (dErr) {
    console.error(`Suppression lot ${i}-${i + slice.length}:`, dErr.message);
    process.exit(1);
  }
  deleted += slice.length;
  process.stdout.write(`\r  supprimés: ${deleted}/${ids.length}`);
}
console.log(`\n\n✓ Supprimé ${deleted} prospect(s) avec numéro fixe.`);
