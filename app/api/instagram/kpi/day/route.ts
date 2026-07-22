import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

/** Bornes ISO d'un jour civil Europe/Paris (gère l'offset été/hiver). */
function parisDayBounds(date: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // Offset réel de Paris ce jour-là, déduit à midi UTC (jamais ambigu).
  const noon = new Date(`${date}T12:00:00Z`);
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(noon).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const off = tz.replace("GMT", "") || "+00:00";
  const start = new Date(`${date}T00:00:00${off}`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

interface LogRow { prospect_id: string | null; account_id: string | null; step: string; sent_at: string }
interface ReplyRow { prospect_id: string | null; kind: string; received_at: string; excerpt: string | null }

/**
 * GET /api/instagram/kpi/day?date=YYYY-MM-DD — le détail nominatif d'UNE journée :
 * quel compte a reçu quelle étape, à quelle heure, avec quel compte émetteur, et
 * qui a répondu quoi. C'est ce qui se déplie sous une ligne du détail quotidien.
 *
 * PROTÉGÉ par le middleware (pseudos) — ne jamais ajouter à l'allow-list.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const bounds = parisDayBounds(req.nextUrl.searchParams.get("date") ?? "");
  if (!bounds) return NextResponse.json({ error: "date requise au format YYYY-MM-DD" }, { status: 400 });
  const { start, end } = bounds;

  const [{ data: logs, error: e1 }, { data: accounts, error: e2 }, { data: replies }] = await Promise.all([
    supabase
      .from("ig_dm_log")
      .select("prospect_id, account_id, step, sent_at")
      .gte("sent_at", start).lt("sent_at", end)
      .order("sent_at", { ascending: true })
      .limit(5_000),
    supabase.from("ig_accounts").select("id, username"),
    supabase
      .from("ig_replies")
      .select("prospect_id, kind, received_at, excerpt")
      .gte("received_at", start).lt("received_at", end)
      .order("received_at", { ascending: true })
      .limit(5_000),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  const senders = new Map((accounts ?? []).map((a) => [a.id as string, a.username as string]));
  const logRows = (logs ?? []) as LogRow[];
  const replyRows = (replies ?? []) as ReplyRow[];

  const ids = [...new Set([...logRows, ...replyRows].map((r) => r.prospect_id).filter((x): x is string => !!x))];
  if (ids.length === 0) return NextResponse.json({ date: req.nextUrl.searchParams.get("date"), prospects: [] });

  const profiles: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase
      .from("instagram_prospects")
      .select("id, username, full_name, metier, ville, followers, status, stage, score, score_tier")
      .in("id", ids.slice(i, i + 300));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profiles.push(...(data ?? []));
  }
  const byId = new Map(profiles.map((p) => [p.id as string, p]));

  const map = new Map<string, {
    username: string; full_name: string | null; metier: string | null; ville: string | null;
    followers: number | null; status: string; stage: string | null; score: number | null; score_tier: string | null;
    emetteur: string | null;
    steps: { step: string; at: string }[];
    replies: { kind: string; at: string; excerpt: string | null }[];
  }>();

  const ensure = (pid: string) => {
    if (!map.has(pid)) {
      const p = byId.get(pid);
      map.set(pid, {
        username: (p?.username as string) ?? "(prospect supprimé)",
        full_name: (p?.full_name as string | null) ?? null,
        metier: (p?.metier as string | null) ?? null,
        ville: (p?.ville as string | null) ?? null,
        followers: (p?.followers as number | null) ?? null,
        status: (p?.status as string) ?? "?",
        stage: (p?.stage as string | null) ?? null,
        score: (p?.score as number | null) ?? null,
        score_tier: (p?.score_tier as string | null) ?? null,
        emetteur: null, steps: [], replies: [],
      });
    }
    return map.get(pid)!;
  };

  for (const r of logRows) {
    if (!r.prospect_id) continue;
    const e = ensure(r.prospect_id);
    e.steps.push({ step: r.step, at: r.sent_at });
    e.emetteur = senders.get(r.account_id ?? "") ?? e.emetteur;
  }
  for (const r of replyRows) {
    if (!r.prospect_id) continue;
    ensure(r.prospect_id).replies.push({ kind: r.kind, at: r.received_at, excerpt: r.excerpt });
  }

  const prospects = [...map.values()].sort((a, b) => {
    const sa = a.steps[0]?.at ?? a.replies[0]?.at ?? "";
    const sb = b.steps[0]?.at ?? b.replies[0]?.at ?? "";
    return sa.localeCompare(sb);
  });

  return NextResponse.json({ date: req.nextUrl.searchParams.get("date"), prospects });
}
