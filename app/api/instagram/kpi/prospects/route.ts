import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 3600_000;

interface LogRow {
  prospect_id: string | null;
  account_id: string | null;
  step: string;
  sent_at: string;
}

/** Découpe un `.in()` trop long en requêtes de taille raisonnable. */
async function fetchProspects(ids: string[]) {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase
      .from("instagram_prospects")
      .select("id, username, full_name, metier, ville, followers, status, stage, followup_count, next_followup_at")
      .in("id", ids.slice(i, i + 300));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

/**
 * GET /api/instagram/kpi/prospects?days=N — le détail nominatif derrière les KPI :
 * un objet par compte Instagram démarché sur la période, avec sa séquence réelle
 * (M1-M9 / R1-R3), le compte émetteur, et s'il a répondu.
 *
 * PROTÉGÉ par le middleware (contrairement à /api/instagram/kpi qui est public
 * pour l'Apps Script) : ici il y a des pseudos, donc du nominatif.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const days = Math.min(180, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const [{ data: logs, error: e1 }, { data: accounts, error: e2 }, { data: replies, error: e3 }] = await Promise.all([
    supabase
      .from("ig_dm_log")
      .select("prospect_id, account_id, step, sent_at")
      .gte("sent_at", since)
      .order("sent_at", { ascending: true })
      .limit(20_000),
    supabase.from("ig_accounts").select("id, username"),
    // Journal des réponses entrantes (migration 018). Absent → repli sur le M2.
    supabase
      .from("ig_replies")
      .select("prospect_id, kind, received_at")
      .order("received_at", { ascending: true })
      .limit(20_000),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  const senders = new Map((accounts ?? []).map((a) => [a.id as string, a.username as string]));

  // 1re réponse humaine journalisée + dernier genre connu, par prospect.
  const firstReply = new Map<string, string>();
  const lastKind = new Map<string, string>();
  for (const r of (e3 ? [] : (replies ?? [])) as { prospect_id: string | null; kind: string; received_at: string }[]) {
    if (!r.prospect_id) continue;
    lastKind.set(r.prospect_id, r.kind);
    if (r.kind !== "autorepondeur" && !firstReply.has(r.prospect_id)) firstReply.set(r.prospect_id, r.received_at);
  }

  // Regroupe le journal par prospect.
  const byProspect = new Map<string, LogRow[]>();
  for (const r of (logs ?? []) as LogRow[]) {
    if (!r.prospect_id) continue;
    const list = byProspect.get(r.prospect_id);
    if (list) list.push(r);
    else byProspect.set(r.prospect_id, [r]);
  }
  const ids = [...byProspect.keys()];
  if (ids.length === 0) return NextResponse.json({ prospects: [] });

  let profiles: Record<string, unknown>[];
  try {
    profiles = await fetchProspects(ids);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
  const byId = new Map(profiles.map((p) => [p.id as string, p]));

  const prospects = ids
    .map((id) => {
      const rows = byProspect.get(id)!; // déjà triés par sent_at croissant
      const p = byId.get(id);
      if (!p) return null; // prospect supprimé depuis
      const steps = rows.map((r) => r.step);
      const relances = steps.filter((s) => s.startsWith("R"));
      // La séquence se lit sur les seules étapes de trame : une relance n'est pas
      // une progression, et elle a déjà sa colonne. Repli sur le brut si la fenêtre
      // ne contient que des relances (M1 antérieur à la période).
      const msgs = steps.filter((s) => !s.startsWith("R"));
      // Un M2 n'est jamais envoyé sans réponse préalable → il date la réponse.
      const m2 = rows.find((r) => r.step === "M2");
      return {
        id,
        username: p.username as string,
        full_name: (p.full_name as string | null) ?? null,
        metier: (p.metier as string | null) ?? null,
        ville: (p.ville as string | null) ?? null,
        followers: (p.followers as number | null) ?? null,
        status: p.status as string,
        stage: (p.stage as string | null) ?? null,
        emetteur: senders.get(rows[rows.length - 1].account_id ?? "") ?? null,
        first_dm_at: rows[0].sent_at,
        last_dm_at: rows[rows.length - 1].sent_at,
        first_step: msgs[0] ?? steps[0],
        last_step: msgs[msgs.length - 1] ?? steps[steps.length - 1],
        messages: msgs.length,
        relances: relances.length,
        next_followup_at: (p.next_followup_at as string | null) ?? null,
        // Vraie réponse si elle est journalisée, sinon repli sur le M2 (prospects
        // antérieurs à la migration 018). `reply_source` dit lequel des deux.
        replied_at: firstReply.get(id) ?? m2?.sent_at ?? null,
        reply_kind: lastKind.get(id) ?? null,
        reply_source: firstReply.has(id) ? "log" : m2 ? "m2" : null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.last_dm_at.localeCompare(a.last_dm_at));

  return NextResponse.json({ prospects });
}
