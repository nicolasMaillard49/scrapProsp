import { escapeHtml, type LeadRow } from "./adsLeads";

/**
 * L'e-mail de demande de devis — celui que l'artisan ouvre sur son téléphone.
 *
 * Module de mise en forme pure, sans réseau ni base : il rend une chaîne HTML
 * et son équivalent texte, rien d'autre. C'est ce qui le rend testable, et
 * c'est aussi ce qui permet de le prévisualiser hors ligne
 * (`scripts/apercu-lead.mts`).
 *
 * Trois contraintes dictent tout ce qui suit, et aucune n'est négociable :
 *
 *  1. **Un client de messagerie n'est pas un navigateur.** Pas de feuille
 *     externe, pas de flexbox, pas de grid, pas de variable CSS : des tables
 *     imbriquées et des styles en attribut `style`, comme en 2005. Outlook rend
 *     le HTML avec le moteur de Word.
 *  2. **Il le lit debout, une main prise.** L'action utile n'est pas de lire :
 *     c'est de rappeler. Le numéro est donc un bouton pleine largeur en `tel:`,
 *     et il est aussi dans l'objet — pour composer depuis la notification sans
 *     même ouvrir le message.
 *  3. **La seconde action paie les campagnes.** « Ce devis a été signé » est le
 *     seul endroit d'où la valeur remonte à Google. Un lien perdu au milieu
 *     d'un paragraphe ne se clique pas ; il lui faut sa propre surface.
 *
 * Ce qui n'y est PAS, volontairement : le gclid, le mot-clé, l'avertissement
 * d'attribution. Ça, c'est l'affaire de l'agence — voir `leadNotification`, qui
 * part sur Telegram. L'artisan reçoit un client, pas un rapport.
 */

/* ── La DA des landing pages, recopiée en dur ──────────────────────────────────
   Source : totowood-lp/src/app/globals.css, bloc @theme. Un e-mail n'a accès ni
   à Tailwind ni aux variables CSS : ces valeurs sont la seule copie, et si la
   DA du site bouge, elle bouge ici aussi.

   L'artisan reçoit un message aux couleurs de SA marque, pas à celles de
   l'outil qui l'envoie — c'est la même page que le client vient de quitter. */
const INK = "#011627"; // encre
const INK_SOFT = "#4a5964";
const INK_FAINT = "#7b8890";
const WOOD = "#57423a"; // brun bois, la couleur d'action
const WOOD_TINT = "#efeae6";
const SHELL = "#f9f8f8";
const LINE = "#e4e1de";

/* Deux tons qui n'existent pas dans le thème, parce que le site ne les rend
   qu'en opacité — impossible dans un e-mail, où tout doit être opaque :
   - texte secondaire posé sur l'encre (le site utilise text-white/60) ;
   - contour du bouton fantôme (le site utilise rgb(1 22 39 / 0.15) sur shell). */
const ON_INK_SOFT = "#9fabb3";
const GHOST_BORDER = "#d9dcde";

/* Plus Jakarta Sans pour les titres, Manrope pour le corps — comme le site.
   Aucun client de messagerie majeur ne charge de police distante (Gmail les
   ignore, Outlook aussi) : ces piles servent aux quelques-uns qui le font, et
   les autres tombent sur la police système. La hiérarchie tient de toute façon
   par la taille et la graisse, jamais par la fonte seule. */
const DISPLAY = "'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";
const BODY = "'Manrope','Segoe UI',Helvetica,Arial,sans-serif";

/**
 * "+33615907873" → "06 15 90 78 73".
 *
 * Le format E.164 est celui que Twilio exige et celui qu'on stocke ; ce n'est
 * pas celui qu'un artisan reconnaît. Il lit parfois le numéro à voix haute pour
 * le noter — les paires françaises comptent.
 */
