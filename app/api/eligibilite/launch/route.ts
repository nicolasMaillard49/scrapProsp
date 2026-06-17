import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendEmail } from "@/app/lib/email";
import { sendTelegram } from "@/app/lib/notify";
import { launchEmailHtml } from "@/app/lib/eligibilite";
import { createCampaignForLead } from "@/app/lib/googleAds/campaign";
import type { EligibiliteLead } from "@/app/lib/googleAds/mapping";

/**
 * POST /api/eligibilite/launch  { id: string }
 * Marque la campagne comme "lancée" et envoie le 2e email (activation).
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }
  let b: { id?: string; dryRun?: boolean };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { data: lead, error } = await supabaseAdmin
    .from("eligibilite_leads")
    .update({ status: "launched", launched_at: new Date().toISOString() })
    .eq("id", b.id)
    .select()
    .single();
  if (error || !lead) return NextResponse.json({ error: error?.message || "Lead introuvable" }, { status: 404 });

  if (lead.email) {
    const { subject, html } = launchEmailHtml(lead);
    const r = await sendEmail({ to: lead.email, subject, html });
    if (!r.ok) console.error(`[eligibilite/launch] email lancement NON envoyé à ${lead.email}:`, r.error || (r.skipped ? "skipped (config manquante)" : "?"));
    else console.log(`[eligibilite/launch] email lancement envoyé à ${lead.email} (id ${r.id})`);
  }

  // L'auto-création de compte Google Ads est désactivée : le MCC 671 ne peut pas
  // créer de comptes par API tant qu'il n'a pas un compte lié ayant dépensé > 1000 $.
  // On génère + persiste donc seulement le PLAN (dry-run) et on notifie pour le
  // provisioning MANUEL. La campagne réelle est créée ensuite depuis /admin/funnel
  // (POST /api/eligibilite/create-campaign), sur le compte créé à la main + lié au MCC.
  let ads: { ok: boolean; recordId: string | null; warnings: string[] } | null = null;
  try {
    const res = await createCampaignForLead(lead as EligibiliteLead, { dryRun: true });
    ads = { ok: res.ok, recordId: res.recordId, warnings: res.plan.warnings };
    const budget = Math.round(res.plan.params.dailyBudgetMicros / 1_000_000);
    await sendTelegram(
      `🛠️ Compte Google Ads à créer manuellement — ${lead.metier || ""} ${lead.ville || ""} — ` +
        `${lead.email || "sans email"} — ${lead.phone || ""} · budget ${budget} €/j · ${res.plan.keywords.length} mots-clés` +
        (res.plan.warnings.length ? `\n⚠️ ${res.plan.warnings.join(" · ")}` : ""),
    );
  } catch (e) {
    console.error("createCampaignForLead error:", e);
    ads = { ok: false, recordId: null, warnings: [String(e instanceof Error ? e.message : e)] };
  }

  return NextResponse.json({ ok: true, ads });
}
