import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { nextFollowup, STAGES, type Stage } from "@/app/lib/igPipeline";

export const dynamic = "force-dynamic";

const STATUSES = ["todo", "contacted", "positive", "negative"] as const;

/**
 * PATCH /api/instagram/[id]  { status?, notes?, seen?, stage? }
 * - status/notes : inchangé (statuts historiques).
 * - seen: true   : « vu sans réponse » → programme la relance R suivante (+1 h/+7 h/+6 h, fenêtre 8-20 h).
 * - stage        : transition manuelle du pipeline (repondu → call_booke / perdu…).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { status?: string; notes?: string; seen?: boolean; stage?: string; ville?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.notes === "string") patch.notes = body.notes;
  // Ville saisie à la main (prospect sans ville détectée) → débloque le rapport concurrentiel.
  if (typeof body.ville === "string" && body.ville.trim()) patch.ville = body.ville.trim();

  if (typeof body.stage === "string") {
    if (!STAGES.includes(body.stage as Stage)) {
      return NextResponse.json({ error: "stage invalide" }, { status: 400 });
    }
    patch.stage = body.stage;
    // Cohérence statut ↔ stade : booké = positif, perdu = négatif, et on coupe les relances.
    if (body.stage === "call_booke") {
      patch.status = "positive";
      patch.next_followup_at = null;
    }
    if (body.stage === "perdu") {
      patch.status = "negative";
      patch.next_followup_at = null;
    }
  }

  if (body.seen === true) {
    // « Vu sans réponse » : la relance se cale sur le compteur actuel (R1 +1 h, R2 +7 h…).
    const { data: cur } = await supabase
      .from("instagram_prospects")
      .select("followup_count")
      .eq("id", id)
      .single();
    const count = (cur?.followup_count as number | undefined) ?? 0;
    patch.next_followup_at = nextFollowup(new Date(), count, true).toISOString();
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "rien à mettre à jour" }, { status: 400 });

  const { data, error } = await supabase
    .from("instagram_prospects")
    .update(patch)
    .eq("id", id)
    .select("id, status, notes, stage, followup_count, next_followup_at, ville")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prospect: data });
}