export function formatPhoneFr(e164: string): string {
  const m = /^\+33([1-9])(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}

/** « Mardi 27 août 14:32 », à l'heure de Paris quelle que soit celle du serveur. */
export function formatDateFr(d: Date): string {
  const rendu = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
  return rendu.charAt(0).toUpperCase() + rendu.slice(1);
}

/**
 * Le bouton en gélule des landing pages (`.btn-primary` / `.btn-ghost`), rendu
 * en table : c'est la cellule qui porte le fond et le rayon, et le lien qui
 * porte le remplissage en `display:block`. Un `<a>` seul avec du padding donne
 * une zone cliquable de la taille du texte sous le moteur Word.
 *
 * Outlook ignorera le rayon et rendra un rectangle. C'est le compromis
 * habituel : on ne va pas fabriquer un VML pour deux boutons, et un rectangle
 * brun reste lisible et cliquable.
 */
function bouton(o: { href: string; label: string; fond: string; encre: string; bord: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="${o.fond}" style="border-radius:9999px;border:1px solid ${o.bord};">
                    <a href="${o.href}" style="display:block;padding:16px 24px;font-family:${DISPLAY};font-size:17px;font-weight:600;line-height:22px;color:${o.encre};text-decoration:none;">${o.label}</a>
                  </td>
                </tr>
              </table>`;
}

export interface LeadEmail {
  subject: string;
  html: string;
  /** Version texte, pour les lecteurs qui refusent le HTML — et pour la délivrabilité. */
  text: string;
}

/**
 * Rend la notification complète pour une demande de devis.
 *
 * `label` est le nom du client (« Totowood »), `qualifyUrl` le lien à jeton vers
 * l'écran « signé / perdu », `receivedAt` l'horodatage de la ligne en base.
 */
export function leadEmail(
  row: LeadRow,
  label: string,
  qualifyUrl: string,
  receivedAt: Date,
): LeadEmail {
  const tel = formatPhoneFr(row.phone);
  const date = formatDateFr(receivedAt);
  const lieu = row.commune ?? "";

  /* L'objet porte le numéro : sur un écran verrouillé, l'aperçu suffit souvent
     à décider d'appeler tout de suite. */
  const subject = `${label} · nouvelle demande — ${row.name}${lieu ? `, ${lieu}` : ""} (${tel})`;

  /* Le pré-en-tête, cette ligne grise que les clients affichent après l'objet.
     Sans lui ils y mettent le premier texte trouvé, souvent « Voir ce message
     dans un navigateur ». On y met le début du projet. */
  const preheader = row.message.replace(/\s+/g, " ").slice(0, 120);

  const meta = [lieu, row.service].filter(Boolean).map((v) => escapeHtml(String(v)));

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap');
  /* Les media queries ne passent pas partout, mais là où elles passent
     (Apple Mail, Gmail iOS/Android) le titre respire mieux en petit écran. */
  @media only screen and (max-width:480px) {
    .cadre { padding-left: 20px !important; padding-right: 20px !important; }
    .nom { font-size: 27px !important; line-height: 33px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${WOOD_TINT};">
  <div style="display:none;font-size:1px;color:${WOOD_TINT};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${WOOD_TINT};">
    <tr>
      <td align="center" style="padding:28px 12px 40px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${LINE};border-radius:24px;overflow:hidden;">

          <!-- Le bandeau encre, comme la section « le problème » des landing
               pages : c'est la signature visuelle de la marque, et elle dit
               d'où vient la demande avant la première ligne. Un mot-écrit
               plutôt qu'un logo en image — les images sont bloquées par défaut
               chez la moitié des lecteurs, du texte s'affiche toujours. -->
          <tr>
            <td bgcolor="${INK}" style="background-color:${INK};padding:22px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" style="font-family:${DISPLAY};font-size:14px;font-weight:700;letter-spacing:0.22em;color:#ffffff;text-transform:uppercase;">${escapeHtml(label)}</td>
                  <td align="right" style="font-family:${BODY};font-size:10px;font-weight:600;letter-spacing:0.16em;color:${ON_INK_SOFT};text-transform:uppercase;">Demande de devis</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="cadre" style="padding:30px 32px 0 32px;font-family:${BODY};">
              <p style="margin:0 0 10px 0;font-size:13px;line-height:18px;color:${INK_FAINT};">${escapeHtml(date)}</p>
              <h1 class="nom" style="margin:0;font-family:${DISPLAY};font-size:32px;line-height:38px;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escapeHtml(row.name)}</h1>
              ${meta.length ? `<p style="margin:10px 0 0 0;font-size:15px;line-height:22px;color:${INK_SOFT};">${meta.join(" &nbsp;·&nbsp; ")}</p>` : ""}
            </td>
          </tr>

          <!-- L'action principale, avant même le message : on rappelle d'abord,
               on lit le détail pendant que ça sonne. -->
          <tr>
            <td class="cadre" style="padding:22px 32px 0 32px;">
              ${bouton({ href: `tel:${row.phone}`, label: `Rappeler le ${tel}`, fond: WOOD, encre: SHELL, bord: WOOD })}
            </td>
          </tr>

          <tr>
            <td class="cadre" style="padding:26px 32px 0 32px;font-family:${BODY};">
              <p style="margin:0 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${INK_FAINT};">Son projet</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background-color:${WOOD_TINT};border-radius:20px;padding:20px 22px;font-family:${BODY};font-size:16px;line-height:26px;color:${INK};">${escapeHtml(row.message).replace(/\n/g, "<br>")}</td>
                </tr>
              </table>
            </td>
          </tr>
${
  row.email
    ? `
          <tr>
            <td class="cadre" style="padding:16px 32px 0 32px;font-family:${BODY};font-size:14px;line-height:20px;color:${INK_SOFT};">
              E-mail : <a href="mailto:${escapeHtml(row.email)}" style="color:${WOOD};text-decoration:underline;">${escapeHtml(row.email)}</a>
            </td>
          </tr>`
    : ""
}
          <!-- La seconde action. Séparée par un filet : ce n'est pas la suite du
               message, c'est ce qu'on revient faire deux semaines plus tard. -->
          <tr>
            <td class="cadre" style="padding:28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="height:1px;background-color:${LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="cadre" style="padding:24px 32px 30px 32px;">
              ${bouton({ href: qualifyUrl, label: "Ce devis a été signé →", fond: "#ffffff", encre: INK, bord: GHOST_BORDER })}
              <p style="margin:14px 0 0 0;font-family:${BODY};font-size:13px;line-height:20px;color:${INK_FAINT};text-align:center;">Un clic, un montant, et c'est fini. C'est de là que la campagne apprend quels clients vous rapportent vraiment.</p>
            </td>
          </tr>

          <tr>
            <td class="cadre" bgcolor="${SHELL}" style="background-color:${SHELL};border-top:1px solid ${LINE};padding:20px 32px;font-family:${BODY};font-size:12px;line-height:19px;color:${INK_FAINT};">
              Demande reçue depuis vos annonces Google. Notification envoyée par NMF Agence.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${label} — nouvelle demande de devis`,
    date,
    "",
    row.name,
    tel,
    lieu ? `Commune : ${lieu}` : null,
    row.service ? `Service : ${row.service}` : null,
    row.email ? `E-mail : ${row.email}` : null,
    "",
    "Son projet :",
    row.message,
    "",
    `Ce devis a été signé ? → ${qualifyUrl}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject, html, text };
}
