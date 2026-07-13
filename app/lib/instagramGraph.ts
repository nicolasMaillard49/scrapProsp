// Client Instagram Graph API (flux "Instagram Login", host graph.instagram.com).
// App Meta "NMF Agence Publisher" liée au compte @nmfagence (user_id 17841433558530623).
// Scopes actifs : instagram_business_basic + instagram_business_content_publish.
//   → lecture profil / médias / insights, ET publication de contenu.
//   → la messagerie (instagram_business_manage_messages) n'est PAS active : les
//     endpoints /conversations & /messages exigent l'App Review (accès avancé).
// Token serveur uniquement : IG_GRAPH_ACCESS_TOKEN (jamais exposé au navigateur).

const BASE = "https://graph.instagram.com/v21.0";

const TOKEN = process.env.IG_GRAPH_ACCESS_TOKEN ?? "";
const USER_ID = process.env.IG_GRAPH_USER_ID ?? "";

export const instagramGraphConfigured = !!TOKEN && !!USER_ID;

/** Appel générique Graph. `path` relatif (ex. "me/media"), `params` hors token. */
async function graph<T>(
  path: string,
  params: Record<string, string> = {},
  init?: RequestInit,
): Promise<T> {
  if (!instagramGraphConfigured) throw new Error("IG_GRAPH_ACCESS_TOKEN / IG_GRAPH_USER_ID manquant");
  const qs = new URLSearchParams({ ...params, access_token: TOKEN }).toString();
  const url = `${BASE}/${path}?${qs}`;
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number } }).error;
    throw new Error(`IG Graph ${path} HTTP ${res.status}: ${err?.message ?? "erreur inconnue"} (code ${err?.code ?? "?"})`);
  }
  return json as T;
}

// ─── Lecture ──────────────────────────────────────────────────────────────

export interface IgAccount {
  user_id: string;
  username: string;
  account_type: string;
  media_count: number;
  followers_count?: number;
  follows_count?: number;
  profile_picture_url?: string;
}

