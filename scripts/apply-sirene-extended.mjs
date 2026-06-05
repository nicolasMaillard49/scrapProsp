// Applique l'enrichissement SIRENE élargi sur une base Supabase DÉJÀ peuplée,
// SANS toucher à la progression de prospection (status / notes / calls).
//
// 1. applique supabase/migration-003-sirene-extended.sql (ALTER TABLE idempotent)
// 2. lit les CSV enrichis et fait un UPDATE des SEULES nouvelles colonnes,
//    matché par maps_url (les lignes existantes uniquement — aucun INSERT).
//
// Connexion Postgres directe (le DDL est impossible via les clés API).
// Requiert SUPABASE_DB_URL (connection string Supabase, mode Session de préférence)
// — lu depuis l'environnement ou depuis .env.local.
//
// Usage : node scripts/apply-sirene-extended.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import Papa from "papaparse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "public");

// ── charge .env.local sans écraser l'environnement déjà défini ──────────────
function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error(
    "❌ SUPABASE_DB_URL manquant. Ajoute la connection string Supabase\n" +
      "   (Settings → Database → Connection string → Session) dans .env.local :\n" +
      "   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres",
  );
  process.exit(1);
}

// ── helpers de parsing (CSV string → valeur typée) ──────────────────────────
const str = (v) => (v && v !== "" ? v : null);
const int = (v) => {
  if (!v || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};
const flt = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const bool = (v) => (v === "true" ? true : v === "false" ? false : null);

// ── lecture des CSV via le manifest ─────────────────────────────────────────
const manifest = JSON.parse(readFileSync(resolve(PUBLIC_DIR, "manifest.json"), "utf-8"));
const rows = [];
for (const region of manifest.regions) {
  const csvPath = resolve(PUBLIC_DIR, region.csv.replace(/^\//, ""));
  if (!existsSync(csvPath)) {
    console.warn(`  ⚠ CSV introuvable : ${csvPath}`);
    continue;
  }
  const csv = readFileSync(csvPath, "utf-8");
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  for (const r of data) {
    if (!r.maps_url) continue;
    rows.push(r);
  }
}
console.log(`Lignes CSV avec maps_url : ${rows.length}`);

// ── connexion + application ─────────────────────────────────────────────────
const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const UPDATE = {
  name: "update_sirene_extended",
  text: `UPDATE prospects SET
            dirigeant_nom = $2,
            dirigeant_prenom = $3,
            dirigeant_annee_naissance = $4,
            tranche_effectif = $5,
            effectif_label = $6,
            latitude = $7,
            longitude = $8,
            est_rge = $9,
            nature_juridique = $10,
            categorie = $11
          WHERE maps_url = $1`,
};

try {
  await client.connect();
  console.log("✓ Connecté à Postgres");

  // 1) migration (DDL idempotent)
  const migSql = readFileSync(
    resolve(ROOT, "supabase", "migration-003-sirene-extended.sql"),
    "utf-8",
  );
  await client.query(migSql);
  console.log("✓ Migration 003 appliquée (colonnes ajoutées si absentes)");

  // 2) UPDATE ciblé dans une transaction
  await client.query("BEGIN");
  let matched = 0;
  let enriched = 0;
  for (const r of rows) {
    const res = await client.query(UPDATE, [
      r.maps_url,
      str(r.dirigeant_nom),
      str(r.dirigeant_prenom),
      int(r.dirigeant_annee_naissance),
      str(r.tranche_effectif),
      str(r.effectif_label),
      flt(r.latitude),
      flt(r.longitude),
      bool(r.est_rge),
      str(r.nature_juridique),
      str(r.categorie),
    ]);
    matched += res.rowCount;
    if (res.rowCount && (r.dirigeant_nom || r.latitude || r.siret)) enriched++;
  }
  await client.query("COMMIT");

  console.log(`\n✓ ${matched}/${rows.length} prospects mis à jour (${enriched} avec données SIRENE)`);
  console.log("  Statuts, notes et historique d'appels : INTACTS.");
} catch (err) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* ignore */
  }
  console.error("\n❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
