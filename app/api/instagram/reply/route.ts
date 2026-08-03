import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { logReply } from "@/app/lib/igReplyLog";

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

  const r = await logReply({
    prospect_id: body.prospect_id ?? "",
    kind: body.kind ?? "",
    account_id: body.account_id ?? null,
    received_at: body.received_at,
    excerpt: body.excerpt,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, reply: r.reply, prospect: r.prospect });
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
