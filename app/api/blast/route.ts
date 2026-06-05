import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { runBlast, BlastError } from "@/app/lib/blast";

function demoBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  return env ? env.replace(/\/$/, "") : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: { limit?: number; offset?: number; dryRun?: boolean; force?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    const r = await runBlast({
      limit: typeof body.limit === "number" ? body.limit : null,
      offset: typeof body.offset === "number" ? body.offset : 0,
      dryRun: body.dryRun === true,
      force: body.force === true,
      base: demoBase(req),
    });
    return NextResponse.json({ dryRun: body.dryRun === true, ...r, results: r.results.slice(0, 5) });
  } catch (e) {
    if (e instanceof BlastError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "OUT_OF_WINDOW" ? 423 : 503 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
