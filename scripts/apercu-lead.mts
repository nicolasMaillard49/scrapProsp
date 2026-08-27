/**
 * Aperçu des notifications « demande de devis », hors ligne.
 *
 * Les trois canaux (e-mail, SMS, Telegram) se rendent à partir de fonctions
 * pures : on peut donc les regarder sans Supabase, sans Resend et sans envoyer
 * quoi que ce soit. C'est le seul moyen honnête de retoucher le gabarit — la
 * boucle « je déploie et je m'envoie un faux lead » coûte cher et salit la base.
 *
 * Usage :
 *   npx tsx scripts/apercu-lead.mts
 *       → écrit previews/apercu-mail-devis.html et imprime le SMS dans la console.
 *
 *   npx tsx scripts/apercu-lead.mts --sms 0612345678
 *       → envoie EN PLUS le SMS pour de vrai, via Twilio (facturé, ~0,08 €).
 *         Le message part tel quel : c'est bien celui que l'artisan recevra.
 *         Rien n'est écrit en base — cet envoi n'est pas un lead.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leadSmsNotification, type LeadRow } from "../app/lib/adsLeads.ts";
import { leadEmail } from "../app/lib/adsLeadEmail.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Les variables Twilio vivent dans .env.local, que node ne lit pas tout seul. */
function chargerEnvLocal(): void {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const ligne of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const cle = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[cle]) process.env[cle] = val;
  }
}

/**
 * Une demande représentative : un vrai projet de dressing, sur deux phrases,
 * avec une commune de la zone Totowood. Assez longue pour que le bloc « son
 * projet » ait la tête qu'il aura en production, pas un « test » de trois mots.
 */
const EXEMPLE: LeadRow = {
  client_slug: "totowood",
  name: "Camille Perrot",
  phone: "+33615907873",
  email: "camille.perrot@example.fr",
  commune: "Annet-sur-Marne",
  message:
    "Bonjour, nous venons d'emménager et j'aimerais faire poser un dressing sur mesure dans la chambre parentale, sous une pente. L'espace fait environ 3 m de long pour 2,40 m au point haut.\nSeriez-vous disponible pour venir prendre les mesures un samedi ?",
  service: "Dressing",
  gclid: "Cj0KCQjw_exemple_de_gclid",
  ag: "dressing",
  kw: "dressing sur mesure",
  mt: "e",
  device: "m",
  loc: "9040990",
  camp: "totowood-generique",
  landing: "/dressing",
  referrer: "https://www.google.com/",
  token: "kzr7pq3mf8xat2vhnc9wdjeb",
};

const LABEL = "Totowood";
const QUALIFY = "https://prospects.nmf-agence.com/q/" + EXEMPLE.token;

/* Une date fixe plutôt que « maintenant » : deux exécutions donnent le même
   fichier, donc un diff qui ne montre que ce qu'on a vraiment changé. */
const RECU = new Date("2026-08-27T14:32:00+02:00");

const mail = leadEmail(EXEMPLE, LABEL, QUALIFY, RECU);
const sms = leadSmsNotification(EXEMPLE, LABEL, QUALIFY);

/* `previews/` est gitignoré : un rendu généré n'a pas à vivre dans l'historique,
   il se refabrique en une commande. La convention existait déjà pour les mails
   du funnel — on ne s'en invente pas une deuxième. */
mkdirSync(resolve(ROOT, "previews"), { recursive: true });
const sortie = resolve(ROOT, "previews/apercu-mail-devis.html");
writeFileSync(sortie, mail.html, "utf-8");

console.log("\n=== E-MAIL ===");
console.log("Objet  : " + mail.subject);
console.log("Aperçu : " + sortie);

console.log("\n=== SMS === (" + sms.length + " caractères)");
console.log("-".repeat(40));
console.log(sms);
console.log("-".repeat(40));

console.log("\n=== E-MAIL, VERSION TEXTE ===");
console.log(mail.text);

/* ── Envoi réel, uniquement sur demande explicite. ─────────────────────────── */
const i = process.argv.indexOf("--sms");
if (i >= 0) {
  const destinataire = process.argv[i + 1];
  if (!destinataire) {
    console.error("\n--sms attend un numéro : --sms 0612345678");
    process.exit(1);
  }
  chargerEnvLocal();
  const { default: twilio } = await import("twilio");
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";
  if (!sid || !token || !service) {
    console.error("\nTWILIO_* manquants dans .env.local — rien n'a été envoyé.");
    process.exit(1);
  }
  const digits = destinataire.replace(/[^\d+]/g, "");
  const to = digits.startsWith("+")
    ? digits
    : digits.startsWith("33")
      ? "+" + digits
      : "+33" + digits.replace(/^0/, "");

  const msg = await twilio(sid, token).messages.create({
    messagingServiceSid: service,
    to,
    body: sms,
  });
  console.log(`\nSMS envoyé à ${to} — sid ${msg.sid}, statut ${msg.status}`);
}
