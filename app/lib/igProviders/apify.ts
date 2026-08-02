// Provider Apify — source primaire de la découverte Instagram (2 actors en chaîne).
//  - apify/instagram-hashtag-scraper : hashtag -> posts (ownerUsername)
//  - apify/instagram-profile-scraper : usernames -> profils (bio, externalUrl, followers, catégorie)
// Token serveur uniquement : APIFY_TOKEN (jamais exposé au navigateur).

import { iglog } from "./log";
import { ProviderError, type HashtagCandidate, type HashtagPage, type IgProfile, type IgProvider } from "./types";

const TOKEN = process.env.APIFY_TOKEN ?? "";
const BASE = "https://api.apify.com/v2/acts";
const NAME = "apify";

/**
 * Traduit un échec HTTP Apify en `FailureKind`.
 * 402/403 = crédits du mois épuisés (c'est le 403 que renvoyait déjà le cron
 * quand le quota tombait) ; 401 = token invalide.
 */
function classify(status: number, body: string): ProviderError {
  const kind =
    status === 401 ? "auth"
    : status === 402 || status === 403 ? "quota"
    : status === 429 ? "rate_limit"
    : status >= 500 ? "transient"
    : "fatal";
  return new ProviderError(NAME, kind, `HTTP ${status}: ${body.slice(0, 200)}`, status);
}

/** Lance un actor en mode synchrone et renvoie directement les items du dataset. */
async function runActorSync<T>(actor: string, input: unknown, timeoutMs = 280_000): Promise<T[]> {
  if (!TOKEN) {
    iglog("err", "apify", `${actor} — APIFY_TOKEN MANQUANT (source primaire inutilisable)`);
    throw new ProviderError(NAME, "auth", "APIFY_TOKEN manquant");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  iglog("info", "apify", `→ ${actor} (run-sync)`);
  try {
    const res = await fetch(`${BASE}/${actor}/run-sync-get-dataset-items?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = classify(res.status, body);
      // 402/403 = crédits du mois épuisés : LE signal qui doit déclencher la bascule.
      iglog("err", "apify", `← ${actor} HTTP ${res.status} (${err.kind})${err.kind === "quota" ? " — crédits Apify épuisés, bascule attendue" : ""}`, {
        body: body.slice(0, 200),
      });
      throw err;
    }
    const data = await res.json();
    const items = Array.isArray(data) ? (data as T[]) : [];
    iglog("ok", "apify", `← ${actor} OK — ${items.length} item(s) en ${Date.now() - t0}ms`);
    return items;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    // AbortError (timeout) et pannes réseau sont retentables ailleurs.
    iglog("err", "apify", `← ${actor} panne réseau/timeout après ${Date.now() - t0}ms`, { message: msg });
    throw new ProviderError(NAME, "transient", `${actor} — ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

interface IgPost {
  ownerUsername?: string | null;
  ownerId?: string | number | null;
}

export const apifyProvider: IgProvider = {
  name: NAME,
  configured: !!TOKEN,

  /**
   * L'actor ne prend pas de curseur : il repart toujours des posts les plus
   * récents. Le paramètre est donc ignoré, et on ne déclare jamais le hashtag
   * épuisé — de nouveaux posts apparaissent en permanence, y revenir plus tard
   * a du sens. La dédup en aval (par username et par ig_user_id) absorbe les
   * comptes déjà vus.
   */
  async hashtagCandidates(hashtag: string, limit: number): Promise<HashtagPage> {
    const tag = hashtag.replace(/^#/, "").trim();
    const posts = await runActorSync<IgPost>("apify~instagram-hashtag-scraper", {
      hashtags: [tag],
      resultsType: "posts",
      resultsLimit: limit,
    });
    const seen = new Set<string>();
    const candidates: HashtagCandidate[] = [];
    for (const p of posts) {
      const u = p.ownerUsername?.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      candidates.push({ username: u, igUserId: p.ownerId != null ? String(p.ownerId) : null });
    }
    return { candidates, nextCursor: null, exhausted: false };
  },

  async profilesByUsername(usernames: string[]): Promise<IgProfile[]> {
    if (!usernames.length) return [];
    return runActorSync<IgProfile>("apify~instagram-profile-scraper", { usernames });
  },
};
