/**
 * Lecture SEULE des performances d'une campagne Google Ads (GAQL via le compte
 * client, login_customer_id = MCC déjà géré dans client.ts). Aucune écriture.
 *
 * Sert à la console funnel : « Campagnes en cours » + snapshot du chatbot.
 * Robuste : chaque requête est isolée ; si l'API échoue (creds, quota, campagne
 * sans données), on renvoie `live: false` avec des métriques à zéro et des
 * warnings — l'appelant complète alors avec la config en base.
 */
import { clientCustomer } from "./client";
import { describeAdsError } from "./errors";

export interface Metrics {
  impressions: number;
  clicks: number;
  ctr: number; // ratio 0..1
  avgCpcEur: number;
  costEur: number;
  conversions: number;
  phoneCalls: number;
  costPerConvEur: number | null;
  searchBudgetLostIs: number | null; // ratio 0..1
}

export interface CampaignReport {
  live: boolean;
  campaign: {
    id: string;
    name: string;
    status: string; // ENABLED / PAUSED / REMOVED…
    servingStatus: string; // SERVING / NONE / PENDING / SUSPENDED / ENDED…
    adApproval: string | null; // APPROVED / UNDER_REVIEW / DISAPPROVED / null
    biddingStrategy: string;
    startDate: string | null;
    endDate: string | null;
  };
  budget: { dailyEur: number | null };
  metrics30d: Metrics;
  metrics7d: Metrics;
  topKeywords: Array<{ text: string; matchType: string; qualityScore: number | null; clicks: number }>;
  warnings: string[];
}

/** micros → euros (2 décimales). PURE. */
export function microsToEur(micros: number | null | undefined): number {
  if (!micros) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

/**
 * Un champ enum renvoyé par GAQL peut arriver en string ("ENABLED") ou en number
 * (index de l'enum). On normalise toujours en nom lisible. PURE.
 */
export function enumName(value: unknown, enumObj?: Record<string, unknown>): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && enumObj) {
    const hit = Object.entries(enumObj).find(([, v]) => v === value);
    if (hit) return hit[0];
  }
  return String(value);
}

/** Normalise une ligne GAQL `{ metrics: {...} }` en Metrics. PURE. */
export function normalizeMetrics(row: unknown): Metrics {
  const m = (row as { metrics?: Record<string, unknown> } | undefined)?.metrics ?? {};
  const num = (k: string) => Number(m[k] ?? 0) || 0;
  return {
    impressions: num("impressions"),
    clicks: num("clicks"),
    ctr: num("ctr"),
    avgCpcEur: microsToEur(num("average_cpc")),
    costEur: microsToEur(num("cost_micros")),
    conversions: Math.round(num("conversions") * 100) / 100,
    phoneCalls: num("phone_calls"),
    costPerConvEur: m["cost_per_conversion"] != null ? microsToEur(num("cost_per_conversion")) : null,
    searchBudgetLostIs:
      m["search_budget_lost_impression_share"] != null ? num("search_budget_lost_impression_share") : null,
  };
}

const ZERO_METRICS: Metrics = {
  impressions: 0,
  clicks: 0,
  ctr: 0,
  avgCpcEur: 0,
  costEur: 0,
  conversions: 0,
  phoneCalls: 0,
  costPerConvEur: null,
  searchBudgetLostIs: null,
};

/** Rapport « vide » (live:false) — utilisé en fallback quand l'API n'est pas joignable. */
export function emptyReport(campaignId: string, warnings: string[] = []): CampaignReport {
  return {
    live: false,
    campaign: {
      id: campaignId,
      name: "",
      status: "",
      servingStatus: "",
      adApproval: null,
      biddingStrategy: "",
      startDate: null,
      endDate: null,
    },
    budget: { dailyEur: null },
    metrics30d: { ...ZERO_METRICS },
    metrics7d: { ...ZERO_METRICS },
    topKeywords: [],
    warnings,
  };
}

const METRICS_FIELDS =
  "metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, " +
  "metrics.cost_micros, metrics.conversions, metrics.phone_calls, " +
  "metrics.cost_per_conversion, metrics.search_budget_lost_impression_share";

