/**
 * Poids visuel d'une colonne du board.
 *
 * Une colonne chargée gagne de la place, sans pouvoir avaler tout le tableau.
 * La racine carrée garde une progression douce quand le nombre de clients monte.
 */
export function boardColumnWeight(clientCount: number): number {
  const count = Math.max(0, Number.isFinite(clientCount) ? clientCount : 0);
  return Math.min(2.5, 1 + Math.sqrt(count) * 0.45);
}
