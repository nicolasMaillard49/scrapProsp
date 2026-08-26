// Applique supabase/migration-035-ads-notify-sms.sql : la notification SMS de
// l'artisan à chaque demande de devis.
//
// Usage : node scripts/apply-migration-035.mjs

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

  await client.query(readFileSync(resolve(ROOT, "supabase", "migration-035-ads-notify-sms.sql"), "utf-8"));
  console.log("✓ migration-035-ads-notify-sms.sql appliquée");

  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ads_clients' AND column_name = 'notify_sms'`,
  );
  if (!rows.length) {
    console.error("  ❌ colonne ads_clients.notify_sms absente");
    process.exit(1);
  }
  console.log("  colonne ads_clients.notify_sms ✓");

  // Dire tout de suite qui recevra un SMS et qui n'en recevra pas : une colonne
  // vide est le cas normal au premier jour, pas une erreur — mais on ne veut
  // pas le découvrir le jour où un lead arrive.
  const { rows: cli } = await client.query(`SELECT slug, notify_sms, notify_email FROM ads_clients ORDER BY slug`);
  for (const c of cli) {
    const voies = [c.notify_sms && "SMS", c.notify_email && "e-mail", "Telegram"].filter(Boolean);
    console.log(`  ${c.slug} → ${voies.join(" + ")}`);
  }
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
