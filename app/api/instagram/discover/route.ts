import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { apifyConfigured, fetchHashtagUsernames, fetchProfiles } from "@/app/lib/apify";
import { isProspect, detectMetier, detectVille, detectBookingPlatform, pickContact } from "@/app/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel : laisse le temps aux runs Apify

const PROFILE_BATCH = 30; // usernames par appel profile-scraper (borne le temps de run-sync)
const SCAN_CAP = 600; // plafond dur de profils scannés / run (borne le coût Apify)

interface DiscoverBody {
  hashtag?: string;
  target?: number;
  dryRun?: boolean;
  keepAll?: boolean; // true = capture TOUS les profils (+ has_website), pas seulement les sans-site
}

/**
 * POST /api/instagram/discover  { hashtag, target?=100, dryRun? }
 * Découvre ~target comptes Instagram SANS site web pour un hashtag, via Apify.
 * Sur-récupère et scanne par lots jusqu'à atteindre la cible ou le plafond.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!apifyConfigured) return NextResponse.json({ error: "APIFY_TOKEN manquant" }, { status: 503 });

  let body: DiscoverBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const hashtag = (body.hashtag ?? "").replace(/^#/, "").trim();
  if (!hashtag) return NextResponse.json({ error: "hashtag requis" }, { status: 400 });
  const target = Math.min(Math.max(Number(body.target) || 100, 1), 300);
  const dryRun = body.dryRun === true;
  const keepAll = body.keepAll === true;

  // 1) Sur-récupération des usernames depuis le hashtag.
  const overfetch = Math.min(target * 5, 500);
  let usernames: string[];
  try {
    usernames = await fetchHashtagUsernames(hashtag, overfetch);
  } catch (e) {
    return NextResponse.json({ error: `Hashtag scraper: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
  if (!usernames.length) {
    return NextResponse.json({ hashtag, target, scanned: 0, qualified: 0, inserted: 0, results: [], note: "Aucun compte trouvé pour ce hashtag." });
  }

  // 2) Dédup contre la base (on ne re-scanne/ré-insère pas un compte déjà connu).
  const { data: existingRows } = await supabase
    .from("instagram_prospects")
    .select("username")
    .in("username", usernames);
  const known = new Set((existingRows ?? []).map((r) => r.username as string));
  const candidates = usernames.filter((u) => !known.has(u));

  // 3) Profile-scrape par lots jusqu'à la cible / plafond.
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
  }
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
      // keepAll=false (flux DM) : on n'garde que les sans-site. keepAll=true : on garde tout.
      if (!keepAll && !prospect) continue;
      const { email, phone } = pickContact(p);
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
      });
    }
    qualified.push(...batchRows);

    // Insertion incrémentale par lot : le progrès persiste même si le run est
    // interrompu (timeout fonction). dryRun -> aucune écriture.
    if (!dryRun && batchRows.length) {
      const { data, error } = await supabase
        .from("instagram_prospects")
        .upsert(batchRows, { onConflict: "username", ignoreDuplicates: true })
        .select(
          "id, username, full_name, bio, followers, follows_count, posts_count, category, metier, ville, booking_platform, email, phone, is_business, verified, has_website, profile_pic_url, status",
        );
      if (error) {
        console.error("insert batch failed:", error.message);
      } else {
        insertedRows.push(...((data ?? []) as Record<string, unknown>[]));
      }
    }
  }

  const capHit = scanned >= SCAN_CAP && qualified.length < target;

  return NextResponse.json({
    hashtag,
    target,
    dryRun,
    scanned,
    qualified: qualified.length,
    inserted: dryRun ? 0 : insertedRows.length,
    capHit,
    results: dryRun ? qualified : insertedRows,
  });
}
