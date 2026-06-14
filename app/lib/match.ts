/**
 * Helpers de rapprochement pour l'ajout manuel d'un prospect.
 * Le scraper Google Maps cherche par texte libre ; on doit ensuite décider
 * si le résultat correspond bien à l'entreprise saisie (nom + téléphone).
 */

/** Minuscule, sans accents, sans ponctuation, espaces normalisés. */
export function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents (diacritiques combinants)
    .replace(/[^a-z0-9\s]/g, " ") // ponctuation -> espace
    .replace(/\s+/g, " ")
    .trim();
}

const TOKEN_STOPWORDS = new Set([
  "sarl", "sas", "sasu", "eurl", "ets", "etablissements", "entreprise",
  "societe", "ste", "the", "les", "le", "la", "de", "du", "des", "et",
]);

function tokens(s: string): string[] {
  return normalizeName(s)
    .split(" ")
    .filter((t) => t.length > 1 && !TOKEN_STOPWORDS.has(t));
}

/**
 * Score de similarité de noms 0..1.
 * Jaccard sur les tokens significatifs + bonus si l'un contient l'autre.
 */
export function nameScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) {
    // Repli : sous-chaîne directe
    return na.includes(nb) || nb.includes(na) ? 0.6 : 0;
  }

  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;

  // Bonus substring (ex. "Plomberie Dupont" vs "Plomberie Dupont & Fils")
  const substringBonus = na.includes(nb) || nb.includes(na) ? 0.25 : 0;

  return Math.min(1, jaccard + substringBonus);
}

/**
 * Forme canonique d'un numéro FR = 9 derniers chiffres (sans 0/+33).
 * "06 12 34 56 78" -> "612345678" · "+33 6 12 34 56 78" -> "612345678".
 * Renvoie "" si pas exploitable.
 */
export function normalizePhoneFR(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length >= 11) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.slice(-9);
}

/** true si les deux numéros FR pointent vers la même ligne. */
export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhoneFR(a);
  const nb = normalizePhoneFR(b);
  return !!na && na.length === 9 && na === nb;
}

/**
 * Extrait la ville d'une adresse FR "12 Rue X, 49000 Angers" -> "Angers".
 * Renvoie "" si introuvable.
 */
export function cityFromAddress(address: string): string {
  if (!address) return "";
  const cleaned = address.replace(/,?\s*France\s*$/i, "").trim();
  const m = cleaned.match(/\b\d{5}\s+([A-Za-zÀ-ÿ'’\- ]+?)\s*$/);
  if (m) return m[1].trim();
  // Repli : dernier segment après une virgule
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length) {
    return parts[parts.length - 1].replace(/^\d{5}\s*/, "").trim();
  }
  return "";
}
