// Applique supabase/migration-036-ads-calls.sql : les appels passés depuis les
// landing pages Google Ads, et la troisième action de conversion.
//
// Usage : node scripts/apply-migration-036.mjs

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

  await client.query(readFileSync(resolve(ROOT, "supabase", "migration-036-ads-calls.sql"), "utf-8"));
  console.log("✓ migration-036-ads-calls.sql appliquée");

  const { rows: t } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ads_calls'`,
  );
  if (!t.length) {
    console.error("  ❌ table ads_calls absente");
    process.exit(1);
  }
  console.log("  table ads_calls ✓");

  const { rows: c } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ads_clients' AND column_name = 'action_call'`,
  );
  if (!c.length) {
    console.error("  ❌ colonne ads_clients.action_call absente");
    process.exit(1);
  }
  console.log("  colonne ads_clients.action_call ✓");

  // Les trois actions de conversion d'un même compte : autant dire tout de
  // suite laquelle manque, plutôt que de le découvrir au premier appel.
  const { rows: cli } = await client.query(
    `SELECT slug, action_request, action_sale, action_call FROM ads_clients ORDER BY slug`,
  );
  for (const x of cli) {
    const manque = [
      !x.action_request && "action_request",
      !x.action_sale && "action_sale",
      !x.action_call && "action_call",
    ].filter(Boolean);
    console.log(
      manque.length
        ? `  ⚠️ ${x.slug} — à renseigner quand les actions seront créées dans Ads : ${manque.join(", ")}`
        : `  ${x.slug} ✓ les trois actions sont branchées`,
    );
  }
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
} finally {
  await client.end();
}
