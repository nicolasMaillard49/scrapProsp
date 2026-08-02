// Qualification IA des prospects Instagram — automatisation de la méthode
// « filtrage ChatGPT » de la prospection organique :
//  - lots de 30 à 50 profils max par prompt (au-delà l'IA devient peu fiable) ;
//  - on n'envoie QUE l'info visible : nom, pseudo, nb d'abonnés, bio
//    (jamais de lien ni d'autres champs — ils faussent le tri) ;
//  - le verdict s'appuie sur l'avatar client (profession, fourchette d'abonnés,
//    bio FR) et renvoie qualified / borderline / rejected + profession + raison.
// Serveur uniquement (clé ANTHROPIC_API_KEY).

import Anthropic from "@anthropic-ai/sdk";

export const QUALIFY_BATCH_SIZE = 40; // règle 30-50 → on vise le milieu

// ID complet DATÉ obligatoire : l'alias court « claude-haiku-4-5 » renvoie
// 404 not_found_error sur ce compte (constaté le 02/08/2026) — chaque lot de
// qualification échouait en silence et AUCUN prospect n'entrait en sélection.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export type Verdict = "qualified" | "borderline" | "rejected";

export interface QualifyProfileInput {
  username: string;
  full_name?: string | null;
  followers?: number | null;
  bio?: string | null;
}

export interface QualifyAvatar {
  /** Profession / activité de l'avatar client (ex. "artisan du bâtiment : menuisier, paysagiste…"). */
  profession: string;
  /** Fourchette d'abonnés cible (défaut 0–2500 : indé/TPE, ni compte mort ni influenceur). */
  minFollowers?: number;
  maxFollowers?: number;
  /** Précisions libres optionnelles (ex. "exclure les fournisseurs et magasins"). */
  extra?: string;
}

export interface QualifyResult {
  username: string;
  verdict: Verdict;
  profession: string | null;
  reason: string | null;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function qualifyAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Découpe en lots de `size` (pur, testé). */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Construit le prompt d'un lot (pur, testé). Structure calquée sur le prompt
 * de tri validé par la méthode : avatar clair, critères visibles uniquement,
 * liste compacte, sortie JSON stricte.
 */
export function buildQualifyPrompt(profiles: QualifyProfileInput[], avatar: QualifyAvatar): string {
  const min = avatar.minFollowers ?? 0;
  const max = avatar.maxFollowers ?? 2500;
  const lines = profiles.map((p) => {
    const name = (p.full_name ?? "").replace(/\s+/g, " ").trim() || "—";
    const bio = (p.bio ?? "").replace(/\s+/g, " ").trim() || "—";
    const followers = typeof p.followers === "number" ? p.followers : "?";
    return `- pseudo: ${p.username} | nom: ${name} | abonnés: ${followers} | bio: ${bio}`;
  });
  return [
    `Tu tries une liste de profils Instagram pour de la prospection commerciale. Sois exigeant : les profils retenus seront contactés un par un.`,
    ``,
    `AVATAR CLIENT :`,
    `- Profession : ${avatar.profession}`,
    `- Nombre d'abonnés : entre ${min} et ${max} abonnés`,
    `- Profil français, biographie écrite en français`,
    avatar.extra ? `- ${avatar.extra}` : null,
    ``,
    `RÈGLES :`,
    `- Ne juge QUE sur ce qui est fourni (nom, pseudo, abonnés, bio). N'invente rien.`,
    `- "qualified" = correspond clairement à l'avatar (professionnel en activité, bonne fourchette, bio FR).`,
    `- "borderline" = plausible mais un doute (bio vague, abonnés hors fourchette de peu…).`,
    `- "rejected" = hors avatar : particulier, influenceur, fournisseur/marque/magasin, compte étranger, hors profession.`,
    ``,
    `PROFILS :`,
    ...lines,
    ``,
    `Réponds UNIQUEMENT avec un tableau JSON (aucun texte autour), un objet par profil :`,
    `[{"username":"...","verdict":"qualified|borderline|rejected","profession":"...","reason":"raison courte en français"}]`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Parse la réponse du modèle en résultats sûrs (pur, testé). */
export function parseQualifyResponse(text: string, expected: string[]): QualifyResult[] {
  const expectedSet = new Set(expected);
  const results = new Map<string, QualifyResult>();
  // Extrait le premier tableau JSON de la réponse (tolère du texte autour).
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const username = typeof item?.username === "string" ? item.username.replace(/^@/, "").trim() : "";
          if (!username || !expectedSet.has(username)) continue;
          const v = typeof item?.verdict === "string" ? item.verdict.toLowerCase() : "";
          const verdict: Verdict = v === "qualified" ? "qualified" : v === "borderline" ? "borderline" : "rejected";
          results.set(username, {
            username,
            verdict,
            profession: typeof item?.profession === "string" ? item.profession.slice(0, 120) : null,
            reason: typeof item?.reason === "string" ? item.reason.slice(0, 300) : null,
          });
        }
      }
    } catch {
      /* réponse illisible → tous les profils du lot restent non qualifiés */
    }
  }
  // Les profils absents de la réponse restent sans verdict (on ne devine pas).
  return expected.filter((u) => results.has(u)).map((u) => results.get(u)!);
}

/**
 * Qualifie une liste de profils par lots via Claude. Renvoie les résultats
 * obtenus (les profils sans verdict exploitable sont simplement absents).
 * `onBatch` permet de suivre la progression côté route.
 * `onError` reçoit le message de CHAQUE lot en échec : sans lui, une panne
 * Anthropic (crédits épuisés, clé invalide, modèle inconnu…) était avalée en
 * console et l'écran affichait juste « 0 retenus » — indiscernable d'un vrai
 * rejet. L'appelant doit pouvoir dire à l'utilisateur POURQUOI rien n'est trié.
 */
export async function qualifyProfiles(
  profiles: QualifyProfileInput[],
  avatar: QualifyAvatar,
  onBatch?: (done: number, total: number) => void,
  onError?: (message: string) => void,
): Promise<QualifyResult[]> {
  const ai = anthropic();
  if (!ai) throw new Error("ANTHROPIC_API_KEY manquant : qualification IA indisponible");
  const batches = chunk(profiles, QUALIFY_BATCH_SIZE);
  const all: QualifyResult[] = [];
  let done = 0;
  for (const batch of batches) {
    const prompt = buildQualifyPrompt(batch, avatar);
    try {
      const res = await ai.messages.create({
        model: MODEL,
        max_tokens: 4000,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      all.push(...parseQualifyResponse(text, batch.map((p) => p.username)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[igQualify] lot échoué:", msg);
      onError?.(msg);
      // Un lot qui échoue ne tue pas le run : on continue avec les suivants.
    }
    done += batch.length;
    onBatch?.(done, profiles.length);
  }
  return all;
}
