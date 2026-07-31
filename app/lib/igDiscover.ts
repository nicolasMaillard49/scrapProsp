// Découverte Apify d'un hashtag → insertion des prospects sans site.
// Extrait de /api/instagram/discover pour être réutilisable côté serveur par le
// refill automatique de la sélection du jour (`igSelection.refillStock`).

import { supabase } from "./supabase";
import { fetchHashtagUsernames, fetchProfiles } from "./apify";
import { isProspect, detectMetier, detectVille, detectBookingPlatform, pickContact, extractLastPostAt, prospectScore } from "./instagram";

const PROFILE_BATCH = 30; // usernames par appel profile-scraper (borne le temps de run-sync)
const SCAN_CAP = 600; // plafond dur de profils scannés / run (borne le coût Apify)

export interface DiscoverOptions {
  hashtag: string;
  target?: number;
  dryRun?: boolean;
  /** true = capture TOUS les profils (+ has_website), pas seulement les sans-site. */
  keepAll?: boolean;
}

export interface DiscoverResult {
  hashtag: string;
  target: number;
  dryRun: boolean;
  scanned: number;
  qualified: number;
  inserted: number;
  capHit: boolean;
  results: Record<string, unknown>[];
  note?: string;
}

interface QualRow {
  username: string;
  full_name: string | null;
  bio: string | null;
  external_url: string | null;
  followers: number | null;
  follows_count: number | null;
  posts_count: number | null;
  category: string | null;
  metier: string;
  ville: string;
  booking_platform: string | null;
  email: string | null;
  phone: string | null;
  is_business: boolean | null;
  verified: boolean | null;
  has_website: boolean;
  profile_pic_url: string | null;
  raw: unknown;
  hashtag_source: string;
  last_post_at: string | null;
  score: number;
  score_tier: "hot" | "warm" | "cold";
}

/**
 * Découvre ~target comptes Instagram (sans site par défaut) pour un hashtag.
 * Sur-récupère les usernames, déduplique contre la base, puis profile-scrape
 * par lots avec insertion incrémentale : le progrès persiste même si le run est
 * interrompu par un timeout de fonction.
 */
export async function discoverHashtag(opts: DiscoverOptions): Promise<DiscoverResult> {
  const hashtag = (opts.hashtag ?? "").replace(/^#/, "").trim();
  if (!hashtag) throw new Error("hashtag requis");
  const target = Math.min(Math.max(Number(opts.target) || 100, 1), 300);
  const dryRun = opts.dryRun === true;
  const keepAll = opts.keepAll === true;

  const overfetch = Math.min(target * 5, 500);
  const usernames = await fetchHashtagUsernames(hashtag, overfetch);
  if (!usernames.length) {
    return { hashtag, target, dryRun, scanned: 0, qualified: 0, inserted: 0, capHit: false, results: [], note: "Aucun compte trouvé pour ce hashtag." };
  }

  const { data: existingRows } = await supabase.from("instagram_prospects").select("username").in("username", usernames);
  const known = new Set((existingRows ?? []).map((r) => r.username as string));
  const candidates = usernames.filter((u) => !known.has(u));

  const qualified: QualRow[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  let scanned = 0;

  for (let i = 0; i < candidates.length && qualified.length < target && scanned < SCAN_CAP; i += PROFILE_BATCH) {
    const batch = candidates.slice(i, i + PROFILE_BATCH);
    let profiles;
    try {
      profiles = await fetchProfiles(batch);
    } catch (e) {
      // Un lot qui échoue ne tue pas le run : on continue avec les suivants.
      console.error("profile batch failed:", e instanceof Error ? e.message : e);
      scanned += batch.length;
      continue;
    }
    scanned += batch.length;

    const batchRows: QualRow[] = [];
    for (const p of profiles) {
      if (qualified.length + batchRows.length >= target) break;
      const prospect = isProspect(p); // sans vrai site = prospect
      if (!keepAll && !prospect) continue;
      const { email, phone } = pickContact(p);
      // Double check automatisé : activité récente + score d'opportunité.
      const lastPostAt = extractLastPostAt(p);
      const { score, tier } = prospectScore({
        has_website: !prospect,
        last_post_at: lastPostAt,
        followers: typeof p.followersCount === "number" ? p.followersCount : null,
        email,
        phone,
        is_business: typeof p.isBusinessAccount === "boolean" ? p.isBusinessAccount : null,
        bio: p.biography ?? null,
      });
      batchRows.push({
        username: p.username,
        full_name: p.fullName ?? null,
        bio: p.biography ?? null,
        external_url: p.externalUrl ?? null,
        followers: typeof p.followersCount === "number" ? p.followersCount : null,
        follows_count: typeof p.followsCount === "number" ? p.followsCount : null,
        posts_count: typeof p.postsCount === "number" ? p.postsCount : null,
        category: p.businessCategoryName ?? null,
        metier: detectMetier(p.businessCategoryName, p.biography),
        ville: detectVille(hashtag, p.biography),
        booking_platform: detectBookingPlatform(p.externalUrl, p.biography),
        email,
        phone,
        is_business: typeof p.isBusinessAccount === "boolean" ? p.isBusinessAccount : null,
        verified: typeof p.verified === "boolean" ? p.verified : null,
        has_website: !prospect,
        profile_pic_url: typeof p.profilePicUrl === "string" ? p.profilePicUrl : null,
        raw: p,
        hashtag_source: hashtag,
        last_post_at: lastPostAt,
        score,
        score_tier: tier,
      });
    }
    qualified.push(...batchRows);

    if (!dryRun && batchRows.length) {
      const { data, error } = await supabase
        .from("instagram_prospects")
        .upsert(batchRows, { onConflict: "username", ignoreDuplicates: true })
        .select(
          "id, username, full_name, bio, followers, follows_count, posts_count, category, metier, ville, booking_platform, email, phone, is_business, verified, has_website, profile_pic_url, status, last_post_at, score, score_tier",
        );
      if (error) {
        console.error("insert batch failed:", error.message);
      } else {
        insertedRows.push(...((data ?? []) as Record<string, unknown>[]));
      }
    }
  }

  return {
    hashtag,
    target,
    dryRun,
    scanned,
    qualified: qualified.length,
    inserted: dryRun ? 0 : insertedRows.length,
    capHit: scanned >= SCAN_CAP && qualified.length < target,
    results: dryRun ? (qualified as unknown as Record<string, unknown>[]) : insertedRows,
  };
}
