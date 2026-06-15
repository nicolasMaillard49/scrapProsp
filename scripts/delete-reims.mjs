// Supprime tous les prospects d'une ville (par défaut Reims).
// Dry-run par défaut : affiche ce qui serait supprimé sans rien toucher.
// Pour supprimer réellement : node scripts/delete-reims.mjs --apply
//
// Lit les clés depuis .env.local (SUPABASE_SECRET_KEY = service role,
// nécessaire pour passer outre la RLS sur DELETE).

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

const VILLE = process.env.VILLE || "Reims";
const APPLY = process.argv.includes("--apply");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

// Match insensible à la casse / accents partiels via ilike.
const { data, error } = await sb
  .from("prospects")
  .select("id, name, ville, status")
  .ilike("ville", `%${VILLE}%`);

if (error) {
  console.error("Fetch error:", error.message);
  process.exit(1);
}

console.log(`Ville filtre: %${VILLE}%`);
console.log(`Prospects trouvés: ${data.length}`);
const byVille = {};
for (const p of data) byVille[p.ville] = (byVille[p.ville] || 0) + 1;
console.log("Par ville:", byVille);
const byStatus = {};
for (const p of data) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
console.log("Par statut:", byStatus);

if (data.length === 0) {
  console.log("Rien à supprimer.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\n[DRY-RUN] Aucune suppression effectuée. Relance avec --apply pour supprimer.");
  process.exit(0);
}

const ids = data.map((p) => p.id);
// Supprime d'abord les calls liés (FK), puis les prospects.
const { error: cErr } = await sb.from("calls").delete().in("prospect_id", ids);
if (cErr) console.error("Suppression calls:", cErr.message);

const { error: dErr } = await sb.from("prospects").delete().in("id", ids);
if (dErr) {
  console.error("Suppression prospects:", dErr.message);
  process.exit(1);
}
console.log(`\n✓ Supprimé ${ids.length} prospect(s) de "${VILLE}".`);
