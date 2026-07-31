import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { sendTelegram } from "@/app/lib/notify";
import { warmupCaps, stageForStep, nextFollowup, VALID_STEPS, type AccountStatus } from "@/app/lib/igPipeline";
import { parisDayStart } from "@/app/lib/igCockpit";
import { markSelectionDone } from "@/app/lib/igSelection";

export const dynamic = "force-dynamic";

interface Body {
  prospect_id?: string;
  account_id?: string;
  step?: string;
}

/**
 * POST /api/instagram/dm  { prospect_id, account_id, step }
 * Marque un message de la séquence comme ENVOYÉ (par un humain) :
 * vérifie le quota jour du compte (jour Paris, plan de chauffe — limite par JOUR, pas par heure),
 * journalise, avance le stade du prospect, programme la relance par défaut (+48 h),
 * et alerte sur Telegram à l'approche / à l'atteinte du plafond jour.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const { prospect_id, account_id } = body;
  const step = (body.step ?? "").toUpperCase();
  if (!prospect_id || !account_id) return NextResponse.json({ error: "prospect_id et account_id requis" }, { status: 400 });
  if (!VALID_STEPS.has(step)) return NextResponse.json({ error: `étape invalide (${step})` }, { status: 400 });

  // Compte + plafonds du jour.
  const { data: account, error: accErr } = await supabase
    .from("ig_accounts")
    .select("id, username, status, started_at")
    .eq("id", account_id)
    .single();
  if (accErr || !account) return NextResponse.json({ error: "compte émetteur introuvable" }, { status: 404 });

  const now = new Date();
  const caps = warmupCaps(account.started_at as string, account.status as AccountStatus, now.getTime());
  if (caps.daily === 0) {
    return NextResponse.json({ error: `@${account.username} est en pause — aucun envoi autorisé.` }, { status: 429 });
  }

  // Compteur du jour (jour Paris).
  const dayStart = parisDayStart(now).toISOString();
  const { count: sentDay } = await supabase
    .from("ig_dm_log")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account_id)
    .gte("sent_at", dayStart);
  const day = sentDay ?? 0;

  if (day >= caps.daily) {
    void sendTelegram(`🚫 <b>@${account.username}</b> : plafond JOUR atteint (${day}/${caps.daily}) — stop jusqu'à demain 8 h.`);
    return NextResponse.json(
      { error: `Plafond jour atteint pour @${account.username} (${day}/${caps.daily}). Reprise demain.`, counters: { day, caps } },
      { status: 429 },
    );
  }

  // Prospect (pour followup_count + statut actuel).
  const { data: prospect, error: prosErr } = await supabase
    .from("instagram_prospects")
    .select("id, username, status, stage, followup_count")
    .eq("id", prospect_id)
    .single();
  if (prosErr || !prospect) return NextResponse.json({ error: "prospect introuvable" }, { status: 404 });

  // Journalise l'envoi.
  const { error: logErr } = await supabase
    .from("ig_dm_log")
    .insert({ prospect_id, account_id, step, sent_at: now.toISOString() });
  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

  // Avance le prospect.
  const isRelance = step.startsWith("R");
  const newStage = stageForStep(step) ?? (prospect.stage as string | null);
  const followupCount = isRelance ? ((prospect.followup_count as number) ?? 0) + 1 : 0;
  const patch: Record<string, unknown> = {
    contacted_by: account_id,
    last_dm_at: now.toISOString(),
    stage: newStage,
    followup_count: followupCount,
    // Relance par défaut : +48 h sans nouvelle (le bouton « Vu sans réponse » resserre à +1 h).
    // null passé R1 : le prospect sort de la file de relance.
    next_followup_at: nextFollowup(now, followupCount, false)?.toISOString() ?? null,
  };
  if (prospect.status === "todo") patch.status = "contacted";

  const { data: updated, error: upErr } = await supabase
    .from("instagram_prospects")
    .update(patch)
    .eq("id", prospect_id)
    .select("id, status, stage, followup_count, next_followup_at, last_dm_at, contacted_by")
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // L'accroche vide la ligne correspondante de la sélection du jour : la liste
  // se solde toute seule au fil des envois, sans clic supplémentaire.
  if (step === "M1") await markSelectionDone(prospect_id, now);

  // Alertes Telegram au franchissement des seuils (80 % puis 100 % du plafond jour).
  const newDay = day + 1;
  const warnAt = Math.ceil(caps.daily * 0.8);
  if (newDay === caps.daily) {
    void sendTelegram(`🚫 <b>@${account.username}</b> : plafond JOUR atteint (${newDay}/${caps.daily}). On arrête d'envoyer jusqu'à demain.`);
  } else if (newDay === warnAt) {
    void sendTelegram(`⚠️ <b>@${account.username}</b> approche du plafond jour : ${newDay}/${caps.daily}.`);
  }

  return NextResponse.json({
    ok: true,
    prospect: updated,
    counters: { day: newDay, caps },
  });
}
