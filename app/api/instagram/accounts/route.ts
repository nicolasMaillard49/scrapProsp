import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { getAccountsWithCounters, getDueFollowups, getFunnelCounts } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

/** GET /api/instagram/accounts — comptes + compteurs + relances dues + funnel. */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  try {
    const now = new Date();
    const [accounts, due, funnel] = await Promise.all([
      getAccountsWithCounters(now),
      getDueFollowups(now),
      getFunnelCounts(),
    ]);
    return NextResponse.json({ accounts, due, funnel });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** POST /api/instagram/accounts  { username, started_at? } — ajoute un compte émetteur. */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  let body: { username?: string; started_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const username = (body.username ?? "").replace(/^@/, "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "username requis" }, { status: 400 });
  const started_at = body.started_at && /^\d{4}-\d{2}-\d{2}$/.test(body.started_at) ? body.started_at : undefined;

  const { data, error } = await supabase
    .from("ig_accounts")
    .insert({ username, ...(started_at ? { started_at } : {}) })
    .select("id, username, status, started_at, notes")
    .single();
  if (error) {
    const conflict = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ error: conflict ? "Ce compte existe déjà." : error.message }, { status: conflict ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, account: data });
}
