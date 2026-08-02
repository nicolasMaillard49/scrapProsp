import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { ensureDailySelection, refillStock, countAvailableStock } from "@/app/lib/igSelection";
import { leadsStatus } from "@/app/lib/igLeads";
import { sendTelegram } from "@/app/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * /api/cron/ig-refill — UNE passe de refill, pilotable de l'extérieur.
 *
 * Pourquoi une route de plus alors que `ig-digest` sait déjà refiller : une
 * invocation Vercel meurt à 300 s, ce qui plafonne une passe à ~1 collecte +
 * ~37 profils résolus + 1 lot Claude. Pour pourvoir 49 créneaux il en faut 7 à
 * 10. Le cron du matin ne pouvait donc structurellement pas remplir la journée,
 * et le bouton « Aller en chercher » n'était que le rattrapage manuel de ce
 * plafond (constat du 01/08 : 33 qualifiés en stock pour 49 créneaux).
 *
 * Le VPS, lui, n'a pas de mur : `vps/ig-refill.mjs` rappelle cette route en
 * boucle jusqu'à ce que la sélection soit pleine. Chaque appel reste court et
 * autonome — une passe tuée en vol est rattrapée par la suivante, puisque le
 * refill commence toujours par qualifier ce qui traîne sans verdict.
 *
 * Auth : x-cron-secret == CRON_SECRET (cron VPS) ou Authorization: Bearer.
 * Paramètres :
 *   ?mode=status  — ne refille pas, renvoie seulement l'état (sonde de la boucle)
 *   ?notify=1     — poste l'état sur Telegram (dernier appel de la boucle)
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret &&
    (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
  if (!authorized) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const statusOnly = req.nextUrl.searchParams.get("mode") === "status";
  const notify = req.nextUrl.searchParams.get("notify") === "1";

  try {
    const refill = statusOnly ? null : await refillStock();
    const selection = await ensureDailySelection();
    const [stock, leads] = await Promise.all([countAvailableStock(), leadsStatus()]);

    const state = {
      day: selection.day,
      slots: selection.slots,
      selected: selection.rows.filter((r) => !r.skipped_at).length,
      shortfall: selection.shortfall,
      /** Qualifiés encore jamais servis — la réserve pour demain. */
      stock,
      /** Pistes collectées en attente de résolution (1 requête chacune). */
      pending: leads.pending,
      quota: leads.quota,
    };

    if (notify) {
      await sendTelegram(
        state.shortfall > 0
          ? `⚠️ <b>Refill IG incomplet</b>\n${state.selected}/${state.slots} créneaux pourvus — il manque ${state.shortfall}.\n` +
              `Réserve : ${state.stock} qualifié(s), ${state.pending} piste(s) en file.` +
              (state.quota ? `\nQuota ${state.quota.provider} : ${state.quota.remaining}/${state.quota.limit}.` : "") +
              (refill?.iaError ? `\n🚨 Qualification IA en panne : ${refill.iaError.slice(0, 200)}` : "")
          : `✅ <b>Sélection IG complète</b>\n${state.selected}/${state.slots} créneaux, ${state.stock} qualifié(s) d'avance.`,
      );
    }

    return NextResponse.json({
      ok: true,
      ...state,
      refill: refill && {
        ran: refill.ran,
        reason: refill.reason,
        stopped: refill.stopped,
        inserted: refill.inserted,
        qualified: refill.qualified,
        // La boucle VPS s'arrête net sur ce champ : brûler du quota looter
        // pendant que Claude est HS ne produirait aucun prospect qualifié.
        iaError: refill.iaError,
        steps: refill.steps.map((s) => ({ mode: s.mode, metier: s.metier, hashtag: s.hashtag, inserted: s.inserted, queued: s.queued, processed: s.processed, qualified: s.qualified, reason: s.reason })),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (notify) await sendTelegram(`❌ <b>Refill IG en erreur</b>\n${msg.slice(0, 400)}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
