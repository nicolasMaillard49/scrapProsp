import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendEmail } from "@/app/lib/email";
import { sendTelegram } from "@/app/lib/notify";
import { launchEmailHtml } from "@/app/lib/eligibilite";
import { createCampaignForLead } from "@/app/lib/googleAds/campaign";
import { isRealAllowed } from "@/app/lib/googleAds/allowlist";
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

  // Mode réel UNIQUEMENT si l'email du lead est dans l'allow-list
  // (GOOGLE_ADS_REAL_EMAILS), ou override interne explicite { dryRun:false }.
  const dryRun = b.dryRun === false ? false : !isRealAllowed(lead.email);

  if (lead.email) {
    const { subject, html } = launchEmailHtml(lead);
    await sendEmail({ to: lead.email, subject, html });
  }
  await sendTelegram(`🚀 Campagne lancée — ${lead.metier || ""} ${lead.ville || ""} — ${lead.phone || ""}`);

  // Construction de la campagne Google Ads (dry-run par défaut). Non bloquant :
  // un échec ici ne doit pas casser l'activation du lead.
  let ads: { ok: boolean; dryRun: boolean; recordId: string | null; warnings: string[] } | null = null;
  try {
    const res = await createCampaignForLead(lead as EligibiliteLead, { dryRun });
    ads = { ok: res.ok, dryRun: res.dryRun, recordId: res.recordId, warnings: res.plan.warnings };
    if (res.dryRun) {
      await sendTelegram(
        `🧪 [dry-run] Campagne Google Ads simulée — ${res.plan.params.campaignName} — ` +
          `budget ${Math.round(res.plan.params.dailyBudgetMicros / 1_000_000)} €/j` +
          (res.plan.warnings.length ? ` — ⚠️ ${res.plan.warnings.join(" · ")}` : ""),
      );
    }
  } catch (e) {
    console.error("createCampaignForLead error:", e);
    ads = { ok: false, dryRun, recordId: null, warnings: [String(e instanceof Error ? e.message : e)] };
  }

  return NextResponse.json({ ok: true, ads });
}
