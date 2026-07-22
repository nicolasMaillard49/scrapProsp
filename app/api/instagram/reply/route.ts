import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { REPLY_KINDS, type ReplyKind } from "@/app/lib/igPipeline";

export const dynamic = "force-dynamic";

interface Body {
  prospect_id?: string;
  account_id?: string | null;
  kind?: string;
  received_at?: string;
  excerpt?: string;
}

/**
 * POST /api/instagram/reply  { prospect_id, kind, account_id?, received_at?, excerpt? }
 * Journalise une réponse ENTRANTE du prospect — la seule source fiable de « il a
 * répondu » (ig_dm_log ne connaît que le sortant).
 *
 * Effet de bord voulu : un prospect qui vient de répondre SORT de la file de
 * relance (`next_followup_at = null`). On lui doit une réponse, pas une relance.
 * Les autorépondeurs ne déclenchent pas cette sortie : personne n'a rien lu.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { prospect_id } = body;
  const kind = (body.kind ?? "").toLowerCase() as ReplyKind;
  if (!prospect_id) return NextResponse.json({ error: "prospect_id requis" }, { status: 400 });
  if (!REPLY_KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind invalide (${kind}) — attendu : ${REPLY_KINDS.join(", ")}` }, { status: 400 });
  }

  const receivedAt = body.received_at ? new Date(body.received_at) : new Date();
  if (Number.isNaN(receivedAt.getTime())) {
    return NextResponse.json({ error: "received_at invalide" }, { status: 400 });
  }

  const { data: prospect, error: prosErr } = await supabase
    .from("instagram_prospects")
    .select("id, username, status")
    .eq("id", prospect_id)
    .single();
  if (prosErr || !prospect) return NextResponse.json({ error: "prospect introuvable" }, { status: 404 });

  const { data: reply, error: insErr } = await supabase
    .from("ig_replies")
    .insert({
      prospect_id,
      account_id: body.account_id ?? null,
      kind,
      received_at: receivedAt.toISOString(),
      excerpt: body.excerpt?.slice(0, 500) ?? null,
    })
    .select("id, kind, received_at, excerpt")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Le trigger de la migration 018 a déjà recalculé reply_count / first_reply_at /
  // last_reply_at ; on ne touche ici qu'à ce qui relève de la décision métier.
  const patch: Record<string, unknown> = {};
  if (kind !== "autorepondeur") patch.next_followup_at = null;
  if (prospect.status === "todo") patch.status = "contacted";

  let updated = null;
  if (Object.keys(patch).length > 0) {
    const { data, error: upErr } = await supabase
      .from("instagram_prospects")
      .update(patch)
      .eq("id", prospect_id)
      .select("id, status, stage, next_followup_at, reply_count, first_reply_at, last_reply_at")
      .single();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    updated = data;
  } else {
    const { data } = await supabase
      .from("instagram_prospects")
      .select("id, status, stage, next_followup_at, reply_count, first_reply_at, last_reply_at")
      .eq("id", prospect_id)
      .single();
    updated = data;
  }

  return NextResponse.json({ ok: true, reply, prospect: updated });
}

/**
 * DELETE /api/instagram/reply?id=<uuid> — annule une réponse mal saisie.
 * Le trigger remet les compteurs d'aplomb tout seul.
 */
export async function DELETE(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await supabase.from("ig_replies").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
