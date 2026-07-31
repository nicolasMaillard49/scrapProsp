// Applique supabase/migration-020-ig-provider-state.sql
// (chaîne de sources Instagram : dédup par ig_user_id + mémoire des pannes).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-020.mjs

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

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-020-ig-provider-state.sql"), "utf-8");
  await client.query(sql);

  const { rows } = await client.query(
    "SELECT (SELECT count(*) FROM instagram_prospects)::int AS prospects," +
      " (SELECT count(*) FROM instagram_prospects WHERE ig_user_id IS NOT NULL)::int AS avec_id," +
      " (SELECT count(*) FROM ig_provider_state)::int AS providers",
  );
  const r = rows[0];
  console.log(
    `✓ Migration 020 appliquée — ${r.prospects} prospects, dont ${r.avec_id} avec ig_user_id, ${r.providers} état(s) provider.`,
  );
  console.log("ℹ ig_user_id se remplit au fil des prochains scans ; l'historique reste sans id (dédup par username, comme avant).");
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
