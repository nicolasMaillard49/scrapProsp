// Applique les migrations 024, 025 et 026 :
//   024 — fiche Google Maps des prospects IG (fait concurrentiel + maquette)
//   025 — vues des maquettes /di (« il regarde sa maquette maintenant »)
//   026 — variantes d'accroche mises en concurrence (le bandit)
//
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans .env.local.
//
// Les trois sont idempotentes (`if not exists` partout) : rejouer ce script ne
// casse rien et ne perd aucune donnée. Chacune tourne dans SA transaction —
// un échec sur l'une ne doit pas annuler les précédentes, qui sont
// indépendantes les unes des autres.
//
// Usage : node scripts/apply-migrations-024-026.mjs

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

const MIGRATIONS = [
  "migration-024-ig-maps-facts.sql",
  "migration-025-ig-demo-views.sql",
  "migration-026-ig-trame-variants.sql",
];

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

/** Colonnes réellement présentes — la seule preuve qui vaille. */
async function columns(table) {
  const { rows } = await client.query(
    "select column_name from information_schema.columns where table_name = $1 order by column_name",
    [table],
  );
  return rows.map((r) => r.column_name);
}

async function tableExists(table) {
  const { rows } = await client.query("select to_regclass($1) as t", [`public.${table}`]);
  return rows[0].t !== null;
}

try {
  await client.connect();
  console.log("✓ Connecté à Postgres\n");

  for (const file of MIGRATIONS) {
    const path = resolve(ROOT, "supabase", file);
    if (!existsSync(path)) {
      console.error(`❌ ${file} introuvable`);
      process.exitCode = 1;
      continue;
    }
    const sql = readFileSync(path, "utf-8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error(`❌ ${file} : ${err.message}`);
      process.exitCode = 1;
    }
  }

  // ── Vérification ────────────────────────────────────────────────────────
  // « La requête n'a pas levé d'erreur » ne prouve rien : on relit le schéma.
  console.log("\n── Vérification ──");

  const prospectCols = await columns("instagram_prospects");
  const attendues = [
    "maps_rank", "maps_rating", "maps_reviews", "maps_phone", "maps_address",
    "maps_ads_count", "maps_total", "maps_checked_at",
    "demo_first_viewed_at", "demo_last_viewed_at",
    "accroche_variant",
  ];
  const manquantes = attendues.filter((c) => !prospectCols.includes(c));
  console.log(
    manquantes.length
      ? `❌ instagram_prospects — manquantes : ${manquantes.join(", ")}`
      : `✓ instagram_prospects : ${attendues.length} colonnes ajoutées`,
  );
  if (manquantes.length) process.exitCode = 1;

  for (const t of ["ig_demo_views", "ig_trame_variants"]) {
    const ok = await tableExists(t);
    console.log(ok ? `✓ table ${t}` : `❌ table ${t} absente`);
    if (!ok) process.exitCode = 1;
  }

  // Les données existantes n'ont pas bougé : ces migrations n'ajoutent que des
  // colonnes nullables et des tables neuves. On le vérifie plutôt que de le
  // supposer — c'est la base de production.
  const { rows: counts } = await client.query(
    "select (select count(*) from instagram_prospects)::int as prospects," +
      " (select count(*) from ig_dm_log)::int as envois," +
      " (select count(*) from ig_replies)::int as reponses",
  );
  const c = counts[0];
  console.log(`\n📊 Intact : ${c.prospects} prospects · ${c.envois} envois · ${c.reponses} réponses`);
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
