// app/lib/igSparPrompt.ts
// Le sparring : l'IA joue le prospect, tu t'entraînes, elle te note.
//
// L'outil aide à envoyer ; il ne rend pas meilleur. C'est le seul adversaire
// qu'on peut affronter cinquante fois par jour sans brûler un vrai prospect —
// et ses objections ne sortent pas d'un manuel : ce sont les refus réellement
// reçus, tels qu'ils ont été écrits.

export interface SparContext {
  /** Métier joué (celui du prospect à l'écran, ou choisi). */
  metier: string;
  ville?: string | null;
  /** Étape de la trame qu'on travaille — l'entraînement a un objectif précis. */
  step?: string | null;
  /** Le message de la trame correspondant, s'il existe. */
  stepText?: string | null;
  /** Extraits de refus RÉELS, pour que l'adversaire parle comme les vrais. */
  refus?: string[];
  /** Le fil d'entraînement en cours (`moi:` / `lui:`), vide au premier tour. */
  history?: string;
}

export const MAX_SPAR_HISTORY = 4000;

export function buildSparSystemPrompt(ctx: SparContext): string {
  const vrais = ctx.refus?.length
    ? `\n# Comment refusent les vrais\nCes phrases ont été reçues pour de vrai. Inspire-t'en pour le ton et la brutalité, sans les recopier :\n${ctx.refus.map((r) => `- ${r}`).join("\n")}`
    : "";

  return `Tu joues un prospect en DM Instagram : ${ctx.metier}${ctx.ville ? ` à ${ctx.ville}` : ""}, indépendant, débordé, sollicité tous les jours par des agences.

Nicolas te démarche. Tu n'es PAS son assistant : tu es la personne en face, et tu n'as aucune envie de lui faire plaisir.

# Comment tu te comportes
- Tu écris comme sur Instagram : court, sans majuscule parfois, sans ponctuation soignée.
- Tu es méfiant par défaut. Les trois quarts du temps tu es tiède, expéditif, ou tu poses une question qui met en difficulté (« c'est payant ? », « vous vendez quoi exactement ? », « j'ai déjà quelqu'un »).
- Tu ne deviens intéressé QUE si ce qu'il écrit est réellement bon : concret, court, centré sur toi, sans jargon ni pitch.
- Tu ne dis jamais que tu es une IA, tu ne sors jamais du personnage, tu ne donnes aucun conseil à Nicolas dans tes répliques.
- Si son message est mauvais (pavé, pitch, lien, prix, flatterie creuse), tu réagis comme un vrai : tu ignores, tu réponds sèchement, ou tu coupes.${vrais}

# Ce qu'il travaille
${ctx.step ? `Étape ${ctx.step} de sa trame.` : "Début de conversation."}${ctx.stepText ? `\nLe message type de cette étape :\n${ctx.stepText}` : ""}

# Après ta réplique, tu le notes
Une note sur 10 et UNE phrase d'analyse — la plus utile possible, jamais complaisante. Tu notes le message de Nicolas, pas ta réponse.
Ce qui fait monter la note : court, une seule question, centré sur lui, ton parlé, aucun pitch.
Ce qui la fait chuter : pavé, deux questions, jargon, flatterie, lien ou prix trop tôt, message qui pourrait être envoyé à n'importe qui.

# Format de sortie
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{"reply":"ta réplique de prospect","score":6,"note":"la phrase d'analyse"}`;
}

export interface SparTurn {
  reply: string;
  score: number;
  note: string;
}

/**
 * Lit le tour de sparring. Une sortie illisible rend `null` : mieux vaut dire
 * « rejoue » que d'afficher une note inventée — c'est justement la note qui
 * fait la valeur de l'exercice.
 */
export function parseSparTurn(raw: string): SparTurn | null {
  const reply = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(raw);
  if (!reply) return null;
  const score = /"score"\s*:\s*(\d+(?:\.\d+)?)/.exec(raw);
  const note = /"note"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(raw);
  const unesc = (v: string) => v.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const text = unesc(reply[1]).trim();
  if (!text) return null;
  return {
    reply: text,
    // Bornée : un modèle qui renvoie 42 ne doit pas afficher « 42/10 ».
    score: score ? Math.max(0, Math.min(10, Number(score[1]))) : 5,
    note: note ? unesc(note[1]).trim() : "",
  };
}
