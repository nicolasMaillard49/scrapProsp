// app/lib/igHookPrompt.ts
// L'accroche vivante : un M1 fabriqué à partir de ce que la page du prospect
// montre RÉELLEMENT (sa bio, ses dernières publications), au lieu du même
// message pour tout le monde.
//
// Le taux de réponse à froid se joue entièrement sur la première ligne. « Vu
// votre réalisation de la semaine dernière » n'est pas de la politesse : c'est
// la preuve qu'un humain a regardé. Tenable à la main sur 5 prospects par
// jour, impossible sur 50.
//
// Contrainte majeure, et c'est elle qui dicte tout le prompt : la variante
// DOIT rester reconnaissable comme l'étape M1/S1, sinon `matchStep` ne la
// rattache plus et l'envoi n'est pas journalisé — stade faux, relance fausse,
// KPI faux. D'où : même longueur, même question fermée, même registre.

export interface HookContext {
  /** L'accroche standard — celle que la variante doit pouvoir remplacer. */
  base: string;
  /** Prénom, si on le connaît de façon fiable. */
  firstName?: string | null;
  metier?: string | null;
  ville?: string | null;
  /** Bio lue sur la page. */
  bio?: string | null;
  /** Descriptions des dernières publications, telles qu'affichées. */
  posts?: string[];
}

export const MAX_HOOK_INPUT = 1200;

export function buildHookSystemPrompt(ctx: HookContext): string {
  const vu = [
    ctx.bio ? `bio : ${ctx.bio}` : null,
    ctx.posts?.length ? `dernières publications :\n${ctx.posts.map((p) => `- ${p}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Tu écris le PREMIER message d'une prise de contact en DM Instagram, pour Nicolas (agence web, France).

# Le prospect
${[ctx.firstName ? `prénom : ${ctx.firstName}` : null, ctx.metier ? `métier : ${ctx.metier}` : null, ctx.ville ? `ville : ${ctx.ville}` : null].filter(Boolean).join("\n") || "on ne sait presque rien de lui"}

# Ce qu'on voit sur sa page en ce moment
${vu || "rien d'exploitable — dans ce cas, ne force pas : renvoie l'accroche standard telle quelle."}

# L'accroche standard (celle qu'on enverrait sans avoir regardé)
${ctx.base}

# Ta tâche
Réécris cette accroche en y glissant UNE observation réelle tirée de sa page.
La variante doit rester la MÊME étape : même longueur (une à deux phrases),
même registre parlé, et elle se termine par la même question fermée, facile à
répondre par oui.

# Règles absolues
- Vouvoiement. Ton direct, humain, jamais commercial.
- UNE seule observation, précise et vérifiable sur sa page. Jamais deux.
- N'INVENTE RIEN : si tu n'es pas sûr de ce que montre une publication, ne la
  cite pas. Une accroche fausse se voit immédiatement et tue la conversation.
- Aucun compliment creux (« superbe travail », « j'adore votre univers ») : ça
  se lit comme un message de masse, c'est-à-dire exactement ce qu'on évite.
- Aucun pitch, aucune offre, aucun lien, aucun prix, aucune signature.
- Une seule question, fermée.
- Zéro emoji.
- Jamais plus de 220 caractères.

# Format de sortie
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{"variants":[{"label":"ce sur quoi tu rebondis, 2-3 mots","text":"l'accroche"}]}
Deux variantes maximum. Si sa page ne donne rien de solide, renvoie une seule
variante contenant l'accroche standard inchangée, avec le label "standard".`;
}

export interface HookVariant {
  label: string;
  text: string;
}

/** Longueur au-delà de laquelle ce n'est plus une accroche mais un paragraphe. */
const MAX_LEN = 260;

/**
 * Lit la réponse du modèle. Tolérant à une sortie tronquée (mêmes raisons que
 * `igReplyPrompt`), et surtout SÉLECTIF : une variante trop longue, signée, ou
 * porteuse d'un lien est écartée plutôt que proposée — la corriger à la main
 * coûte plus cher que de repartir de l'accroche standard.
 */
export function parseHookVariants(raw: string): HookVariant[] {
  const out: HookVariant[] = [];
  const seen = new Set<string>();
  // On ratisse les objets {label, text} un par un : un JSON tronqué garde
  // ainsi les variantes complètes qu'il contenait.
  const re = /\{\s*"label"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const unesc = (v: string) => v.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    const text = unesc(m[2]).trim();
    const label = unesc(m[1]).trim() || "variante";
    if (!text || text.length > MAX_LEN) continue;
    if (/https?:\/\//.test(text)) continue; // aucun lien dans une accroche
    if (/NMF|Nicolas Maillard/i.test(text)) continue; // aucune signature
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ label, text });
    if (out.length >= 2) break;
  }
  return out;
}
