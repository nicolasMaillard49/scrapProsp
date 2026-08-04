import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { sendTelegram } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

/** Anti-spam Telegram : une notification par prospect et par fenêtre. */
const NOTIFY_COOLDOWN_MIN = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/instagram/demo-view  { id, session, event, seconds? }
 *
 * Tracking des maquettes Instagram (/di/<code>). Appelé depuis le navigateur
 * DU PROSPECT — donc route publique, et donc volontairement muette : elle
 * répond `ok` à peu près quoi qu'il arrive, ne dit jamais si l'identifiant
 * existe, et n'expose rien.
 *
 * Pourquoi : « il a ouvert sa maquette il y a 4 minutes et il est encore
 * dessus » est le signal le plus fort du tunnel. Sans lui, on envoie un
 * aperçu et on ne sait jamais s'il a été regardé.
 *
 * Jumeau de /api/demo/track, sur `ig_demo_views` : `demo_views` porte une clé
 * étrangère vers `prospects` (pipeline Maps), pas vers `instagram_prospects`.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ ok: true });

  let body: { id?: string; session?: string; event?: string; seconds?: number };
  try {
    body = JSON.parse(await req.text()); // sendBeacon envoie du text/plain
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { id, session, event, seconds } = body;
  if (!id || !UUID_RE.test(id) || !session || typeof session !== "string") {
    return NextResponse.json({ ok: true });
  }
  const sid = session.slice(0, 64);

  if (event === "heartbeat") {
    await supabase
      .from("ig_demo_views")
      .update({ duration_seconds: Math.max(0, Math.round(seconds ?? 0)), updated_at: new Date().toISOString() })
      .eq("session_id", sid);
    return NextResponse.json({ ok: true });
  }

  const { data: p } = await supabase
    .from("instagram_prospects")
    .select("id, username, full_name, metier, ville, demo_first_viewed_at")
    .eq("id", id)
    .maybeSingle();
  if (!p) return NextResponse.json({ ok: true });

  const { data: last } = await supabase
    .from("ig_demo_views")
    .select("created_at")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const { count } = await supabase
    .from("ig_demo_views")
    .select("id", { count: "exact", head: true })
    .eq("prospect_id", id);

  const now = new Date().toISOString();
  await supabase.from("ig_demo_views").insert({
    prospect_id: id,
    session_id: sid,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  await supabase
    .from("instagram_prospects")
    .update({
      demo_last_viewed_at: now,
      ...(p.demo_first_viewed_at ? {} : { demo_first_viewed_at: now }),
    })
    .eq("id", id);

  const lastAt = last?.[0]?.created_at ? new Date(last[0].created_at).getTime() : 0;
  if (Date.now() - lastAt >= NOTIFY_COOLDOWN_MIN * 60_000) {
    const visite = (count ?? 0) + 1;
    const heat = visite >= 3 ? " 🔥🔥" : visite === 2 ? " 🔥" : "";
    const qui = [p.full_name || `@${p.username}`, p.metier, p.ville].filter(Boolean).join(" · ");
    void sendTelegram(
      `👀${heat} <b>@${p.username}</b> regarde sa maquette — visite n°${visite}.\n${qui}\nÉcris-lui pendant qu'il est dessus.`,
    );
  }

  return NextResponse.json({ ok: true });
}
