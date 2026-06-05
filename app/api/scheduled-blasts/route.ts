import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { data, error } = await supabase
    .from("scheduled_blasts")
    .select("id, scheduled_at, limit_count, status, result, created_at, executed_at")
    .order("scheduled_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blasts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  let body: { scheduledAt?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const limit = Number(body.limit);
  const at = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!Number.isInteger(limit) || limit <= 0) {
    return NextResponse.json({ error: "Nombre de prospects invalide" }, { status: 400 });
  }
  if (!at || Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Date/heure invalide" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("scheduled_blasts")
    .insert({ scheduled_at: at.toISOString(), limit_count: limit, status: "pending" })
    .select("id, scheduled_at, limit_count, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blast: data });
}
