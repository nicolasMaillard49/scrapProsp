import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendTelegram } from "@/app/lib/notify";
import { refreshCampaignKeywordsForLead, normalizeCustomerId } from "@/app/lib/googleAds/campaign";
import { existingCampaignForLead } from "@/app/lib/googleAds/persistence";
import type { EligibiliteLead } from "@/app/lib/googleAds/mapping";

/**
 * POST /api/eligibilite/refresh-keywords  { leadId, customerId?, campaignId? }
 * Étape ADMIN : remplace les mots-clés d'une campagne EXISTANTE par des mots-clés
 * frais (city-free, via le Keyword Plan Idea Service). Ne recrée rien, ne touche ni
 * budget ni enchères. Sert à corriger une campagne dont les mots-clés « ville »
 * tombaient en « Volume de recherche faible ».
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
  if (!b.leadId) return NextResponse.json({ error: "leadId requis" }, { status: 400 });

  const { data: lead, error } = await supabaseAdmin
    .from("eligibilite_leads")
    .select("*")
    .eq("id", b.leadId)
    .single();
  if (error || !lead) {
    return NextResponse.json({ error: error?.message || "Lead introuvable" }, { status: 404 });
  }

  // Résout customerId + campaignId : explicites en priorité, sinon via le lead.
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
      { error: "Campagne introuvable (customerId + campaignId requis, ou un leadId avec une campagne créée)" },
      { status: 400 },
    );
  }

  const res = await refreshCampaignKeywordsForLead(lead as EligibiliteLead, customerId, campaignId);

  await sendTelegram(
    res.ok
      ? `🔑 Mots-clés rafraîchis — campagne ${campaignId} — ${res.removed} supprimés, ${res.added} ajoutés (source: ${res.keywordSource})`
      : `❌ Refresh mots-clés échoué — campagne ${campaignId} — ${res.error || "erreur inconnue"}`,
  );

  return NextResponse.json({
    ok: res.ok,
    removed: res.removed,
    added: res.added,
    keywords: res.keywords.map((k) => ({ text: k.text, match: k.match })),
    keywordSource: res.keywordSource,
    error: res.error ?? null,
  });
}
