// Applique supabase/migration-015-instagram-enrichment.sql (colonnes email/phone/… + has_website).
// DDL impossible via les clés API → connexion Postgres directe (SUPABASE_DB_URL dans .env.local).
//   node scripts/apply-migration-015.mjs
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
  const sql = readFileSync(resolve(ROOT, "supabase", "migration-015-instagram-enrichment.sql"), "utf-8");
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='instagram_prospects' AND column_name IN
     ('email','phone','follows_count','posts_count','is_business','verified','has_website','profile_pic_url','raw')
     ORDER BY column_name`,
  );
  console.log(`✓ Migration 015 appliquée — colonnes présentes : ${rows.map((r) => r.column_name).join(", ")}`);
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
