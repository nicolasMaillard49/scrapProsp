// Met à jour UNIQUEMENT les colonnes SIRENE dans Supabase (dirigeant, effectif,
// nature juridique, geo, etc.) à partir des CSV ré-enrichis.
// Ne touche PAS à status / notes / calls (état live de l'app).
// Match par maps_url (clé de conflit), upsert partiel → seules les colonnes
// envoyées sont écrasées, les autres restent inchangées.
//
// Usage: node scripts/update-sirene-supabase.mjs
// Requiert : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (.env.local)

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "public");

// charge .env.local manuellement (pas de dépendance dotenv)
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const BATCH_SIZE = 100;

const date = (r) => (r && r !== "" ? r : null);
const int = (r) => {
  if (!r || r === "") return null;
  const n = parseInt(r, 10);
  return Number.isNaN(n) ? null : n;
};
const flt = (r) => {
  if (r === undefined || r === null || r === "") return null;
  const n = Number(String(r).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const bool = (r) => (r === "true" ? true : r === "false" ? false : null);

const manifest = JSON.parse(
  readFileSync(resolve(PUBLIC_DIR, "manifest.json"), "utf8"),
);

const rows = [];
for (const region of manifest.regions) {
  const csvPath = resolve(PUBLIC_DIR, region.csv.replace(/^\//, ""));
  if (!existsSync(csvPath)) continue;
  const { data } = Papa.parse(readFileSync(csvPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });
  for (const row of data) {
    if (!row.name || !row.phone || !row.maps_url) continue;
    rows.push({
      // clés requises (NOT NULL) — inchangées, mais nécessaires pour l'upsert
      maps_url: row.maps_url,
      name: row.name,
      phone: row.phone,
      // colonnes SIRENE (les seules réellement mises à jour ici)
      siret: row.siret || null,
      naf_code: row.naf_code || null,
      company_created_at: date(row.created_at),
      age_years: int(row.age_years),
      legal_status: row.legal_status || null,
      dirigeant_nom: row.dirigeant_nom || null,
      dirigeant_prenom: row.dirigeant_prenom || null,
      dirigeant_annee_naissance: int(row.dirigeant_annee_naissance),
      tranche_effectif: row.tranche_effectif || null,
      effectif_label: row.effectif_label || null,
      latitude: flt(row.latitude),
      longitude: flt(row.longitude),
      est_rge: bool(row.est_rge),
      nature_juridique: row.nature_juridique || null,
      categorie: row.categorie || null,
    });
  }
}

console.log(`${rows.length} prospects à synchroniser (colonnes SIRENE seulement)`);

let done = 0;
let withName = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error } = await supabase
    .from("prospects")
    .upsert(batch, { onConflict: "maps_url" });
  if (error) {
    console.error(`  Batch ${i / BATCH_SIZE + 1} erreur:`, error.message);
    continue;
  }
  done += batch.length;
  withName += batch.filter((b) => b.dirigeant_nom).length;
  console.log(`  ${done}/${rows.length}`);
}

console.log(`\n✓ ${done} prospects mis à jour · ${withName} avec nom dirigeant`);
