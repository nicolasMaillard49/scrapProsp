/**
 * Lecture/écriture de la table `google_ads_accounts` (suivi des comptes/campagnes
 * créés depuis le funnel). Utilise la clé service (supabaseAdmin).
 */
import { supabaseAdmin } from "../supabaseAdmin";

export type AdsStatus = "pending" | "dry_run" | "paused" | "active" | "capped" | "error";

export interface AdsAccountRow {
  id?: string;
  lead_id: string | null;
  client_name: string;
  customer_id?: string | null;
  mcc_id?: string;
  campaign_id?: string | null;
  budget_id?: string | null;
  status: AdsStatus;
  daily_budget?: number | null;
  metier?: string | null;
  ville?: string | null;
  payload?: unknown;
  error?: string | null;
  activated_at?: string | null;
}

/** Insère une ligne de suivi et renvoie son id (ou null si échec). */
export async function recordAdsAccount(row: AdsAccountRow): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("recordAdsAccount error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Récupère le customer_id déjà créé pour un lead (idempotence). */
export async function existingCustomerForLead(leadId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id")
    .eq("lead_id", leadId)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.customer_id ?? null;
}

/**
 * Récupère la campagne DÉJÀ créée pour un lead (campaign_id non nul) — idempotence
 * de la création de campagne : évite qu'un retry / double-clic / 2e onglet crée une
 * campagne (et un budget) en double dans le compte client. Les records `error`
 * (campaign_id nul) ne bloquent pas : on peut réessayer après un échec.
 */
export async function existingCampaignForLead(
  leadId: string,
): Promise<{ customerId: string | null; campaignId: string } | null> {
  const { data } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id, campaign_id")
    .eq("lead_id", leadId)
    .not("campaign_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.campaign_id ? { customerId: data.customer_id ?? null, campaignId: data.campaign_id } : null;
}
