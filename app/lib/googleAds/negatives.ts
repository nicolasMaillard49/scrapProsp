/**
 * Mots-clés négatifs à poser dès J1 (cf. skill google-ads-artisans → creation.md).
 * Évite de cramer le budget sur l'emploi, les tutos, la concurrence des annuaires, etc.
 */

/** Liste universelle artisans (emploi, formation, gratuit, annuaires…). */
export const NEGATIVES_UNIVERSAL: string[] = [
  "emploi", "recrutement", "formation", "apprentissage", "alternance", "offre",
  "cdi", "cdd", "stage", "salaire", "école", "devenir", "comment devenir",
  "gratuit", "bricolage", "faire soi-même", "diy", "youtube", "tuto", "tutoriel",
  "avis", "forum", "leboncoin", "linkedin", "pole emploi", "indeed", "monster",
];

/** Négatifs spécifiques par métier (clé = métier normalisé). */
const NEGATIVES_BY_METIER: Record<string, string[]> = {
  electricien: ["diplôme", "habilitation", "br", "b1", "électrotechnique", "norme nfc", "nf c"],
  plombier: ["plomberie cours", "schéma plomberie", "fournisseur plomberie"],
  serrurier: ["reproduction clé minute", "double de clé"],
  peintre: ["peinture artistique", "tableau", "cours de peinture"],
  paysagiste: ["jardinerie", "graines", "pépinière en ligne"],
};

/** Normalise un métier pour le lookup (minuscule, sans accents). */
function key(metier: string): string {
  return (metier || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Liste complète (universelle + métier) dédupliquée. */
export function negativesFor(metier: string | null | undefined): string[] {
  const specific = NEGATIVES_BY_METIER[key(metier || "")] ?? [];
  return Array.from(new Set([...NEGATIVES_UNIVERSAL, ...specific]));
}