/** Profil du compte connecté. */
export function getAccount(): Promise<IgAccount> {
  return graph<IgAccount>("me", {
    fields: "user_id,username,account_type,media_count,followers_count,follows_count,profile_picture_url",
  });
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

/** Derniers médias publiés (avec stats publiques). */
export async function getMedia(limit = 25): Promise<IgMedia[]> {
  const json = await graph<{ data: IgMedia[] }>("me/media", {
    fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  return json.data ?? [];
}

export interface IgInsightValue {
  value: number;
  end_time?: string;
}
export interface IgInsight {
  name: string;
  period: string;
  title?: string;
  values: IgInsightValue[];
}

/**
 * Insights du compte. Métriques usuelles : reach, impressions, profile_views,
 * follower_count, website_clicks, accounts_engaged (selon le type de compte).
 */
export async function getAccountInsights(
  metrics: string[] = ["reach", "profile_views", "follower_count"],
  period: "day" | "week" | "days_28" = "day",
): Promise<IgInsight[]> {
  const json = await graph<{ data: IgInsight[] }>("me/insights", {
    metric: metrics.join(","),
    period,
  });
  return json.data ?? [];
}

/** Insights d'un média précis (reach, likes, comments, saved, shares…). */
export async function getMediaInsights(
  mediaId: string,
  metrics: string[] = ["reach", "likes", "comments", "saved", "shares", "total_interactions"],
): Promise<IgInsight[]> {
  const json = await graph<{ data: IgInsight[] }>(`${mediaId}/insights`, { metric: metrics.join(",") });
  return json.data ?? [];
}

export interface IgMediaEnriched extends IgMedia {
  reach: number;
  saved: number;
  shares: number;
  total_interactions: number;
  /** likes + commentaires + saves + partages (score d'engagement absolu). */
  engagement: number;
  /** engagement / reach en % (taux d'engagement sur la couverture). */
  engagementRate: number | null;
}

/**
 * Médias enrichis de leurs insights (reach/saves/shares…), triés du plus
 * engageant au moins engageant. Un appel insights par média, en parallèle ;
 * un média dont les insights échouent (ex. trop récent) garde des valeurs à 0.
 */
export async function getMediaWithInsights(limit = 12): Promise<IgMediaEnriched[]> {
  const media = await getMedia(limit);
  const enriched = await Promise.all(
    media.map(async (m): Promise<IgMediaEnriched> => {
      const val = (ins: IgInsight[], name: string) =>
        ins.find((i) => i.name === name)?.values?.[0]?.value ?? 0;
      let ins: IgInsight[] = [];
      try {
        ins = await getMediaInsights(m.id);
      } catch {
        /* média sans insights (trop récent / type non supporté) → 0 */
      }
      const reach = val(ins, "reach");
      const likes = m.like_count ?? val(ins, "likes");
      const comments = m.comments_count ?? val(ins, "comments");
      const saved = val(ins, "saved");
      const shares = val(ins, "shares");
      const total = val(ins, "total_interactions") || likes + comments + saved + shares;
      return {
        ...m,
        reach,
        saved,
        shares,
        total_interactions: total,
        engagement: total,
        engagementRate: reach > 0 ? Math.round((total / reach) * 1000) / 10 : null,
      };
    }),
  );
  return enriched.sort((a, b) => b.engagement - a.engagement);
}

// ─── Publication (2 temps : conteneur puis publication) ─────────────────────

export interface PublishImageInput {
  imageUrl: string;
  caption?: string;
}
export interface PublishReelInput {
  videoUrl: string;
  caption?: string;
  coverUrl?: string;
}

/** Crée un conteneur média et renvoie son creation_id. */
async function createContainer(fields: Record<string, string>): Promise<string> {
  const json = await graph<{ id: string }>(`${USER_ID}/media`, {}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return json.id;
}

/** Publie un conteneur prêt (creation_id) et renvoie l'id du média publié. */
async function publishContainer(creationId: string): Promise<string> {
  const json = await graph<{ id: string }>(`${USER_ID}/media_publish`, {}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId }),
  });
  return json.id;
}

/**
 * Statut de traitement d'un conteneur (utile pour les vidéos/reels, dont
 * l'encodage est asynchrone : attendre status_code=FINISHED avant de publier).
 */
export function getContainerStatus(creationId: string): Promise<{ status_code: string; status?: string }> {
  return graph<{ status_code: string; status?: string }>(creationId, { fields: "status_code,status" });
}

/** Publie une image (URL publique) en un post. Renvoie l'id du média. */
export async function publishImage({ imageUrl, caption }: PublishImageInput): Promise<string> {
  const creationId = await createContainer({
    image_url: imageUrl,
    ...(caption ? { caption } : {}),
  });
  return publishContainer(creationId);
}

/**
 * Publie un reel (URL vidéo publique). Attend la fin de l'encodage (polling)
 * avant de publier. `onProgress` optionnel pour suivre le statut.
 */
export async function publishReel(
  { videoUrl, caption, coverUrl }: PublishReelInput,
  { maxWaitMs = 120_000, pollMs = 5_000, onProgress }: { maxWaitMs?: number; pollMs?: number; onProgress?: (s: string) => void } = {},
): Promise<string> {
  const creationId = await createContainer({
    media_type: "REELS",
    video_url: videoUrl,
    ...(coverUrl ? { cover_url: coverUrl } : {}),
    ...(caption ? { caption } : {}),
  });

  const deadline = Date.now() + maxWaitMs;
  // Note: pas de Date.now() interdit ici (code applicatif, pas script de workflow).
  for (;;) {
    const { status_code } = await getContainerStatus(creationId);
    onProgress?.(status_code);
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Conteneur reel en échec : ${status_code}`);
    }
    if (Date.now() > deadline) throw new Error("Timeout : encodage du reel trop long");
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return publishContainer(creationId);
}

// ─── Maintenance du token ───────────────────────────────────────────────────

/**
 * Rafraîchit le token longue durée (valable ~60 j). À appeler tous les ~50 j.
 * Renvoie le nouveau token + sa durée de vie en secondes.
 */
export async function refreshLongLivedToken(): Promise<{ access_token: string; expires_in: number }> {
  return graph<{ access_token: string; token_type: string; expires_in: number }>("refresh_access_token", {
    grant_type: "ig_refresh_token",
  });
}
