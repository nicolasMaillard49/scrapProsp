/**
 * Auth de l'extension Chrome — en-tête `x-ext-token` contre EXT_TOKEN.
 *
 * Le cookie `prospects-auth` est en SameSite=Lax : une requête émise depuis
 * l'origine chrome-extension:// est cross-site, Chrome ne le joint pas. On
 * reprend donc le motif des crons (x-cron-secret) : un en-tête custom, non
 * forgeable par un site tiers → aucune surface CSRF nouvelle.
 *
 * Portée volontairement bornée à /api/instagram/ : le token ne donne accès
 * à rien d'autre. Secret absent/vide = branche morte (refus), jamais un
 * laissez-passer.
 */
export function isExtRequestAllowed(
  pathname: string,
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!pathname.startsWith("/api/instagram/")) return false;
  return header === secret;
}
