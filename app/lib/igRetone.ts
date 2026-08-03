// app/lib/igRetone.ts
// Reformulation d'une phrase de Nicolas en trois tons — logique PURE
// (prompt + parsing). Reformuler n'est pas répondre : la phrase reste LA
// SIENNE, avec ce qu'elle dit et ce qu'elle demande. Seul le ton bouge.

import { MAX_HISTORY, type ReplyProspect } from "./igReplyPrompt";
import { skillForWriting } from "./igSkill";
import { stripFence, balancedObjects } from "./jsonSalvage";

/**
 * Les trois tons, déclarés UNE fois : le prompt, le parsing et le panneau
 * lisent tous cette liste. L'ordre est celui de l'affichage.
 */
export const TONES = [
  { id: "calme", label: "Calme" },
  { id: "neutre", label: "Neutre" },
  { id: "cash", label: "Cash" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];

export interface RetoneVariant {
  tone: ToneId;
  /** Libellé affichable : le panneau n'a pas à connaître la table des tons. */
  label: string;
  text: string;
}

export interface RetoneContext {
  prospect: ReplyProspect | null;
  /** La phrase écrite par Nicolas, à reformuler. */
  text: string;
  /** Fil de la conversation, `moi:` / `lui:` / `?:` — facultatif. */
  history?: string;
}

/**
 * Plafond de sécurité, pas une limite d'usage : une phrase de DM ne l'atteint
 * jamais. Le fil réutilise MAX_HISTORY, déjà fixé pour la réponse assistée.
 */
export const MAX_RETONE = 2000;

export function buildRetoneSystem(ctx: RetoneContext): string {
  const p = ctx.prospect;
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

  return `Tu es l'assistant de prospection de Nicolas. Il a écrit une phrase pour un prospect, elle dit ce qu'il veut dire, mais elle ne sonne pas juste. Tu la lui rends en trois tons différents.

${skillForWriting()}

# Le prospect
${who}

# Lire le fil
Le fil t'est donné une ligne par message, préfixée par son auteur :
- \`moi:\` = un message déjà envoyé par Nicolas ;
- \`lui:\` = un message du prospect ;
- \`?:\` = auteur incertain (détection imparfaite) — sers-t'en pour le sens, jamais pour affirmer qui a dit quoi.
Le fil sert à viser juste. Il ne te donne pas le droit de répondre à la place de Nicolas.

# Ce que tu fais, exactement
Tu REFORMULES la phrase de Nicolas. Tu ne réponds pas au prospect, tu ne poursuis pas la conversation.
- garde ce que la phrase dit et ce qu'elle demande ;
- n'ajoute aucune information qu'elle ne contient pas, n'en retire aucune ;
- seul le ton change d'une variante à l'autre.

# Les trois tons
- **calme** — posé, sans pression, laisse une porte ouverte. La relation avant la vente.
- **neutre** — factuel et court, ni chaleureux ni piquant : la phrase débarrassée de ses hésitations.
- **cash** — provocateur : nomme la douleur. Ce qu'il perd, ce que ses concurrents font à sa place, ce que son profil ne lui rapporte pas. Piquer, oui — jamais insulter, jamais mépriser son métier, jamais mentir pour faire peur.

# Règles absolues — elles valent pour les TROIS tons, cash compris
- 1 à 3 phrases, comme un vrai DM tapé au pouce. Jamais de pavé.
- Aucune signature, aucun nom d'agence, aucune coordonnée (téléphone, email, site).
- Aucun lien tant que l'étape M9 n'est pas atteinte. Aucun prix, aucun devis, aucune promesse de résultat chiffrée.
- N'invente jamais un fait sur son activité que tu n'as pas dans le contexte ci-dessus.
- Une seule question par message maximum.
- Le tutoiement ou le vouvoiement de la phrase d'origine est CONSERVÉ tel quel : c'est le seul trait que le ton ne touche pas.
- Emojis, retours à la ligne et liens déjà présents dans la phrase : gardés à l'identique. N'en ajoute pas.
- La phrase est en français et le reste : ne traduis jamais.

# Format de sortie
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans bloc de code :
{"variants":[{"tone":"calme","text":"…"},{"tone":"neutre","text":"…"},{"tone":"cash","text":"…"}]}
Exactement une variante par ton, dans cet ordre.`;
}

export function buildRetoneUser(ctx: RetoneContext): string {
  const hist = (ctx.history ?? "").trim().slice(0, MAX_HISTORY);
  const text = (ctx.text ?? "").trim().slice(0, MAX_RETONE);
  return [
    hist ? `Fil de la conversation (du plus ancien au plus récent) :\n${hist}\n` : null,
    `Phrase de Nicolas à reformuler :\n${text}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Parsing ────────────────────────────────────────────────────────────────

interface RawVariant {
  tone: string | null;
  text: string;
}

function toRaw(v: unknown): RawVariant | null {
  const o = v as { tone?: unknown; text?: unknown };
  const text = typeof o?.text === "string" ? o.text.trim() : "";
  if (!text) return null;
  const tone = typeof o?.tone === "string" ? o.tone.trim().toLowerCase() : "";
  return { tone: tone || null, text };
}

/**
 * Extrait les variantes brutes de la sortie du modèle.
 *
 * Deux accidents connus : le bloc de code autour, et la réponse COUPÉE au
 * plafond de tokens. Dans le second cas l'objet extérieur n'est jamais
 * refermé, mais les variantes complètes, elles, sont exploitables.
 */
function collect(raw: string): RawVariant[] {
  const unfenced = stripFence(raw);
  if (!unfenced) return [];

  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;

  try {
    const parsed: unknown = JSON.parse(candidate);
    const list = Array.isArray(parsed) ? parsed : (parsed as { variants?: unknown })?.variants;
    // Liste bien formée : elle fait foi, même vide — le modèle a répondu, il
    // n'a simplement rien proposé, et le sauvetage n'y changerait rien.
    if (Array.isArray(list)) {
      return list.map(toRaw).filter((v): v is RawVariant => v !== null);
    }
  } catch {
    // JSON invalide (souvent : réponse tronquée) — on récupère ci-dessous.
  }

  const salvaged: RawVariant[] = [];
  const seen = new Set<string>();
  for (const chunk of balancedObjects(unfenced)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }
    const v = toRaw(parsed);
    if (v && !seen.has(v.text)) {
      seen.add(v.text);
      salvaged.push(v);
    }
  }
  return salvaged;
}

/**
 * Apparie les variantes aux tons et les rend TOUJOURS dans l'ordre de TONES :
 * la place d'un ton à l'écran ne doit pas changer d'un appel à l'autre.
 *
 * Un `tone` inconnu, absent ou déjà pris ne fait pas jeter la variante — elle
 * prend le premier ton encore libre. Aucun repli « texte brut » en revanche :
 * un fragment de JSON collé dans le champ Instagram serait nuisible.
 */
export function parseVariants(raw: string): RetoneVariant[] {
  const ids: readonly string[] = TONES.map((t) => t.id);
  const byTone = new Map<ToneId, string>();
  const leftovers: string[] = [];

  for (const item of collect(raw)) {
    const id = item.tone && ids.includes(item.tone) ? (item.tone as ToneId) : null;
    if (id && !byTone.has(id)) byTone.set(id, item.text);
    else leftovers.push(item.text);
  }

  for (const t of TONES) {
    if (!leftovers.length) break;
    if (!byTone.has(t.id)) byTone.set(t.id, leftovers.shift() as string);
  }

  return TONES.filter((t) => byTone.has(t.id)).map((t) => ({
    tone: t.id,
    label: t.label,
    text: byTone.get(t.id) as string,
  }));
}
