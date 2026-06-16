/**
 * Allow-list des emails autorisés à déclencher la CRÉATION RÉELLE d'une campagne
 * (sinon dry-run). Source = env GOOGLE_ADS_REAL_EMAILS (CSV). Vide = personne.
 * Fonctions PURES (aucune I/O) pour être testables.
 */
export function parseAllowlist(csv: string | undefined | null): Set<string> {
  return new Set(
    (csv || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isRealAllowed(
  email: string | null | undefined,
  csv: string | undefined | null = process.env.GOOGLE_ADS_REAL_EMAILS,
): boolean {
  if (!email) return false;
  return parseAllowlist(csv).has(email.trim().toLowerCase());
}
