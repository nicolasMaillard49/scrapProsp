// app/lib/jsonSalvage.ts
// Récupération du JSON rendu par un modèle. Deux accidents reviennent sans
// cesse : le bloc de code autour, et la réponse COUPÉE en cours de route
// (plafond de tokens atteint). Dans les deux cas, jeter toute la réponse
// coûte un aller-retour à l'utilisateur alors que l'essentiel était là.

/** Retire un bloc de code et le bavardage autour du JSON. */
export function stripFence(raw: string): string {
  return (raw ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Tous les objets `{…}` équilibrés du texte, imbriqués compris, dans l'ordre
 * de fermeture. Sur une réponse tronquée, l'objet extérieur n'est jamais
 * refermé — mais les objets internes complets, eux, sont exploitables.
 */
export function balancedObjects(s: string): string[] {
  const stack: number[] = [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") stack.push(i);
    else if (s[i] === "}" && stack.length) out.push(s.slice(stack.pop() as number, i + 1));
  }
  return out;
}

/** Premier objet équilibré qui se parse, du plus englobant au plus interne. */
export function firstParsableObject(s: string): Record<string, unknown> | null {
  const objs = balancedObjects(s).sort((a, b) => b.length - a.length);
  for (const chunk of objs) {
    try {
      const v = JSON.parse(chunk);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // objet incomplet : on essaie le suivant
    }
  }
  return null;
}
