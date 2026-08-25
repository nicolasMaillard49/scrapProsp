// Applique supabase/migration-034-ads-leads.sql : les demandes de devis venues
// des landing pages Google Ads, et la configuration du compte Ads par client.
//
// Usage : node scripts/apply-migration-034.mjs

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
    if (!(key in process.env)) process.env[key] = t.slice(eq + 1).trim();
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

  await client.query(readFileSync(resolve(ROOT, "supabase", "migration-034-ads-leads.sql"), "utf-8"));
  console.log("✓ migration-034-ads-leads.sql appliquée");

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('ads_clients', 'ads_leads')
      ORDER BY table_name`,
  );
  for (const t of ["ads_clients", "ads_leads"]) {
    console.log(rows.some((r) => r.table_name === t) ? `  table ${t} ✓` : `  ❌ table ${t} absente`);
  }
  if (rows.length !== 2) process.exit(1);

  const { rows: cli } = await client.query(`SELECT slug, customer_id, action_request, action_sale FROM ads_clients`);
  for (const c of cli) {
    const manque = [
      !c.customer_id && "customer_id",
      !c.action_request && "action_request",
      !c.action_sale && "action_sale",
    ].filter(Boolean);
    // Ce n'est pas une erreur : les leads s'enregistrent quand même, seul
    // l'envoi à Google est différé. Mais autant le dire tout de suite.
    console.log(
      manque.length
        ? `  ⚠️ ${c.slug} — à renseigner quand le compte Ads sera monté : ${manque.join(", ")}`
        : `  ${c.slug} ✓ prêt à remonter les conversions`,
    );
  }
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
