import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { sendTelegram } from "@/app/lib/notify";
import { warmupCaps, stageForStep, nextFollowup, VALID_STEPS, isAccrocheStep, countsAgainstQuota, QUOTA_STEPS, type AccountStatus } from "@/app/lib/igPipeline";
import { creditSent } from "@/app/lib/igVariants";
import { parisDayStart } from "@/app/lib/igCockpit";
import { parisDayKey } from "@/app/lib/igDmLog";
import { markSelectionDone } from "@/app/lib/igSelection";

export const dynamic = "force-dynamic";

interface Body {
  prospect_id?: string;
  account_id?: string;
  step?: string;
  /** Variante d'accroche réellement envoyée (bandit, cf. igVariants). */
  variant?: string;
  /**
   * Journalisation d'un message DÉJÀ parti de la main de Nicolas (extension
   * Chrome). Le plafond ne peut alors plus servir de refus : le DM existe,
   * refuser de l'inscrire ne le fait pas disparaître, ça ne fait que fausser
   * les compteurs de chauffe et les stades. Le plafond garde tout son rôle de
   * frein pour la file AUTOMATIQUE (send-queue), qui ne passe jamais ce flag.
   */
  force?: boolean;
}

/**
 * POST /api/instagram/dm  { prospect_id, account_id, step, force? }
 * Marque un message de la séquence comme ENVOYÉ (par un humain) :
 * vérifie le quota jour du compte SI l'étape le consomme (accroche ou relance ;
 * jour Paris, plan de chauffe — limite par JOUR, pas par heure),
 * journalise, avance le stade du prospect, programme la relance par défaut (+48 h),
 * et alerte sur Telegram à l'approche / à l'atteinte du plafond jour.
 * `force: true` journalise malgré le plafond (message déjà envoyé à la main) —
 * l'alerte de dépassement part quand même.
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
  const force = body.force === true;
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

  // Répondre n'est pas envoyer. Une suite de conversation (M2-M9 / S2-S5) ne
  // consomme rien, ne peut donc rien dépasser, et ne doit rien bloquer : le
  // plafond et la pause ne valent que pour ce qui part à froid (cf.
  // `countsAgainstQuota`). Sans cette porte, une journée de réponses saturait
  // la jauge et faisait refuser les vraies accroches.
  const quota = countsAgainstQuota(step);

  if (caps.daily === 0 && !force && quota) {
    return NextResponse.json({ error: `@${account.username} est en pause — aucun envoi autorisé.` }, { status: 429 });
  }

  // Compteur du jour (jour Paris) — accroches + relances uniquement.
  const dayStart = parisDayStart(now).toISOString();
  const { count: sentDay } = await supabase
    .from("ig_dm_log")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account_id)
    .in("step", QUOTA_STEPS)
    .gte("sent_at", dayStart);
  const day = sentDay ?? 0;

  const overCap = quota && day >= caps.daily;
  if (overCap && !force) {
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

  // Journalise l'envoi — UNE SEULE FOIS par (prospect, étape, jour Paris).
  //
  // Trois chemins mènent ici pour un même message : la détection d'envoi après
  // « Insérer », l'auto-détection du champ vidé, et le bouton « Envoyé » du
  // panneau. Ils peuvent se déclencher ensemble, à la milliseconde près. Le
  // garde-fou de l'extension ne suffit pas — il lit son cache AVANT l'appel
  // réseau et l'écrit APRÈS, donc deux détections simultanées le franchissent
  // toutes les deux. Et une vérification « la ligne existe-t-elle ? » ici ne
  // suffirait pas davantage : deux requêtes concurrentes liraient « non » en
  // même temps. Seule la contrainte d'unicité tranche (migration 027).
  //
  // Un doublon n'est pas une erreur à remonter : le message EST parti, il est
  // déjà journalisé. On sort en succès sans rien réavancer — refaire le patch
  // de stade repousserait la relance, et recréditer la variante fausserait le
  // bandit.
  const { error: logErr } = await supabase
    .from("ig_dm_log")
    .insert({ prospect_id, account_id, step, sent_at: now.toISOString(), sent_day: parisDayKey(now) });
  if (logErr) {
    if (logErr.code === "23505") {
      return NextResponse.json({ ok: true, deduped: true, prospect, counters: { day, caps, overCap } });
    }
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

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
  if (isAccrocheStep(step)) {
    await markSelectionDone(prospect_id, now);
    // Quelle formulation est partie : sans cette trace, une réponse arrivée
    // trois jours plus tard ne peut être créditée à aucune variante.
    const variant = (body.variant ?? "").trim();
    if (variant) {
      await supabase.from("instagram_prospects").update({ accroche_variant: variant }).eq("id", prospect_id);
      await creditSent(variant);
    }
  }

  // Alertes Telegram au franchissement des seuils (80 % puis 100 % du plafond jour).
  // Une suite de conversation ne fait pas bouger le compteur : aucun seuil ne
  // peut être franchi par une réponse.
  const newDay = quota ? day + 1 : day;
  if (quota) {
    const warnAt = Math.ceil(caps.daily * 0.8);
    if (newDay === caps.daily) {
      void sendTelegram(`🚫 <b>@${account.username}</b> : plafond JOUR atteint (${newDay}/${caps.daily}). On arrête d'envoyer jusqu'à demain.`);
    } else if (newDay === warnAt) {
      void sendTelegram(`⚠️ <b>@${account.username}</b> approche du plafond jour : ${newDay}/${caps.daily}.`);
    } else if (newDay === caps.daily + 1) {
      // Premier dépassement seulement : l'alerte informe, elle ne harcèle pas.
      void sendTelegram(`⚠️ <b>@${account.username}</b> : plafond DÉPASSÉ (${newDay}/${caps.daily}) — journalisé quand même (envoi manuel).`);
    }
  }

  return NextResponse.json({
    ok: true,
    prospect: updated,
    counters: { day: newDay, caps, overCap: newDay > caps.daily },
  });
}
