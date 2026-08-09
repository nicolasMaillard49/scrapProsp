// Applique supabase/migration-030-crm-supervision.sql (CRM : supervision (maintenance mensuelle,
// factures).
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-030.mjs

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

  const sql = readFileSync(resolve(ROOT, "supabase", "migration-030-crm-supervision.sql"), "utf-8");
  await client.query(sql);
  console.log("✓ Migration 030 appliquée");

  // On VÉRIFIE ce qui existe réellement plutôt que de faire confiance au fait
  // que la requête n'ait pas levé : une migration idempotente qui ne crée rien
  // et une migration qui a tout créé rendent le même silence.
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'client_invoices'`,
  );
  console.log(tables.length ? "  table client_invoices ✓" : "  ❌ table client_invoices absente");
  if (!tables.length) process.exit(1);

  const { rows: col } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'clients' AND column_name = 'maintenance_ht'`,
  );
  console.log(col.length ? "  colonne clients.maintenance_ht ✓" : "  ❌ colonne maintenance_ht absente");
  if (!col.length) process.exit(1);

  // L'unicité (client, période) : refacturer deux fois le même mois est la
  // faute qu'un client remarque tout de suite.
  const { rows: idx } = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE tablename = 'client_invoices' AND indexname = 'client_invoices_periode_uniq'`,
  );
  console.log(idx.length ? "  index unique (client, période) ✓" : "  ⚠️ index unique manquant");

  const { rows: sup } = await client.query(
    "SELECT count(*)::int AS n FROM clients WHERE maintenance_ht IS NOT NULL AND maintenance_ht > 0",
  );
  const { rows: fact } = await client.query("SELECT count(*)::int AS n FROM client_invoices");
  console.log(`\n${sup[0].n} dossier(s) en supervision · ${fact[0].n} échéance(s) enregistrée(s)`);
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
