import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["todo", "contacted", "positive", "negative"] as const;

/** PATCH /api/instagram/[id]  { status?, notes? } — met à jour un lead Instagram. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { status?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const patch: { status?: string; notes?: string } = {};
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "rien à mettre à jour" }, { status: 400 });

  const { data, error } = await supabase
    .from("instagram_prospects")
    .update(patch)
    .eq("id", id)
    .select("id, status, notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prospect: data });
}
