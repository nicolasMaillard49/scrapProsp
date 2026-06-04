import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { classifyReply, aiAvailable, type Sentiment } from "@/app/lib/classify";

/**
 * POST /api/sms/classify  { limit?: number }
 * Classe les réponses entrantes encore non classées (sentiment IS NULL) via
 * Claude Haiku (repli mots-clés sans clé). Un 'negative' fait passer le
 * prospect en statut 'negative' (exclus). Lazy : déclenché depuis la section /sms.
 * Protégé par la middleware (cookie prospects-auth).
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  }

  let body: { limit?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit = typeof body.limit === "number" ? Math.min(body.limit, 200) : 100;

  const { data, error } = await supabase
    .from("sms_messages")
    .select("id, prospect_id, body")
    .eq("direction", "inbound")
    .is("sentiment", null)
    .order("sent_at", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = data ?? [];
  const counts: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0 };

  for (const row of pending) {
    const sentiment = await classifyReply(row.body ?? "");
    counts[sentiment]++;

    await supabase
      .from("sms_messages")
      .update({ sentiment, sentiment_source: "ai" })
      .eq("id", row.id);

    // Un négatif exclut le prospect (s'il est rattaché).
    if (sentiment === "negative" && row.prospect_id) {
      await supabase.from("prospects").update({ status: "negative" }).eq("id", row.prospect_id);
    }
  }

  return NextResponse.json({
    ai: aiAvailable(),
    classified: pending.length,
    ...counts,
  });
}
