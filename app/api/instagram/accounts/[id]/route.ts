import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["warmup", "chaud", "pause"] as const;

/** PATCH /api/instagram/accounts/[id]  { status?, notes? } — met à jour un compte émetteur. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;

  let body: { status?: string; notes?: string };
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
  if (!Object.keys(patch).length) return NextResponse.json({ error: "rien à mettre à jour" }, { status: 400 });

  const { data, error } = await supabase
    .from("ig_accounts")
    .update(patch)
    .eq("id", id)
    .select("id, username, status, started_at, notes")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, account: data });
}

/** DELETE /api/instagram/accounts/[id] — retire un compte émetteur. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const { error } = await supabase.from("ig_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
