// app/lib/igReplyPrompt.ts
// Construction PURE du prompt « réponse assistée » + parsing de la sortie.
// Sert quand le prospect répond hors trame : on ne remplace pas la méthode, on
// aide à revenir vers l'étape suivante de la séquence.

import type { TrameStep } from "./igTrame";

export interface ReplyProspect {
  username: string;
  firstName?: string | null;
  metier?: string | null;
  ville?: string | null;
  stage?: string | null;
}

export interface ReplyContext {
  prospect: ReplyProspect | null;
  steps: TrameStep[];
  /** Étape de la trame vers laquelle on veut ramener la conversation. */
  nextStep: string | null;
  /** Ce que le prospect vient d'écrire. */
  incoming: string;
  /** Contexte optionnel de la conversation (copié du fil). */
  history?: string;
}

export interface ReplySuggestion {
  label: string;
  text: string;
}

/** Longueur max acceptée pour un message entrant (garde-fou coût/prompt). */
export const MAX_INCOMING = 2000;
export const MAX_HISTORY = 4000;

/**
 * System prompt : la méthode de prospection est la contrainte, pas une
 * suggestion. Les règles encodées ici reprennent celles de la trame —
 * vouvoiement, messages courts, aucun lien avant M9, objectif = le call.
 */
export function buildReplySystemPrompt(ctx: ReplyContext): string {
  const p = ctx.prospect;
  const target = ctx.steps.find((s) => s.step === ctx.nextStep);

  const who = p
    ? [
        `pseudo Instagram : @${p.username}`,
        p.firstName ? `prénom : ${p.firstName}` : null,
        p.metier ? `métier : ${p.metier}` : null,
        p.ville ? `ville : ${p.ville}` : null,
        `stade actuel dans le pipeline : ${p.stage || "jamais contacté"}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "Prospect inconnu de la base — reste générique, n'invente aucun détail sur son activité.";

  return `Tu es l'assistant de Nicolas, fondateur de NMF Agence (agence web de proximité). Nicolas prospecte des indépendants et commerces locaux en DM Instagram. Il t'écrit parce que le prospect vient de répondre quelque chose qui sort de sa trame, et il a besoin d'une réponse courte pour rebondir.

# Le prospect
${who}

# La trame officielle (la méthode — tu ne la remplaces pas, tu y ramènes)
${ctx.steps.map((s) => `${s.step} — ${s.title}\n${s.text}`).join("\n\n")}

# Où en est la conversation
${
  target
    ? `Le prochain message prévu par la trame est ${target.step} (« ${target.title} »). Ton objectif : répondre à ce que le prospect vient de dire, puis ramener naturellement la conversation vers ce message-là — sans le recopier mot pour mot si ça tombe à plat.`
    : `La trame n'a plus d'étape à proposer (séquence terminée ou close). Réponds de façon utile sans relancer de séquence.`
}

# Règles absolues
- Vouvoiement, ton direct et humain, jamais commercial ni "corporate".
- TRÈS court : 1 à 3 phrases, comme un vrai DM tapé au pouce. Jamais de pavé.
- Aucune signature, aucun nom d'agence en bas de message, aucune coordonnée (téléphone, email, site) : c'est un DM, pas un courrier.
- Aucun lien tant que l'étape M9 n'est pas atteinte. Aucun prix, aucun devis, aucune promesse de résultat chiffrée.
- N'invente jamais un fait sur son activité que tu n'as pas dans le contexte ci-dessus.
- Une seule question par message maximum.
- Si le prospect refuse clairement, propose une sortie propre et respectueuse — on n'insiste pas.
- Emoji : zéro, sauf si le prospect en utilise et qu'un seul suffit à garder le ton léger.

# Format de sortie
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans bloc de code :
{"suggestions":[{"label":"angle en 2-3 mots","text":"le message à envoyer"},...]}
Donne exactement 3 propositions, avec des angles différents (par exemple : répondre franchement / rebondir par une question / recadrer vers le call).`;
}

/** Message utilisateur : ce que le prospect a écrit, plus le fil si fourni. */
export function buildReplyUserMessage(ctx: ReplyContext): string {
  const hist = (ctx.history ?? "").trim().slice(0, MAX_HISTORY);
  const incoming = ctx.incoming.trim().slice(0, MAX_INCOMING);
  return [
    hist ? `Fil de la conversation (du plus ancien au plus récent) :\n${hist}\n` : null,
    `Dernier message du prospect :\n${incoming}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse la sortie du modèle. Tolérant par conception : une réponse mal formée
 * ne doit jamais rendre la fonctionnalité inutilisable — au pire on rend le
 * texte brut comme proposition unique, à Nicolas de juger.
 */
export function parseSuggestions(raw: string): ReplySuggestion[] {
  const text = (raw ?? "").trim();
  if (!text) return [];

  // Retire un éventuel bloc de code ```json … ```
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // Isole le premier objet JSON plausible (le modèle bavarde parfois autour).
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;

  try {
    const parsed: unknown = JSON.parse(candidate);
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed as { suggestions?: unknown })?.suggestions;
    if (Array.isArray(list)) {
      const out = list
        .map((s): ReplySuggestion | null => {
          const o = s as { label?: unknown; text?: unknown };
          const t = typeof o?.text === "string" ? o.text.trim() : "";
          if (!t) return null;
          const l = typeof o?.label === "string" && o.label.trim() ? o.label.trim() : "Proposition";
          return { label: l, text: t };
        })
        .filter((s): s is ReplySuggestion => s !== null)
        .slice(0, 4);
      if (out.length) return out;
    }
  } catch {
    // JSON invalide : on retombe sur le brut plutôt que de ne rien rendre.
  }
  return [{ label: "Brut", text: unfenced }];
}
