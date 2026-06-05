// Envoi d'un SMS de TEST vers un numéro libre (self-test), sans Messaging
// Service : utilise TWILIO_PHONE_NUMBER comme expéditeur (from:).
// Le tunnel de prod (/api/sms) passera lui par un Messaging Service (MG...)
// pour gérer l'opt-out STOP — ce script ne sert qu'à prévisualiser un envoi.
//
// Usage:
//   node scripts/send-test-sms.mjs +33XXXXXXXXX            -> message démo paysagiste par défaut
//   node scripts/send-test-sms.mjs +33XXXXXXXXX "mon texte" -> message custom
//   node scripts/send-test-sms.mjs +33XXXXXXXXX --dry       -> n'envoie rien, affiche le message + coût

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import twilio from "twilio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// charge .env.local
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_PHONE_NUMBER;

if (!SID || !TOKEN || !FROM) {
  console.error("Manque TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER dans .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const positional = args.filter((a) => a !== "--dry");
const to = positional[0];
if (!to || !/^\+\d{8,15}$/.test(to)) {
  console.error("Numéro destinataire invalide. Format E.164 attendu, ex. +33615907873");
  process.exit(1);
}

// Message par défaut = aperçu démo paysagiste (Guenat Paysages), tel qu'un prospect le reçoit.
const DEFAULT_MSG =
  "Bonjour Guillaume Guenat, c'est Nicolas de NMF Agence (agence web FR). " +
  "Je vous ai préparé un aperçu de votre futur site : https://prospects.nmf-agence.com/d/f6891718 " +
  "C'est 100% gratuit et sans engagement, agence vérifiable sur nmf-agence.com. " +
  "Intéressé ? OUI. STOP pour arrêter.";
const body = positional[1] || DEFAULT_MSG;

// estimation segments (UCS-2 si accents)
const gsm7 = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const ext = "^{}\\[~]|€";
const isGsm = [...body].every((c) => gsm7.includes(c) || ext.includes(c));
const len = [...body].length;
const segments = len <= (isGsm ? 160 : 70) ? 1 : Math.ceil(len / (isGsm ? 153 : 67));

console.log(`From : ${FROM}`);
console.log(`To   : ${to}`);
console.log(`Texte (${len} car., ${isGsm ? "GSM-7" : "UCS-2"}, ${segments} segment(s)) :\n  ${body}\n`);

if (dry) {
  console.log("--dry : rien envoyé.");
  process.exit(0);
}

const client = twilio(SID, TOKEN);
try {
  const msg = await client.messages.create({ from: FROM, to, body });
  console.log(`✓ Envoyé — SID ${msg.sid} · statut "${msg.status}"`);
} catch (e) {
  console.error(`❌ Échec : ${e.message}`);
  if (e.code) console.error(`   code Twilio : ${e.code}`);
  process.exit(1);
}
