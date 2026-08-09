// Applique supabase/migration-031-maintenance-jour.sql et
// supabase/migration-032-prestations.sql — le jour d'échéance de la maintenance
// et les prestations vendues.
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Usage : node scripts/apply-migration-031.mjs

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

  for (const f of ["migration-031-maintenance-jour.sql", "migration-032-prestations.sql"]) {
    await client.query(readFileSync(resolve(ROOT, "supabase", f), "utf-8"));
    console.log(`✓ ${f} appliquée`);
  }

  // On VÉRIFIE ce qui existe réellement : une migration idempotente qui ne crée
  // rien et une migration qui a tout créé rendent le même silence.
  const { rows: col } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'clients' AND column_name = 'maintenance_day'`,
  );
  console.log(col.length ? "  colonne clients.maintenance_day ✓" : "  ❌ colonne maintenance_day absente");
  if (!col.length) process.exit(1);

  const { rows: ck } = await client.query(
    "SELECT conname FROM pg_constraint WHERE conname = 'clients_maintenance_day_range'",
  );
  console.log(ck.length ? "  contrainte jour 1-31 ✓" : "  ⚠️ contrainte manquante");

  const { rows: tbl } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'client_services'`,
  );
  console.log(tbl.length ? "  table client_services ✓" : "  ❌ table client_services absente");
  if (!tbl.length) process.exit(1);

  const { rows: uniq } = await client.query(
    "SELECT indexname FROM pg_indexes WHERE indexname = 'client_services_code_uniq'",
  );
  console.log(uniq.length ? "  index unique (client, prestation) ✓" : "  ⚠️ index unique manquant");

  const { rows: n } = await client.query("SELECT count(*)::int AS n FROM client_services");
  console.log(`\n${n[0].n} prestation(s) enregistrée(s)`);
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
