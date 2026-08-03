// app/lib/igReplyPrompt.ts
// Construction PURE du prompt « réponse assistée » + parsing de la sortie.
// Sert quand le prospect répond hors trame : on ne remplace pas la méthode, on
// aide à revenir vers l'étape suivante de la séquence.

import type { TrameStep } from "./igTrame";
import { skillForWriting } from "./igSkill";
import { stripFence, balancedObjects } from "./jsonSalvage";

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
  /**
   * Fil de la conversation, une ligne par message préfixée de son auteur :
   * `moi:` (Nicolas), `lui:` (le prospect), `?:` (auteur incertain).
   */
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

  return `Tu es l'assistant de prospection de Nicolas. Il t'écrit parce que le prospect vient de répondre quelque chose qui sort de sa trame, et il a besoin d'une réponse courte pour rebondir.

${skillForWriting()}

# Le prospect
${who}

# La trame officielle (la méthode — tu ne la remplaces pas, tu y ramènes)
${ctx.steps.map((s) => `${s.step} — ${s.title}\n${s.text}`).join("\n\n")}

# Où en est la conversation
${
  target
    ? `D'après le CRM, le prochain message prévu par la trame est ${target.step} (« ${target.title} »).

ATTENTION : cette indication vient d'un stade enregistré à la main, qui peut être en RETARD sur la réalité. Le fil ci-dessous fait foi. Si la conversation est manifestement plus avancée que ${target.step} (une offre a été présentée, un prix discuté, un rendez-vous évoqué), IGNORE ${target.step} et réponds à l'endroit où la conversation en est vraiment — l'objectif reste l'appel.`
    : `La trame n'a plus d'étape à proposer (séquence terminée ou close). Réponds de façon utile, en te fiant uniquement au fil.`
}

# Lire la conversation
Le fil t'est donné une ligne par message, préfixée par son auteur :
- \`moi:\` = un message déjà envoyé par Nicolas ;
- \`lui:\` = un message du prospect ;
- \`?:\` = auteur incertain (détection imparfaite) — sers-t'en pour le sens, jamais pour affirmer qui a dit quoi.
Sers-toi de TOUT le fil, pas seulement du dernier message : ce qui a déjà été demandé, ce qu'il a déjà répondu, son niveau d'intérêt et son ton (s'il tutoie, s'il écrit court, s'il plaisante). Ne repose jamais une question déjà posée et ne répète jamais un message déjà envoyé — s'il n'a pas répondu à une question, reformule-la autrement plutôt que de la recopier.

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
function toSuggestion(v: unknown): ReplySuggestion | null {
  const o = v as { label?: unknown; text?: unknown };
  const t = typeof o?.text === "string" ? o.text.trim() : "";
  if (!t) return null;
  const l = typeof o?.label === "string" && o.label.trim() ? o.label.trim() : "Proposition";
  return { label: l, text: t };
}

export function parseSuggestions(raw: string): ReplySuggestion[] {
  const unfenced = stripFence(raw);
  if (!unfenced) return [];

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
      const out = list.map(toSuggestion).filter((s): s is ReplySuggestion => s !== null).slice(0, 4);
      if (out.length) return out;
    }
  } catch {
    // JSON invalide (souvent : réponse tronquée) — on récupère ci-dessous.
  }

  // Sauvetage : les objets complets d'une réponse coupée valent mieux que le
  // JSON brut affiché tel quel dans le panneau.
  const salvaged: ReplySuggestion[] = [];
  const seen = new Set<string>();
  for (const chunk of balancedObjects(unfenced)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }
    const s = toSuggestion(parsed);
    if (s && !seen.has(s.text)) {
      seen.add(s.text);
      salvaged.push(s);
    }
  }
  if (salvaged.length) return salvaged.slice(0, 4);

  return [{ label: "Brut", text: unfenced }];
}
