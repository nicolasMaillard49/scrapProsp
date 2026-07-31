// Applique supabase/migration-019-ig-daily-selection.sql
// (sélection du jour fermée + cibles de chasse pour le refill automatique).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-019.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
  console.error("❌ SUPABASE_DB_URL manquant dans .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("✓ Connecté à Postgres");

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-019-ig-daily-selection.sql"), "utf-8");
  await client.query(sql);

  const { rows } = await client.query(
    "SELECT (SELECT count(*) FROM ig_daily_selection)::int AS selections," +
      " (SELECT count(*) FROM ig_hunt_targets WHERE active)::int AS cibles," +
      " (SELECT count(*) FROM instagram_prospects WHERE status = 'todo' AND qualification = 'qualified')::int AS stock",
  );
  const r = rows[0];
  console.log(
    `✓ Migration 019 appliquée — ${r.selections} lignes de sélection, ${r.cibles} cible(s) de chasse, ${r.stock} prospects qualifiés en stock.`,
  );
  if (!r.cibles) {
    console.log("ℹ Aucune cible amorcée (moins de 20 prospects par métier) : ajoute-les dans ig_hunt_targets pour activer le refill auto.");
  }
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
