/**
 * Auth de l'extension Chrome — en-tête `x-ext-token` contre EXT_TOKEN.
 *
 * Le cookie `prospects-auth` est en SameSite=Lax : une requête émise depuis
 * l'origine chrome-extension:// est cross-site, Chrome ne le joint pas. On
 * reprend donc le motif des crons (x-cron-secret) : un en-tête custom, non
 * forgeable par un site tiers → aucune surface CSRF nouvelle.
 *
 * Portée volontairement bornée à une ALLOWLIST de 2 routes (pas un préfixe) :
 * seules /trame et /dm sont réellement consommées par l'extension. Un
 * startsWith("/api/instagram/") ouvrirait aussi l'export nominatif et les
 * DELETE à un simple secret statique — bien plus que ce dont l'extension a
 * besoin. Secret absent/vide = branche morte (refus), jamais un laissez-passer.
 */
const EXT_PATHS = new Set(["/api/instagram/trame", "/api/instagram/dm"]);

export function isExtRequestAllowed(
  pathname: string,
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!EXT_PATHS.has(pathname)) return false;
  return header === secret;
}
