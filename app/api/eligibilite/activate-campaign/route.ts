import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendTelegram } from "@/app/lib/notify";
import { activateCampaign } from "@/app/lib/googleAds/create";
import { existingCampaignForLead } from "@/app/lib/googleAds/persistence";
import { normalizeCustomerId } from "@/app/lib/googleAds/campaign";

/**
 * POST /api/eligibilite/activate-campaign  { leadId?, customerId?, campaignId? }
 * Étape ADMIN finale : passe la campagne PAUSED en ENABLED et pose sa date de fin
 * à J+7 du GO-LIVE réel (et non de la création) → la semaine de test compte 7 jours
 * de diffusion, ce qui absorbe le délai de validation Google. Remplace le dé-pause manuel.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }

  let b: { leadId?: string; customerId?: string; campaignId?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // On résout customerId + campaignId : explicites en priorité, sinon via le lead.
  let customerId = normalizeCustomerId(b.customerId);
  let campaignId = b.campaignId || null;
  if ((!customerId || !campaignId) && b.leadId) {
    const found = await existingCampaignForLead(b.leadId);
    if (found) {
      customerId = customerId ?? normalizeCustomerId(found.customerId);
      campaignId = campaignId ?? found.campaignId;
    }
  }
  if (!customerId || !campaignId) {
    return NextResponse.json(
      { error: "Campagne introuvable (customerId + campaignId requis, ou un leadId avec une campagne déjà créée)" },
      { status: 400 },
    );
  }

  try {
    const { endDate } = await activateCampaign(customerId, campaignId);
    // Suivi : marque la campagne active + horodatage.
    await supabaseAdmin
      .from("google_ads_accounts")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("campaign_id", campaignId);

    await sendTelegram(`🚀 Campagne ACTIVÉE — compte ${customerId} — campagne ${campaignId} — fin ${endDate}`);
    return NextResponse.json({ ok: true, customerId, campaignId, endDate });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[google-ads] échec activation campagne — cust", customerId, "camp", campaignId, "—", error, "\nraw:", e);
    await sendTelegram(`❌ Activation campagne échouée — compte ${customerId} — campagne ${campaignId} — ${error}`);
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
}
