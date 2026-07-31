import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { qualifyAvailable, type QualifyAvatar } from "@/app/lib/igQualify";
import { qualifyRun } from "@/app/lib/igQualifyRun";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // plusieurs lots Claude en série

interface Body {
  metier?: string;
  hashtag?: string;
  onlyUnqualified?: boolean;
  avatar?: Partial<QualifyAvatar>;
  limit?: number;
}

/**
 * POST /api/instagram/qualify
 * Qualification IA des prospects Instagram par lots de 40. Le moteur vit dans
 * `app/lib/igQualifyRun.ts` (partagé avec le refill automatique de la sélection
 * du jour) ; cette route n'est que la façade HTTP.
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

  try {
    const out = await qualifyRun({
      avatar: {
        profession,
        minFollowers: typeof body.avatar?.minFollowers === "number" ? body.avatar.minFollowers : 0,
        maxFollowers: typeof body.avatar?.maxFollowers === "number" ? body.avatar.maxFollowers : 2500,
        extra: typeof body.avatar?.extra === "string" ? body.avatar.extra : undefined,
      },
      metier: body.metier,
      hashtag: body.hashtag,
      onlyUnqualified: body.onlyUnqualified,
      limit: body.limit,
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
