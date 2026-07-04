import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { qualifyAvailable, qualifyProfiles, type QualifyAvatar } from "@/app/lib/igQualify";
import { prospectScore } from "@/app/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // plusieurs lots Claude en série

const RUN_CAP = 400; // profils max par run (10 lots) — borne le temps + le coût

interface Body {
  /** Filtre métier (colonne metier) — optionnel. */
  metier?: string;
  /** Filtre hashtag_source — optionnel. */
  hashtag?: string;
  /** true (défaut) : ne qualifie que les profils encore sans verdict. */
  onlyUnqualified?: boolean;
  /** Avatar client — profession obligatoire. */
  avatar?: Partial<QualifyAvatar>;
  /** Nombre max de profils à traiter sur ce run (défaut 200, cap 400). */
  limit?: number;
}

/**
 * POST /api/instagram/qualify
 * Qualification IA des prospects Instagram par lots de 40 (méthode « filtrage
 * ChatGPT » automatisée) : envoie uniquement nom/pseudo/abonnés/bio à Claude,
 * stocke verdict + profession + raison, et recalcule le score d'opportunité.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  if (!qualifyAvailable()) return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const profession = (body.avatar?.profession ?? "").trim();
  if (!profession) return NextResponse.json({ error: "avatar.profession requis" }, { status: 400 });
  const avatar: QualifyAvatar = {
    profession,
    minFollowers: typeof body.avatar?.minFollowers === "number" ? body.avatar.minFollowers : 0,
    maxFollowers: typeof body.avatar?.maxFollowers === "number" ? body.avatar.maxFollowers : 2500,
    extra: typeof body.avatar?.extra === "string" ? body.avatar.extra : undefined,
  };
  const onlyUnqualified = body.onlyUnqualified !== false;
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), RUN_CAP);

  // Sélection des profils à trier.
  let q = supabase
    .from("instagram_prospects")
    .select("username, full_name, followers, bio, has_website, last_post_at, email, phone, is_business")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (onlyUnqualified) q = q.is("qualification", null);
  if (body.metier?.trim()) q = q.eq("metier", body.metier.trim());
  if (body.hashtag?.trim()) q = q.eq("hashtag_source", body.hashtag.trim().replace(/^#/, ""));

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) {
    return NextResponse.json({ processed: 0, qualified: 0, borderline: 0, rejected: 0, note: "Aucun profil à qualifier." });
  }

  // Qualification par lots (règle 30-50 : QUALIFY_BATCH_SIZE=40).
  const results = await qualifyProfiles(
    rows.map((r) => ({ username: r.username as string, full_name: r.full_name as string | null, followers: r.followers as number | null, bio: r.bio as string | null })),
    avatar,
  );

  // Écriture des verdicts + recalcul du score (le verdict IA affine le tier).
  const byUsername = new Map(rows.map((r) => [r.username as string, r]));
  const counts = { qualified: 0, borderline: 0, rejected: 0 };
  for (const res of results) {
    counts[res.verdict]++;
    const row = byUsername.get(res.username);
    const base = row
      ? prospectScore({
          has_website: row.has_website as boolean | null,
          last_post_at: row.last_post_at as string | null,
          followers: row.followers as number | null,
          email: row.email as string | null,
          phone: row.phone as string | null,
          is_business: row.is_business as boolean | null,
          bio: row.bio as string | null,
        })
      : { score: 0, tier: "cold" as const };
    // Un rejeté est toujours cold ; un borderline plafonne à warm.
    const tier = res.verdict === "rejected" ? "cold" : res.verdict === "borderline" && base.tier === "hot" ? "warm" : base.tier;
    const { error: upErr } = await supabase
      .from("instagram_prospects")
      .update({
        qualification: res.verdict,
        qualification_reason: res.reason,
        profession_ia: res.profession,
        score: base.score,
        score_tier: tier,
      })
      .eq("username", res.username);
    if (upErr) console.error("[qualify] update failed:", res.username, upErr.message);
  }

  return NextResponse.json({
    processed: results.length,
    selected: rows.length,
    ...counts,
    note: results.length < rows.length ? `${rows.length - results.length} profil(s) sans verdict exploitable (lot IA en échec) — relancer.` : undefined,
  });
}
