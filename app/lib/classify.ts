import Anthropic from "@anthropic-ai/sdk";

/**
 * Classement du sentiment d'une réponse SMS de prospection.
 * Renvoie 'positive' | 'negative' | 'neutral'.
 *
 * - Si ANTHROPIC_API_KEY est présent : Claude Haiku (rapide, quasi gratuit).
 * - Sinon : repli sur des mots-clés FR (le suivi reste fonctionnel sans clé).
 */

export type Sentiment = "positive" | "negative" | "neutral";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const NEG = /\b(non|stop|arret|arrêt|pas intéress|pas interess|jamais|d[ée]sabonn|d[ée]gage|spam|arnaque|cesse|laissez|laisse[zr]? moi|supprim|enlev)/i;
const POS = /\b(oui|ok|d'accord|d accord|intéress|interess|carte|combien|prix|tarif|rappel|rdv|rendez|dispo|appel|bien|super|parfait|nickel|merci|go|partant|ça m|ca m)/i;

/** Heuristique mots-clés (repli sans IA, et garde-fou rapide). */
export function classifyByKeywords(body: string): Sentiment {
  if (NEG.test(body)) return "negative";
  if (POS.test(body)) return "positive";
  return "neutral";
}

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

/** Vrai si le classement IA est disponible (clé présente). */
export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM =
  "Tu classes la réponse d'un prospect à un SMS de prospection (création de site web). " +
  "Réponds par UN SEUL MOT, sans ponctuation : positive, negative ou neutral. " +
  "positive = intérêt, question sur le prix/RDV, accord. " +
  "negative = refus, STOP, agacement, pas intéressé. " +
  "neutral = ambigu, hors-sujet, ni l'un ni l'autre.";

export async function classifyReply(body: string): Promise<Sentiment> {
  const ai = anthropic();
  if (!ai) return classifyByKeywords(body);
  try {
    const res = await ai.messages.create({
      model: MODEL,
      max_tokens: 5,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: "user", content: body.slice(0, 500) }],
    });
    const txt = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .toLowerCase();
    if (txt.includes("positive")) return "positive";
    if (txt.includes("negative")) return "negative";
    if (txt.includes("neutral")) return "neutral";
    return classifyByKeywords(body);
  } catch (e) {
    console.error("[classify] Haiku failed, fallback keywords:", e);
    return classifyByKeywords(body);
  }
}
