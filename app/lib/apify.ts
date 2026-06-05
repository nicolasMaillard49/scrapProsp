// Client Apify pour la découverte Instagram (2 actors en chaîne).
//  - apify/instagram-hashtag-scraper : hashtag -> posts (ownerUsername)
//  - apify/instagram-profile-scraper : usernames -> profils (bio, externalUrl, followers, catégorie)
// Token serveur uniquement : APIFY_TOKEN (jamais exposé au navigateur).

const TOKEN = process.env.APIFY_TOKEN ?? "";
export const apifyConfigured = !!TOKEN;

const BASE = "https://api.apify.com/v2/acts";

/** Lance un actor en mode synchrone et renvoie directement les items du dataset. */
async function runActorSync<T>(actor: string, input: unknown, timeoutMs = 280_000): Promise<T[]> {
  if (!apifyConfigured) throw new Error("APIFY_TOKEN manquant");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${actor}/run-sync-get-dataset-items?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Apify ${actor} HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

interface IgPost {
  ownerUsername?: string | null;
}

export interface IgProfile {
  username: string;
  fullName?: string | null;
  biography?: string | null;
  externalUrl?: string | null;
  followersCount?: number | null;
  businessCategoryName?: string | null;
  private?: boolean;
}

/**
 * Récupère les usernames uniques des comptes ayant posté sous un hashtag.
 * `limit` = nombre de posts scannés (on dédublique les owners ensuite).
 */
export async function fetchHashtagUsernames(hashtag: string, limit: number): Promise<string[]> {
  const tag = hashtag.replace(/^#/, "").trim();
  const posts = await runActorSync<IgPost>("apify~instagram-hashtag-scraper", {
    hashtags: [tag],
    resultsType: "posts",
    resultsLimit: limit,
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of posts) {
    const u = p.ownerUsername?.trim();
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/** Récupère les profils détaillés d'une liste de usernames. */
export async function fetchProfiles(usernames: string[]): Promise<IgProfile[]> {
  if (!usernames.length) return [];
  return runActorSync<IgProfile>("apify~instagram-profile-scraper", { usernames });
}
