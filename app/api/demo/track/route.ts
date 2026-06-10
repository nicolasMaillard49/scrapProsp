import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { sendTelegram } from "@/app/lib/notify";
import { metierLabel } from "@/app/maquette/templates/data";

export const dynamic = "force-dynamic";

/** Durée de vie d'une démo après sa première ouverture (countdown FOMO). */
const EXPIRY_DAYS = 7;
/** Anti-spam Telegram : pas plus d'une notif de vue par prospect par fenêtre. */
const NOTIFY_COOLDOWN_MIN = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface NotifProspect {
  id: string;
  name: string;
  ville: string | null;
  metier: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number | null;
}

/** Bloc d'infos commun aux notifs Telegram (métier, ville, note, tél cliquable, lien démo). */
function prospectBlock(p: NotifProspect): string {
  const base = (process.env.NEXT_PUBLIC_DEMO_BASE_URL ?? "https://prospects.nmf-agence.com").replace(/\/$/, "");
  const lines = [
    `🛠 ${metierLabel(p.metier ?? "")}${p.ville ? ` · ${p.ville}` : ""}${p.rating != null ? ` · ⭐ ${p.rating} (${p.reviews ?? 0} avis)` : ""}`,
  ];
  if (p.phone) lines.push(`📞 ${p.phone.replace(/\s/g, "")}`);
  lines.push(`🔗 ${base}/d/${p.id.slice(0, 8)}`);
  return lines.join("\n");
}

/**
 * Tracking d'engagement des démos publiques.
 * Appelé par DemoLive (fetch + navigator.sendBeacon, d'où le parse via text()).
 *  - view      : nouvelle session de visite -> notif Telegram + démarrage du chrono d'expiration
 *  - heartbeat : met à jour la durée de la session
 *  - cta       : clic sur « Je le veux » -> notif Telegram
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: { id?: string; session?: string; event?: string; seconds?: number };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { id, session, event, seconds } = body;
  if (!id || !UUID_RE.test(id) || !session || typeof session !== "string") {
    return NextResponse.json({ error: "id/session manquant" }, { status: 400 });
  }

  if (event === "heartbeat") {
    await supabase
      .from("demo_views")
      .update({ duration_seconds: Math.max(0, Math.round(seconds ?? 0)) })
      .eq("session_id", session.slice(0, 64));
    return NextResponse.json({ ok: true });
  }

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, name, ville, metier, phone, rating, reviews, demo_first_viewed_at, demo_expires_at")
    .eq("id", id)
    .single();
  if (!prospect) return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });

  if (event === "cta") {
    await supabase.from("demo_views").insert({
      prospect_id: id,
      session_id: `${session.slice(0, 64)}:cta`,
      event: "cta_click",
    });
    await sendTelegram(
      `🚀💰 <b>${prospect.name}</b> vient de cliquer « <b>Je le veux</b> » sur sa démo !\n${prospectBlock(prospect)}\nC'est le moment d'appeler.`,
    );
    return NextResponse.json({ ok: true });
  }

  // event === "view"
  const { data: lastView } = await supabase
    .from("demo_views")
    .select("created_at")
    .eq("prospect_id", id)
    .eq("event", "view")
    .order("created_at", { ascending: false })
    .limit(1);
  const { count } = await supabase
    .from("demo_views")
    .select("id", { count: "exact", head: true })
    .eq("prospect_id", id)
    .eq("event", "view");

  await supabase.from("demo_views").insert({
    prospect_id: id,
    session_id: session.slice(0, 64),
    event: "view",
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });

  // Première ouverture -> le chrono d'expiration démarre maintenant.
  let expiresAt = prospect.demo_expires_at as string | null;
  if (!prospect.demo_first_viewed_at) {
    const now = new Date();
    expiresAt = expiresAt ?? new Date(now.getTime() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString();
    await supabase
      .from("prospects")
      .update({ demo_first_viewed_at: now.toISOString(), demo_expires_at: expiresAt })
      .eq("id", id);
  }

  const lastViewAt = lastView?.[0]?.created_at ? new Date(lastView[0].created_at).getTime() : 0;
  const coolingDown = Date.now() - lastViewAt < NOTIFY_COOLDOWN_MIN * 60_000;
  if (!coolingDown) {
    const visite = (count ?? 0) + 1;
    const heat = visite >= 3 ? " 🔥🔥" : visite === 2 ? " 🔥" : "";
    await sendTelegram(
      `👀${heat} <b>${prospect.name}</b> regarde sa démo — visite n°${visite}.\n${prospectBlock(prospect)}\nAppelle-le pendant qu'il est dessus !`,
    );
  }

  return NextResponse.json({ ok: true, expiresAt });
}
