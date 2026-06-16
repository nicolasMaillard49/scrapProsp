import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { googleAdsConfigured } from "@/app/lib/googleAds/client";
import { isBillingActive } from "@/app/lib/googleAds/create";

/**
 * GET /api/eligibilite/activation-status/[id]
 * Polling de la page d'activation : indique si le compte Google Ads du lead a
 * désormais un moyen de paiement (carte ajoutée). LECTURE SEULE — ne dé-pause rien.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseAdminConfigured) return NextResponse.json({ active: false, customerId: null });

  const { data } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id")
    .eq("lead_id", id)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = data?.customer_id ?? null;
  if (!customerId || !googleAdsConfigured()) {
    return NextResponse.json({ active: false, customerId });
  }

  try {
    const active = await isBillingActive(customerId);
    return NextResponse.json({ active, customerId });
  } catch (e) {
    // Pas d'accès billing / erreur API : on ne casse pas le polling, on reste "en attente".
    return NextResponse.json({
      active: false,
      customerId,
      error: String(e instanceof Error ? e.message : e),
    });
  }
}
