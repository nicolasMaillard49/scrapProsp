import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { nextFollowup, type Stage } from "@/app/lib/igPipeline";
import { stagePatch, parseStage, closesDayLine, closeDayLine } from "@/app/lib/igStage";

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

  let stage: Stage | null = null;
  if (typeof body.stage === "string") {
    stage = parseStage(body.stage);
    if (!stage) return NextResponse.json({ error: "stage invalide" }, { status: 400 });
    // La cohérence stade ↔ statut ↔ relances vit dans igStage, seul écrivain.
    Object.assign(patch, stagePatch(stage));
  }

  if (body.seen === true) {
    // « Vu sans réponse » : resserre R1 à +1 h ; null si R1 est déjà passée (plus de relance).
    const { data: cur } = await supabase
      .from("instagram_prospects")
      .select("followup_count")
      .eq("id", id)
      .single();
    const count = (cur?.followup_count as number | undefined) ?? 0;
    patch.next_followup_at = nextFollowup(new Date(), count, true)?.toISOString() ?? null;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "rien à mettre à jour" }, { status: 400 });

  const { data, error } = await supabase
    .from("instagram_prospects")
    .update(patch)
    .eq("id", id)
    .select("id, status, notes, stage, followup_count, next_followup_at, ville")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Un prospect passé « perdu » depuis le pipeline sort aussi de la journée —
  // sinon il resterait proposé ce soir alors qu'on vient de le condamner.
  if (stage && closesDayLine(stage)) await closeDayLine(id);

  return NextResponse.json({ ok: true, prospect: data });
}

/**
 * DELETE /api/instagram/[id] — supprime définitivement un prospect non pertinent.
 * On retire d'abord ses lignes ig_dm_log (évite les contraintes de clé étrangère).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  await supabase.from("ig_dm_log").delete().eq("prospect_id", id);
  const { error } = await supabase.from("instagram_prospects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
