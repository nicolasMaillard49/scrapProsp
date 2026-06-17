import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendTelegram } from "@/app/lib/notify";
import { createCampaignOnLinkedAccount } from "@/app/lib/googleAds/campaign";
import type { EligibiliteLead } from "@/app/lib/googleAds/mapping";

/**
 * POST /api/eligibilite/create-campaign  { leadId, customerId }
 * Étape ADMIN du workflow manuel : le compte Google Ads a été créé à la main (hors
 * MCC) puis lié au MCC 671. On y crée la campagne PAUSED par API (le customer ID
 * lié est saisi dans /admin/funnel). Aucune création de compte ici.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }

  let b: { leadId?: string; customerId?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!b.leadId) return NextResponse.json({ error: "leadId requis" }, { status: 400 });
  if (!b.customerId) return NextResponse.json({ error: "customerId requis" }, { status: 400 });

  const { data: lead, error } = await supabaseAdmin
    .from("eligibilite_leads")
    .select("*")
    .eq("id", b.leadId)
    .single();
  if (error || !lead) {
    return NextResponse.json({ error: error?.message || "Lead introuvable" }, { status: 404 });
  }

  const res = await createCampaignOnLinkedAccount(lead as EligibiliteLead, b.customerId);

  await sendTelegram(
    res.ok
      ? `✅ Campagne PAUSED créée — compte ${res.customerId} — « ${res.plan.params.campaignName} » (campagne ${res.campaignId || "?"})`
      : `❌ Création campagne échouée — compte ${b.customerId} — ${res.error || "erreur inconnue"}`,
  );

  return NextResponse.json({
    ok: res.ok,
    customerId: res.customerId ?? null,
    campaignId: res.campaignId ?? null,
    error: res.error ?? null,
  });
}
