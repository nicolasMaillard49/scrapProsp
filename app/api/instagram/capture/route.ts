import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { igSourceConfigured, fetchProfiles } from "@/app/lib/igSource";
import {
  isProspect, detectMetier, detectVille, detectBookingPlatform,
  pickContact, extractLastPostAt, prospectScore,
} from "@/app/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/instagram/capture  { username }
 *
 * Le mode chasse : n'importe quel profil croisé sur Instagram devient un
 * prospect scoré, sans quitter la page.
 *
 * Le hasard est le meilleur scraper de la journée — un commentaire, une
 * suggestion, un abonné d'un concurrent — et jusqu'ici tout ça se perdait :
 * le panneau disait « hors base, rien ne sera journalisé » et l'histoire
 * s'arrêtait là.
 *
 * Idempotent : un profil déjà en base est renvoyé tel quel (`created: false`)
 * plutôt que dupliqué ou refusé. Le geste doit pouvoir se répéter sans peur.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: { username?: string; ville?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "username requis" }, { status: 400 });

  // Déjà connu : on ne retouche à RIEN. Réimporter écraserait un métier
  // corrigé à la main, une ville saisie, un stade — pour redonner ce que la
  // source dit aujourd'hui, qui n'est pas forcément mieux.
  const { data: existing } = await supabase
    .from("instagram_prospects")
    .select("id, username, stage, status")
    .eq("username", username)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, created: false, prospect: existing });

  if (!igSourceConfigured) {
    return NextResponse.json({ error: "Aucune source Instagram configurée (RAPIDAPI_KEY)" }, { status: 503 });
  }

  try {
    const [profile] = await fetchProfiles([username], "username");
    if (!profile) {
      return NextResponse.json({ error: `Profil @${username} introuvable côté source.` }, { status: 404 });
    }

    // Exactement le même calcul que la découverte par hashtag : un prospect
    // capté à la main doit être scoré comme les autres, sinon il fausse la
    // file du jour au lieu de l'enrichir.
    const sansSite = isProspect(profile);
    const { email, phone } = pickContact(profile);
    const lastPostAt = extractLastPostAt(profile);
    const followers = typeof profile.followersCount === "number" ? profile.followersCount : null;
    const { score, tier } = prospectScore({
      has_website: !sansSite,
      last_post_at: lastPostAt,
      followers,
      email,
      phone,
      is_business: typeof profile.isBusinessAccount === "boolean" ? profile.isBusinessAccount : null,
      bio: profile.biography ?? null,
    });

    const row = {
      username: profile.username,
      ig_user_id: typeof profile.igUserId === "string" ? profile.igUserId : typeof profile.id === "string" ? profile.id : null,
      full_name: profile.fullName ?? null,
      bio: profile.biography ?? null,
      external_url: profile.externalUrl ?? null,
      followers,
      follows_count: typeof profile.followsCount === "number" ? profile.followsCount : null,
      posts_count: typeof profile.postsCount === "number" ? profile.postsCount : null,
      category: profile.businessCategoryName ?? null,
      metier: detectMetier(profile.businessCategoryName, profile.biography),
      // La ville tapée dans le panneau prime : elle vient d'un humain qui a le
      // profil sous les yeux, la détection ne fait que deviner depuis la bio.
      ville: (body.ville ?? "").trim() || detectVille(null, profile.biography),
      booking_platform: detectBookingPlatform(profile.externalUrl, profile.biography),
      email,
      phone,
      is_business: typeof profile.isBusinessAccount === "boolean" ? profile.isBusinessAccount : null,
      verified: typeof profile.verified === "boolean" ? profile.verified : null,
      has_website: !sansSite,
      profile_pic_url: typeof profile.profilePicUrl === "string" ? profile.profilePicUrl : null,
      raw: profile,
      // Trace l'origine : ces prospects-là ne viennent d'aucun hashtag, et on
      // voudra un jour savoir si la chasse à la main convertit mieux.
      hashtag_source: "chasse",
      last_post_at: lastPostAt,
      score,
      score_tier: tier,
      status: "todo",
    };

    const { data, error } = await supabase
      .from("instagram_prospects")
      .insert(row)
      .select("id, username, metier, ville, followers, score, score_tier, has_website")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, created: true, prospect: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
