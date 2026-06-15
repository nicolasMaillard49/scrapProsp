/**
 * Orchestration de la création de campagne depuis un lead d'éligibilité.
 *
 * Phase 1 (ce fichier) : DRY-RUN — construit le plan complet (compte, budget,
 * campagne, ciblage géo, ad group, mots-clés, négatifs, RSA, call tracking),
 * le loggue et le persiste, SANS rien créer côté Google. 100 % testable sans risque.
 *
 * Phase 2 : activer les appels API (mutateResources + création de compte) étape
 * par étape contre un compte de test (nécessite billing). Garde explicite plus bas.
 */
import { leadToCampaignParams, type EligibiliteLead, type CampaignParams } from "./mapping";
import { negativesFor } from "./negatives";
import { generateAdContent, type Keyword, type AdCopy } from "./copy";
import { MCC_ID, googleAdsConfigured } from "./client";
import { recordAdsAccount } from "./persistence";

/** Config du call tracking « appels depuis les annonces » (≥ 30 s = conversion). */
export interface CallTrackingPlan {
  enabled: boolean;
  conversionActionName: string;
  minCallDurationSeconds: number;
  callPhoneE164: string;
}

/** Plan complet d'une campagne — c'est le payload inspectable du dry-run. */
export interface CampaignPlan {
  mccId: string;
  params: CampaignParams;
  keywords: Keyword[];
  negatives: string[];
  ad: AdCopy;
  callTracking: CallTrackingPlan;
  copySource: "claude" | "fallback";
  warnings: string[];
}

export interface CreateResult {
  ok: boolean;
  dryRun: boolean;
  plan: CampaignPlan;
  recordId: string | null;
  error?: string;
}

/** Construit le plan complet (mapping + contenu Claude + négatifs + call tracking). */
export async function buildPlan(lead: EligibiliteLead): Promise<CampaignPlan> {
  const params = leadToCampaignParams(lead);
  const { keywords, ad, source } = await generateAdContent({
    metier: params.metier,
    ville: params.ville,
    service: params.serviceCible,
  });

  const warnings: string[] = [];
  if (!params.finalUrl) warnings.push("site_url manquant : final URL obligatoire pour diffuser.");
  if (!params.callPhoneE164) warnings.push("téléphone non exploitable : pas de call asset ni de conversion appel.");
  if (params.geo.kind === "city" && !params.ville) warnings.push("ni lat/lon ni ville : ciblage géographique impossible.");

  return {
    mccId: MCC_ID,
    params,
    keywords,
    negatives: negativesFor(params.metier),
    ad,
    callTracking: {
      enabled: !!params.callPhoneE164,
      conversionActionName: `Appel ${params.metier} ${params.ville}`.trim(),
      minCallDurationSeconds: 30,
      callPhoneE164: params.callPhoneE164,
    },
    copySource: source,
    warnings,
  };
}

/**
 * Crée (ou simule) la campagne pour un lead.
 * Par défaut DRY-RUN. Le mode réel (Phase 2) est explicitement bloqué tant qu'il
 * n'a pas été activé/testé contre un compte de test avec billing.
 */
export async function createCampaignForLead(
  lead: EligibiliteLead,
  opts: { dryRun?: boolean } = {},
): Promise<CreateResult> {
  const dryRun = opts.dryRun ?? true;
  const plan = await buildPlan(lead);

  if (dryRun) {
    // Trace lisible + persistance du payload pour revue avant toute création réelle.
    console.log("[google-ads][dry-run] plan campagne:", JSON.stringify(plan, null, 2));
    const recordId = await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      mcc_id: plan.mccId,
      status: "dry_run",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: plan,
    });
    return { ok: true, dryRun: true, plan, recordId };
  }

  // ── Mode réel — Phase 2 (non activé) ───────────────────────────────────────
  // À implémenter pas à pas via customer.mutateResources() sur un compte de test :
  //   1. createCustomerClient (compte sous le MCC 671)
  //   2. conversion action AD_CALL (≥30s) + activation call reporting
  //   3. campaign_budget → campaign (PAUSED, end_date, networks, geo PRESENCE, Maximize Clicks)
  //   4. campaign_criterion (proximité/ville + langue FR)
  //   5. ad_group → ad_group_criterion (keywords) → ad_group_ad (RSA)
  //   6. campaign negative keywords + call asset
  //   7. persistance customer_id/campaign_id
  // Prérequis : billing actif sur le compte + vérif manuelle dans l'UI.
  if (!googleAdsConfigured()) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "Credentials Google Ads incomplets." };
  }
  throw new Error(
    "Création réelle non activée (Phase 2). Utiliser dryRun:true. " +
      "Le mode réel sera branché et testé pas à pas sur un compte de test avec billing.",
  );
}
