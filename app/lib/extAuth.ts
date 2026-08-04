/**
 * Auth de l'extension Chrome — en-tête `x-ext-token` contre EXT_TOKEN.
 *
 * Le cookie `prospects-auth` est en SameSite=Lax : une requête émise depuis
 * l'origine chrome-extension:// est cross-site, Chrome ne le joint pas. On
 * reprend donc le motif des crons (x-cron-secret) : un en-tête custom, non
 * forgeable par un site tiers → aucune surface CSRF nouvelle.
 *
 * Portée volontairement bornée à une ALLOWLIST explicite (pas un préfixe) :
 * seules les routes réellement consommées par l'extension y figurent. Un
 * startsWith("/api/instagram/") ouvrirait aussi l'export nominatif et les
 * DELETE à un simple secret statique — bien plus que ce dont l'extension a
 * besoin. Secret absent/vide = branche morte (refus), jamais un laissez-passer.
 */
const EXT_PATHS = new Set([
  "/api/instagram/trame",
  "/api/instagram/dm",
  "/api/instagram/reply-ai",
  "/api/instagram/proofread",
  // Le panneau appelle « Reformuler » depuis le service worker : sans cette
  // entrée, le bouton répondait 401 (aucun cookie n'accompagne une requête
  // émise depuis chrome-extension://). Lecture seule, comme proofread.
  "/api/instagram/retone",
  "/api/instagram/classify-reply",
  "/api/instagram/queue",
  // Carte de clôture : chiffres AGRÉGÉS du jour, aucun pseudo. C'est ce qui
  // la rend ouvrable ici, là où /kpi/day (nominatif) reste fermé.
  "/api/instagram/session",
  // Mode chasse : capture d'un profil croisé au hasard. Écrit, mais n'écrit
  // QUE des prospects (jamais un envoi, jamais un stade) et est idempotent.
  "/api/instagram/capture",
  // Accroche vivante : lecture seule, n'ecrit rien, ne journalise rien.
  "/api/instagram/hook",
  // Sparring : n'ecrit rien, ne journalise rien, ne touche aucun compteur.
  "/api/instagram/spar",
]);

export function isExtRequestAllowed(
  pathname: string,
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!EXT_PATHS.has(pathname)) return false;
  return header === secret;
}