/**
 * Récupère le rapport complet d'une campagne. Ne lève jamais : en cas d'échec
 * global, renvoie un rapport `live: false` avec l'erreur en warning.
 */
export async function fetchCampaignReport(customerId: string, campaignId: string): Promise<CampaignReport> {
  const base = emptyReport(campaignId);
  const warnings = base.warnings;

  const cust = clientCustomer(customerId);
  const q = (gaql: string) => cust.query(gaql);

  // 1) État + budget (sans date) — c'est la requête qui qualifie `live`.
  try {
    const rows = await q(
      `SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status, ` +
        `campaign.bidding_strategy_type, campaign.start_date, campaign.end_date, ` +
        `campaign_budget.amount_micros ` +
        `FROM campaign WHERE campaign.id = ${campaignId} LIMIT 1`,
    );
    const r = rows[0] as
      | { campaign?: Record<string, unknown>; campaign_budget?: { amount_micros?: number } }
      | undefined;
    if (r?.campaign) {
      const c = r.campaign;
      base.live = true;
      base.campaign.name = String(c.name ?? "");
      base.campaign.status = enumName(c.status);
      base.campaign.servingStatus = enumName(c.serving_status);
      base.campaign.biddingStrategy = enumName(c.bidding_strategy_type);
      base.campaign.startDate = (c.start_date as string) ?? null;
      base.campaign.endDate = (c.end_date as string) ?? null;
      base.budget.dailyEur = r.campaign_budget?.amount_micros != null ? microsToEur(r.campaign_budget.amount_micros) : null;
    } else {
      warnings.push("Campagne introuvable via l'API (id inconnu ou compte non lié).");
    }
  } catch (e) {
    warnings.push(`Données live indisponibles : ${describeAdsError(e)}`);
    return base; // pas la peine de tenter le reste si l'état échoue
  }

  // 2) Métriques 30 j / 7 j + 3) statut d'approbation + 4) top mots-clés, en parallèle.
  const [m30, m7, approval, kws] = await Promise.allSettled([
    q(`SELECT ${METRICS_FIELDS} FROM campaign WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS`),
    q(`SELECT ${METRICS_FIELDS} FROM campaign WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_7_DAYS`),
    q(
      `SELECT ad_group_ad.policy_summary.approval_status, ad_group_ad.status ` +
        `FROM ad_group_ad WHERE campaign.id = ${campaignId} AND ad_group_ad.status != 'REMOVED' LIMIT 1`,
    ),
    q(
      `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ` +
        `ad_group_criterion.quality_info.quality_score, metrics.clicks ` +
        `FROM keyword_view WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS ` +
        `ORDER BY metrics.clicks DESC LIMIT 5`,
    ),
  ]);

  if (m30.status === "fulfilled" && m30.value[0]) base.metrics30d = normalizeMetrics(m30.value[0]);
  if (m7.status === "fulfilled" && m7.value[0]) base.metrics7d = normalizeMetrics(m7.value[0]);

  if (approval.status === "fulfilled" && approval.value[0]) {
    const ad = (approval.value[0] as { ad_group_ad?: { policy_summary?: { approval_status?: unknown } } }).ad_group_ad;
    base.campaign.adApproval = ad?.policy_summary?.approval_status != null ? enumName(ad.policy_summary.approval_status) : null;
  }

  if (kws.status === "fulfilled") {
    base.topKeywords = kws.value
      .map((row) => {
        const c = (row as { ad_group_criterion?: { keyword?: { text?: string; match_type?: unknown }; quality_info?: { quality_score?: number } }; metrics?: { clicks?: number } });
        return {
          text: c.ad_group_criterion?.keyword?.text ?? "",
          matchType: enumName(c.ad_group_criterion?.keyword?.match_type),
          qualityScore: c.ad_group_criterion?.quality_info?.quality_score ?? null,
          clicks: Number(c.metrics?.clicks ?? 0) || 0,
        };
      })
      .filter((k) => k.text);
  }

  return base;
}
