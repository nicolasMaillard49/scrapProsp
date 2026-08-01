// Applique supabase/migration-023-ig-hunt-poids.sql
// (tourniquet de chasse pondéré : les artisans passent 3× plus souvent).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-023.mjs

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

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-023-ig-hunt-poids.sql"), "utf-8");
  await client.query(sql);

  // Part de volume réellement obtenue : c'est le rapport des poids cumulés, pas
  // le nombre de métiers. C'est ce chiffre-là qu'il faut relire pour arbitrer.
  const { rows } = await client.query(
    "SELECT poids, count(*)::int AS metiers, (poids * count(*))::int AS tours" +
      " FROM ig_hunt_targets WHERE active GROUP BY poids ORDER BY poids DESC",
  );
  const total = rows.reduce((s, r) => s + r.tours, 0);
  console.log("✓ Migration 023 appliquée.");
  for (const r of rows) {
    console.log(`   poids ${r.poids} : ${r.metiers} métier(s) → ${Math.round((100 * r.tours) / total)} % des tours`);
  }
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
