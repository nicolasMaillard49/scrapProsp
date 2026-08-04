import { NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
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
/** Fenêtre pendant laquelle « il regarde sa maquette » vaut encore un message. */
const WATCHING_MIN = 30;

/**
 * Qui a ouvert sa maquette récemment.
 *
 * C'est le signal le plus fort du tunnel : un prospect sur SA page, à cet
 * instant, est un prospect qui pense à toi. Trente minutes plus tard, ce n'est
 * plus qu'une statistique — d'où la fenêtre courte.
 */
async function watching(): Promise<Array<{ username: string; at: string; seconds: number }>> {
  const since = new Date(Date.now() - WATCHING_MIN * 60_000).toISOString();
  const { data, error } = await supabase
    .from("ig_demo_views")
    .select("created_at, duration_seconds, instagram_prospects(username)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return []; // table absente (migration 025 pas jouée) : rien à dire
  const seen = new Set<string>();
  const out: Array<{ username: string; at: string; seconds: number }> = [];
  for (const r of (data ?? []) as unknown as Array<{
    created_at: string;
    duration_seconds: number | null;
    instagram_prospects: { username: string } | { username: string }[] | null;
  }>) {
    const rel = Array.isArray(r.instagram_prospects) ? r.instagram_prospects[0] : r.instagram_prospects;
    const username = rel?.username;
    if (!username || seen.has(username)) continue; // une ligne par prospect, la plus récente
    seen.add(username);
    out.push({ username, at: r.created_at, seconds: r.duration_seconds ?? 0 });
  }
  return out;
}

export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  try {
    const sel = await ensureDailySelection();
    const open = sel.rows.filter((r) => !r.done_at && !r.skipped_at);
    return NextResponse.json({
      remaining: open.length,
      total: sel.rows.length,
      watching: await watching(),
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
