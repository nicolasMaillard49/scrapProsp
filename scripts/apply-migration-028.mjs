// Applique supabase/migration-028-ig-no-site-quota.sql
// (plancher « sans site » de la sélection du jour, par compte émetteur).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-028.mjs

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

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-028-ig-no-site-quota.sql"), "utf-8");
  await client.query(sql);
  console.log("✓ Migration 028 appliquée");

  // Ce que le réglage vaut par compte, et ce que la réserve peut réellement
  // tenir : un plancher de 50 sur 12 sans-site en stock explique à lui seul les
  // créneaux vides qu'on verra demain matin.
  const { rows: comptes } = await client.query(
    "SELECT username, status, no_site_min FROM ig_accounts ORDER BY created_at",
  );
  for (const c of comptes) {
    console.log(`  @${c.username} (${c.status}) → plancher sans site : ${c.no_site_min}`);
  }

  const { rows: stock } = await client.query(`
    SELECT count(*) FILTER (WHERE has_website IS NOT TRUE)::int AS sans_site,
           count(*) FILTER (WHERE has_website IS TRUE)::int     AS avec_site
      FROM instagram_prospects
     WHERE status = 'todo' AND qualification = 'qualified' AND stage IS NULL
       AND id NOT IN (SELECT prospect_id FROM ig_daily_selection)
  `);
  console.log(
    `\nRéserve qualifiée jamais sélectionnée : ${stock[0].sans_site} sans site · ${stock[0].avec_site} avec site`,
  );
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
