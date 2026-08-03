// app/lib/igClassify.ts
// Qualification PURE d'une réponse à froid : le prospect a-t-il répondu au
// premier message, et cette réponse vaut-elle « positive », « neutre »,
// « refus » ou « autorépondeur » ?
//
// C'est la mesure qui juge la qualité de l'accroche. Elle alimente `ig_replies`
// (migration 018), donc les KPI et la file de relance — d'où la prudence :
// mieux vaut ne rien conclure qu'inscrire une qualification fausse.

import { REPLY_KINDS, type ReplyKind } from "./igPipeline";
import { skillForWriting } from "./igSkill";

export interface ClassifyVerdict {
  /** Le prospect a écrit quelque chose après le premier message de Nicolas. */
  replied: boolean;
  /** Genre de la réponse — null si personne n'a répondu. */
  kind: ReplyKind | null;
  /** Vrai si c'est bien la réponse au PREMIER message (réponse à froid). */
  cold: boolean;
  /** Extrait de la réponse, pour retrouver le contexte dans le CRM. */
  excerpt: string;
  confidence: "haute" | "moyenne" | "basse";
  reason: string;
}

export const CONFIDENCES = ["haute", "moyenne", "basse"] as const;

export function buildClassifySystemPrompt(): string {
  return `Tu qualifies la RÉPONSE À FROID d'un prospect dans une conversation de prospection Instagram.

${skillForWriting()}

# Ta tâche
Le fil t'est donné une ligne par message : \`moi:\` = Nicolas, \`lui:\` = le prospect, \`?:\` = auteur incertain (ne t'appuie pas dessus pour conclure).

Détermine :
1. Le prospect a-t-il répondu après le PREMIER message de Nicolas ? (\`replied\`)
2. Sa PREMIÈRE réponse est-elle bien une réponse au premier message, c'est-à-dire une réponse à froid ? (\`cold\`) — faux si la conversation avait déjà commencé avant, ou si le prospect a écrit en premier.
3. De quel genre est cette première réponse ? (\`kind\`)

# Les quatre genres, sans interprétation personnelle
- \`positive\` : il montre de l'intérêt, pose une question, accepte d'écouter, avance. « oui toujours », « je vous écoute », « dites-moi », « ça m'intéresse ».
- \`neutre\` : il répond sans se positionner. « ok », « c'est quoi ? », « bonjour », un simple emoji.
- \`refus\` : il décline explicitement. « non merci », « pas intéressé », « arrêtez de me démarcher ».
- \`autorepondeur\` : message automatique, absence, horaires d'ouverture, « nous vous répondrons dès que possible ». Ce n'est pas un humain qui a répondu.

# Prudence
Cette qualification entre dans un CRM et fait sortir le prospect de la file de relance. En cas de doute réel, mets \`confidence\` à \`basse\` et explique pourquoi dans \`reason\` — Nicolas tranchera. Ne devine jamais un genre pour "faire propre".
Si aucune ligne \`lui:\` n'existe, alors \`replied\` est faux, \`kind\` est null.

# Format de sortie
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans bloc de code :
{"replied":true,"cold":true,"kind":"positive","excerpt":"la réponse du prospect, mot pour mot","confidence":"haute","reason":"une phrase courte"}`;
}

/**
 * Parse le verdict. Tolérant sur la forme, strict sur le fond : un genre
 * inconnu, un JSON cassé ou un extrait absent ne produisent jamais une
 * qualification par défaut — ils produisent « rien à conclure ».
 */
export function parseVerdict(raw: string): ClassifyVerdict | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let o: Record<string, unknown>;
  try {
    o = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const replied = o.replied === true;
  const kindRaw = typeof o.kind === "string" ? o.kind.toLowerCase().trim() : "";
  const kind = REPLY_KINDS.includes(kindRaw as ReplyKind) ? (kindRaw as ReplyKind) : null;
  // Une réponse annoncée sans genre reconnu n'est pas exploitable : on ne
  // choisit pas « neutre » par défaut, ça polluerait les KPI d'accroche.
  if (replied && !kind) return null;

  const confRaw = typeof o.confidence === "string" ? o.confidence.toLowerCase().trim() : "";
  const confidence = (CONFIDENCES as readonly string[]).includes(confRaw)
    ? (confRaw as ClassifyVerdict["confidence"])
    : "basse";

  return {
    replied,
    kind: replied ? kind : null,
    cold: o.cold === true,
    excerpt: typeof o.excerpt === "string" ? o.excerpt.trim().slice(0, 500) : "",
    confidence,
    reason: typeof o.reason === "string" ? o.reason.trim().slice(0, 300) : "",
  };
}
