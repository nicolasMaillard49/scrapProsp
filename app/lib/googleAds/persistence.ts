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

/** Vue d'une campagne tracée (pour la console funnel + le chatbot). */
export interface TrackedCampaign {
  id: string;
  lead_id: string | null;
  client_name: string;
  customer_id: string | null;
  campaign_id: string;
  status: string;
  daily_budget: number | null;
  metier: string | null;
  ville: string | null;
  plan: unknown; // payload.plan ?? payload
  created_at: string | null;
}

/** Déballe le plan depuis le payload (forme { plan } ou plan direct). */
function unwrapPlan(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "plan" in (payload as Record<string, unknown>)) {
    return (payload as { plan?: unknown }).plan ?? null;
  }
  return payload ?? null;
}

/**
 * Liste les campagnes RÉELLEMENT créées (campaign_id non nul), dédupliquées par
 * campaign_id (on garde la ligne la plus récente — un retry `error` ne masque pas
 * la campagne créée). Triées de la plus récente à la plus ancienne.
 */
export async function listTrackedCampaigns(): Promise<TrackedCampaign[]> {
  const { data } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("id, lead_id, client_name, customer_id, campaign_id, status, daily_budget, metier, ville, payload, created_at")
    .not("campaign_id", "is", null)
    .order("created_at", { ascending: false });
  const seen = new Set<string>();
  const out: TrackedCampaign[] = [];
  for (const r of (data as Array<Record<string, unknown>>) ?? []) {
    const campaignId = r.campaign_id as string;
    if (seen.has(campaignId)) continue;
    seen.add(campaignId);
    out.push({
      id: r.id as string,
      lead_id: (r.lead_id as string) ?? null,
      client_name: (r.client_name as string) ?? "",
      customer_id: (r.customer_id as string) ?? null,
      campaign_id: campaignId,
      status: (r.status as string) ?? "",
      daily_budget: (r.daily_budget as number) ?? null,
      metier: (r.metier as string) ?? null,
      ville: (r.ville as string) ?? null,
      plan: unwrapPlan(r.payload),
      created_at: (r.created_at as string) ?? null,
    });
  }
  return out;
}

/** Récupère une campagne tracée par l'id du record `google_ads_accounts`. */
export async function getTrackedCampaign(id: string): Promise<TrackedCampaign | null> {
  const { data } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("id, lead_id, client_name, customer_id, campaign_id, status, daily_budget, metier, ville, payload, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.campaign_id) return null;
  return {
    id: data.id,
    lead_id: data.lead_id ?? null,
    client_name: data.client_name ?? "",
    customer_id: data.customer_id ?? null,
    campaign_id: data.campaign_id,
    status: data.status ?? "",
    daily_budget: data.daily_budget ?? null,
    metier: data.metier ?? null,
    ville: data.ville ?? null,
    plan: unwrapPlan(data.payload),
    created_at: data.created_at ?? null,
  };
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
