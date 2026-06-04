// Backfill du journal SMS depuis l'API Twilio vers la table sms_messages.
// Récupère TOUT l'historique du compte (envoyés + reçus + statut delivered/failed),
// matche le prospect par numéro, et upsert par twilio_sid (idempotent : ré-exécutable).
//
// Requiert dans .env.local (ou l'environnement) :
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  (lecture API)
//   SUPABASE_DB_URL                        (écriture Postgres)
//
// Usage : node scripts/import-twilio-sms.mjs [--limit 2000]

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import twilio from "twilio";

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

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!SID || !TOKEN) { console.error("❌ TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants"); process.exit(1); }
if (!DB_URL) { console.error("❌ SUPABASE_DB_URL manquant"); process.exit(1); }

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 2000;

/** "06 12 34 56 78" / "+33612345678" -> "33612345678" (chiffres normalisés FR). */
function normFr(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("33")) return d;
  if (d.startsWith("0")) return "33" + d.slice(1);
  return d;
}

const STOP = /\b(STOP|ARRET|ARRÊT|DESABONNER|UNSUBSCRIBE)\b/i;

const client = twilio(SID, TOKEN);
const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const UPSERT = `
  INSERT INTO sms_messages
    (prospect_id, twilio_sid, direction, to_phone, from_phone, body, segments, status, sentiment, sentiment_source, sent_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  ON CONFLICT (twilio_sid) DO UPDATE SET
    status = EXCLUDED.status,
    sent_at = EXCLUDED.sent_at,
    prospect_id = COALESCE(sms_messages.prospect_id, EXCLUDED.prospect_id)`;

try {
  await db.connect();
  console.log("✓ Connecté à Postgres");

  // Index numéro normalisé -> prospect_id
  const { rows: prospects } = await db.query("SELECT id, phone FROM prospects");
  const byPhone = new Map();
  for (const p of prospects) byPhone.set(normFr(p.phone), p.id);
  console.log(`  ${prospects.length} prospects indexés`);

  console.log(`Récupération des messages Twilio (limite ${LIMIT})…`);
  const messages = await client.messages.list({ limit: LIMIT });
  console.log(`  ${messages.length} messages reçus de Twilio`);

  let inbound = 0, outbound = 0, matched = 0;
  for (const m of messages) {
    const isInbound = String(m.direction || "").startsWith("inbound");
    const counterpart = normFr(isInbound ? m.from : m.to);
    const prospectId = byPhone.get(counterpart) ?? null;
    if (prospectId) matched++;

    const isStop = isInbound && STOP.test(m.body || "");
    const sentiment = isStop ? "negative" : null;
    const sentimentSource = isStop ? "keyword" : null;
    const sentAt = (m.dateSent || m.dateCreated || new Date()).toISOString();

    await db.query(UPSERT, [
      prospectId,
      m.sid,
      isInbound ? "inbound" : "outbound",
      m.to || null,
      m.from || null,
      m.body || "",
      m.numSegments ? parseInt(m.numSegments, 10) : null,
      m.status || null,
      sentiment,
      sentimentSource,
      sentAt,
    ]);

    if (isInbound) inbound++; else outbound++;
  }

  console.log(`\n✓ Import terminé : ${outbound} sortants, ${inbound} entrants (${matched} liés à un prospect).`);
  console.log("  Les réponses non-STOP sont en sentiment=NULL -> classer via /api/sms/classify.");
} catch (err) {
  console.error("\n❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
