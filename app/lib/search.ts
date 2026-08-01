// Recherche tolérante aux fautes sur les prospects.
//
// Les pseudos Instagram sont pleins de séparateurs qu'on ne retient jamais :
// `M.led_xix` se tape « mledxix », `menuiserie-lacroix` se tape « menuiserie
// lacroix ». Une recherche par sous-chaîne brute ne trouve rien dans ces cas,
// alors que l'utilisateur a bien reconnu le compte. On compare donc des formes
// NORMALISÉES (minuscules, sans accents, sans ponctuation), et on rattrape en
// plus les frappes approximatives.

/** Minuscules, accents retirés, tout ce qui n'est pas alphanumérique supprimé. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    // Plage des diacritiques combinants (U+0300–U+036F), en échappement : écrits
    // littéralement ils sont invisibles dans un diff et cassent au premier outil
    // qui ne lit pas l'UTF-8.
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * `q` apparaît-il dans `s` dans l'ordre, sans forcément être contigu ?
 * Rattrape les caractères oubliés ou les morceaux collés de travers
 * (« mlxix » retrouve `m.led_xix`). Volontairement réservé au pseudo :
 * appliqué à une bio, tout matcherait.
 */
export function isSubsequence(q: string, s: string): boolean {
  if (!q) return true;
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) i++;
  }
  return i === q.length;
}

/**
 * Distance de Levenshtein bornée : on s'arrête dès que le minimum d'une ligne
 * dépasse `max`. Sans cette borne, comparer une requête à 900 pseudos à chaque
 * frappe coûterait cher pour un résultat qu'on jette de toute façon.
 */
export function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Fautes tolérées selon la longueur : 3-5 → 1, au-delà → 2. En deçà, aucune. */
export function typoBudget(q: string): number {
  if (q.length < 3) return 0;
  return q.length <= 5 ? 1 : 2;
}

export interface Searchable {
  username: string;
  full_name?: string | null;
  ville?: string | null;
  bio?: string | null;
}

/**
 * Le prospect répond-il à la requête ? Trois passes, de la plus stricte à la
 * plus permissive :
 *  1. sous-chaîne normalisée sur pseudo + nom + ville + bio (le cas courant) ;
 *  2. sous-séquence sur le seul pseudo (caractères oubliés) ;
 *  3. distance d'édition sur le pseudo, entier ou par fenêtre de la longueur
 *     de la requête — pour la lettre fausse au milieu d'un pseudo plus long.
 */
export function matchesProspect(l: Searchable, rawQuery: string): boolean {
  const q = normalizeSearch(rawQuery);
  if (!q) return true;

  const user = normalizeSearch(l.username);
  const haystack = normalizeSearch(`${l.username} ${l.full_name ?? ""} ${l.ville ?? ""} ${l.bio ?? ""}`);
  if (haystack.includes(q)) return true;

  if (isSubsequence(q, user)) return true;

  const budget = typoBudget(q);
  if (!budget) return false;
  if (editDistanceWithin(q, user, budget)) return true;

  // Fenêtre glissante : la requête peut ne viser qu'un morceau du pseudo.
  for (let i = 0; i + q.length <= user.length; i++) {
    if (editDistanceWithin(q, user.slice(i, i + q.length), budget)) return true;
  }
  return false;
}
