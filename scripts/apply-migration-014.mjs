// Applique supabase/migration-014-phone-dedup.sql (colonne phone_norm + index unique).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-014.mjs

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

  // Garde-fou : s'il reste des doublons de téléphone, l'index unique échouerait.
  const { rows: dups } = await client.query(`
    SELECT phone_norm, count(*) AS n
    FROM (SELECT right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 9) AS phone_norm FROM prospects) s
    WHERE char_length(phone_norm) = 9
    GROUP BY phone_norm HAVING count(*) > 1
  `);
  if (dups.length > 0) {
    console.error(`❌ ${dups.length} numéros encore en double — lance d'abord: node scripts/delete-duplicates.mjs --apply`);
    process.exit(1);
  }

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-014-phone-dedup.sql"), "utf-8");
  await client.query(sql);

  const { rows } = await client.query(
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE char_length(phone_norm)=9)::int AS valid FROM prospects",
  );
  console.log(`✓ Migration 014 appliquée — index unique sur phone_norm (${rows[0].valid}/${rows[0].total} numéros valides protégés).`);
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
