import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildCompetitorReport } from "@/app/lib/igCompetitor";

export const dynamic = "force-dynamic";
// Le scrape Maps + les checks de tag peuvent prendre plusieurs dizaines de secondes.
export const maxDuration = 300;

/**
 * GET /api/instagram/[id]/competitors[?full=1]
 * Rapport concurrentiel du prospect IG : son classement Google Maps sur
 * « métier ville », ses concurrents, et qui fait des Google Ads.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  const { data: p, error } = await supabase
    .from("instagram_prospects")
    .select("id, username, full_name, metier, profession_ia, ville")
    .eq("id", id)
    .single();
  if (error || !p) return NextResponse.json({ error: "prospect introuvable" }, { status: 404 });

  const metier = (p.profession_ia || p.metier || "").trim();
  const ville = (p.ville || "").trim();
  if (!metier || !ville) {
    const manque = !metier && !ville ? "métier et ville" : !metier ? "métier" : "ville";
    return NextResponse.json({ error: `${manque} manquant sur ce prospect — impossible de le classer.` }, { status: 422 });
  }

  try {
    const full = req.nextUrl.searchParams.get("full") === "1";
    const report = await buildCompetitorReport(
      { metier, ville, fullName: p.full_name, username: p.username },
      { full },
    );
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
