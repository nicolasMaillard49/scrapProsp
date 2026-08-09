// Applique supabase/migration-029-crm-clients.sql (CRM : dossiers clients,
// checklists de mission, journal).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-029.mjs

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

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-029-crm-clients.sql"), "utf-8");
  await client.query(sql);
  console.log("✓ Migration 029 appliquée");

  // On VÉRIFIE ce qui existe réellement plutôt que de faire confiance au fait
  // que la requête n'ait pas levé : une migration idempotente qui ne crée rien
  // et une migration qui a tout créé rendent le même silence.
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('clients','client_tasks','client_notes')
      ORDER BY table_name`,
  );
  for (const t of tables) console.log(`  table ${t.table_name} ✓`);
  if (tables.length !== 3) {
    console.error(`❌ ${tables.length}/3 tables présentes — la migration n'est pas complète`);
    process.exit(1);
  }

  // Le lien souple vers la prospection : c'est LUI qui distingue ce CRM d'une
  // table de contacts isolée, et son index unique qui empêche un doublon.
  const { rows: idx } = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE tablename = 'clients' AND indexname = 'idx_clients_ig_prospect'`,
  );
  console.log(idx.length ? "  index unique instagram_prospect_id ✓" : "  ⚠️ index unique manquant");

  // Combien de dossiers pourraient s'ouvrir tout de suite.
  const { rows: bookes } = await client.query(
    "SELECT count(*)::int AS n FROM instagram_prospects WHERE stage = 'call_booke'",
  );
  const { rows: dossiers } = await client.query("SELECT count(*)::int AS n FROM clients");
  console.log(`\n${dossiers[0].n} dossier(s) client · ${bookes[0].n} prospect(s) IG au stade « call booké »`);
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
