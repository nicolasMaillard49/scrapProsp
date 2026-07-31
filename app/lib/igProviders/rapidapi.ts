// Providers RapidAPI — filets de secours quand les crédits Apify du mois sont épuisés.
//
// Deux APIs, une seule clé (`RAPIDAPI_KEY`, celle du compte RapidAPI) :
//  1. Instagram Looter   — 150 req/mois en gratuit. Découverte + profils.
//  2. Instagram Scraper Stable API — 20 req/mois. Profils uniquement.
//
// Différence structurelle avec Apify, qui dicte tout le reste : leurs feeds
// hashtag ne renvoient QUE `owner.id`, jamais le username. Un compte découvert
// coûte donc une requête de résolution (`/profile?id=`) — d'où la dédup par
// `ig_user_id` en amont (voir igSource.ts) : sans elle un seul scan brûlerait
// le quota mensuel à re-résoudre des comptes déjà en base.

import { ProviderError, type FailureKind, type HashtagCandidate, type IgProfile, type IgProvider } from "./types";

const KEY = process.env.RAPIDAPI_KEY ?? "";

const LOOTER_HOST = "instagram-looter2.p.rapidapi.com";
const STABLE_HOST = "instagram-scraper-stable-api.p.rapidapi.com";

const TIMEOUT_MS = 45_000;

/**
 * RapidAPI renvoie 429 aussi bien pour « quota mensuel épuisé » que pour un
 * simple dépassement de débit — seul le corps les distingue, et la nuance
 * décide du cooldown (6 h contre 2 min).
 */
export function classify(provider: string, status: number, body: string): ProviderError {
  const monthly = /exceeded the (MONTHLY|DAILY) quota|upgrade your plan/i.test(body);
  let kind: FailureKind;
  if (status === 429) kind = monthly ? "quota" : "rate_limit";
  else if (status === 401) kind = "auth";
  else if (status === 403) kind = /not subscribed|does not exist/i.test(body) ? "auth" : "quota";
  else if (status >= 500) kind = "transient";
  else kind = "fatal";
  return new ProviderError(provider, kind, `HTTP ${status}: ${body.slice(0, 200)}`, status);
}

