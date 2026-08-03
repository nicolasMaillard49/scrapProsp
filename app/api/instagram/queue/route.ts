import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { ensureDailySelection } from "@/app/lib/igSelection";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/queue
 * File de prospection du jour, réduite à ce dont l'extension a besoin :
 * qui contacter ensuite, et combien il en reste.
 *
 * Route dédiée plutôt que d'ouvrir /api/instagram/selection à l'extension :
 * cette dernière porte aussi un POST qui déclenche un refill Apify (donc une
 * dépense). Un secret statique n'a rien à faire devant ce bouton.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  try {
    const sel = await ensureDailySelection();
    const open = sel.rows.filter((r) => !r.done_at && !r.skipped_at);
    return NextResponse.json({
      remaining: open.length,
      total: sel.rows.length,
      next: open.slice(0, 5).map((r) => {
        const p = r.prospect as Record<string, unknown>;
        return {
          username: String(p.username ?? ""),
          fullName: (p.full_name as string | null) ?? null,
          metier: (p.metier as string | null) ?? null,
          ville: (p.ville as string | null) ?? null,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