async function call(provider: string, host: string, path: string, init?: RequestInit): Promise<unknown> {
  if (!KEY) throw new ProviderError(provider, "auth", "RAPIDAPI_KEY manquante");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://${host}${path}`, {
      ...init,
      headers: { "x-rapidapi-host": host, "x-rapidapi-key": KEY, ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    });
    const txt = await res.text();
    if (!res.ok) throw classify(provider, res.status, txt);
    try {
      return JSON.parse(txt);
    } catch {
      throw new ProviderError(provider, "fatal", `réponse non-JSON: ${txt.slice(0, 120)}`);
    }
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(provider, "transient", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Unix (secondes) → ISO, format attendu par `extractLastPostAt`. */
function isoFromUnix(ts: unknown): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  const d = new Date(ts * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ────────────────────────────────────────────────────────────
 * 1. Instagram Looter — découverte + profils
 * ──────────────────────────────────────────────────────────── */

const LOOTER = "looter";

interface LooterEdges<T> {
  count?: number;
  edges?: Array<{ node?: T }>;
  page_info?: { has_next_page?: boolean; end_cursor?: string | null };
}

interface LooterProfile {
  status?: boolean;
  username?: string;
  full_name?: string | null;
  biography?: string | null;
  external_url?: string | null;
  bio_links?: Array<{ url?: string }> | null;
  category_name?: string | null;
  business_category_name?: string | null;
  business_email?: string | null;
  business_phone_number?: string | null;
  is_business_account?: boolean | null;
  is_professional_account?: boolean | null;
  is_verified?: boolean | null;
  is_private?: boolean | null;
  profile_pic_url?: string | null;
  profile_pic_url_hd?: string | null;
  id?: string | null;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  edge_owner_to_timeline_media?: LooterEdges<{ taken_at_timestamp?: number }>;
}

/** Looter (schéma GraphQL public) → shape Apify. */
export function mapLooter(p: LooterProfile): IgProfile | null {
  const username = str(p.username);
  if (!username) return null;
  const posts = p.edge_owner_to_timeline_media?.edges ?? [];
  const latestPosts = posts
    .map((e) => isoFromUnix(e.node?.taken_at_timestamp))
    .filter((t): t is string => !!t)
    .map((timestamp) => ({ timestamp }));
  return {
    username,
    fullName: str(p.full_name),
    biography: str(p.biography),
    externalUrl: str(p.external_url),
    externalUrls: (p.bio_links ?? []).filter((l) => str(l?.url)).map((l) => ({ url: l.url })),
    followersCount: num(p.edge_followed_by?.count),
    followsCount: num(p.edge_follow?.count),
    postsCount: num(p.edge_owner_to_timeline_media?.count),
    businessCategoryName: str(p.business_category_name) ?? str(p.category_name),
    isBusinessAccount: p.is_business_account ?? p.is_professional_account ?? null,
    verified: p.is_verified ?? null,
    private: p.is_private === true,
    profilePicUrl: str(p.profile_pic_url_hd) ?? str(p.profile_pic_url),
    public_email: str(p.business_email),
    public_phone_number: str(p.business_phone_number),
    latestPosts,
    igUserId: str(p.id),
    _provider: LOOTER,
  };
}

async function looterProfile(param: "username" | "id", value: string): Promise<IgProfile | null> {
  const raw = (await call(LOOTER, LOOTER_HOST, `/profile?${param}=${encodeURIComponent(value)}`)) as LooterProfile;
  // Un compte supprimé/privé répond 200 avec status:false — ce n'est pas une panne.
  if (!raw || raw.status === false) return null;
  return mapLooter(raw);
}

/**
 * Résout des profils un par un. Séquentiel volontairement : le plan gratuit
 * tolère 1000 req/h mais chaque appel est un crédit mensuel, et un lot qui
 * échoue à mi-parcours ne doit pas en gaspiller 30 de plus en parallèle.
 * Un profil introuvable est ignoré ; une panne du provider remonte.
 */
async function looterProfiles(param: "username" | "id", values: string[]): Promise<IgProfile[]> {
  const out: IgProfile[] = [];
  for (const v of values) {
    const p = await looterProfile(param, v);
    if (p) out.push(p);
  }
  return out;
}

export const looterProvider: IgProvider = {
  name: LOOTER,
  configured: !!KEY,

  async hashtagCandidates(hashtag: string, limit: number): Promise<HashtagCandidate[]> {
    const tag = hashtag.replace(/^#/, "").trim();
    const seen = new Set<string>();
    const out: HashtagCandidate[] = [];
    let cursor: string | null = null;

    // ~30 posts par page ; on s'arrête dès qu'on a de quoi couvrir `limit`.
    for (let page = 0; page < 12 && out.length < limit; page++) {
      const qs = `/tag-feeds?query=${encodeURIComponent(tag)}${cursor ? `&end_cursor=${encodeURIComponent(cursor)}` : ""}`;
      const body = (await call(LOOTER, LOOTER_HOST, qs)) as {
        data?: { hashtag?: { edge_hashtag_to_media?: LooterEdges<{ owner?: { id?: string } }> } };
      };
      const media = body?.data?.hashtag?.edge_hashtag_to_media;
      const edges = media?.edges ?? [];
      if (!edges.length) break;
      for (const e of edges) {
        const id = str(e.node?.owner?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ igUserId: id });
      }
      cursor = media?.page_info?.has_next_page ? str(media.page_info?.end_cursor) : null;
      if (!cursor) break;
    }
    return out;
  },

  profilesByUsername: (usernames) => looterProfiles("username", usernames),
  profilesById: (ids) => looterProfiles("id", ids),
};

/* ────────────────────────────────────────────────────────────
 * 2. Instagram Scraper Stable API — profils par username uniquement
 *
 * Son feed hashtag existe mais ne sert à rien ici : il renvoie des owner ids
 * qu'elle-même ne sait pas résoudre (tous ses endpoints profil prennent un
 * username). Avec 20 req/mois, c'est un dernier recours pour enrichir des
 * comptes déjà identifiés, pas une source de découverte.
 * ──────────────────────────────────────────────────────────── */

const STABLE = "stable";

interface StableProfile {
  username?: string;
  full_name?: string | null;
  biography?: string | null;
  external_url?: string | null;
  bio_links?: Array<{ url?: string }> | null;
  category?: string | null;
  follower_count?: number | null;
  following_count?: number | null;
  media_count?: number | null;
  is_business?: boolean | null;
  is_professional_account?: boolean | null;
  account_type?: number | null;
  is_verified?: boolean | null;
  is_private?: boolean | null;
  profile_pic_url?: string | null;
  hd_profile_pic_url_info?: { url?: string } | null;
  pk?: string | null;
  id?: string | null;
  email_from_biography?: string[] | null;
  phone_from_biography?: string[] | null;
}

/** Stable API (schéma privé Instagram) → shape Apify. Pas de posts → pas de `last_post_at`. */
export function mapStable(p: StableProfile): IgProfile | null {
  const username = str(p.username);
  if (!username) return null;
  return {
    username,
    fullName: str(p.full_name),
    biography: str(p.biography),
    externalUrl: str(p.external_url),
    externalUrls: (p.bio_links ?? []).filter((l) => str(l?.url)).map((l) => ({ url: l.url })),
    followersCount: num(p.follower_count),
    followsCount: num(p.following_count),
    postsCount: num(p.media_count),
    businessCategoryName: str(p.category),
    isBusinessAccount: p.is_business ?? p.is_professional_account ?? (p.account_type === 2 ? true : null),
    verified: p.is_verified ?? null,
    private: p.is_private === true,
    profilePicUrl: str(p.hd_profile_pic_url_info?.url) ?? str(p.profile_pic_url),
    public_email: str((p.email_from_biography ?? [])[0]),
    public_phone_number: str((p.phone_from_biography ?? [])[0]),
    latestPosts: [],
    igUserId: str(p.pk) ?? str(p.id),
    _provider: STABLE,
  };
}

export const stableProvider: IgProvider = {
  name: STABLE,
  configured: !!KEY,

  async profilesByUsername(usernames: string[]): Promise<IgProfile[]> {
    const out: IgProfile[] = [];
    for (const u of usernames) {
      const raw = (await call(STABLE, STABLE_HOST, "/ig_get_fb_profile_v3.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username_or_url: u }).toString(),
      })) as StableProfile;
      const p = raw ? mapStable(raw) : null;
      if (p) out.push(p);
    }
    return out;
  },
};
