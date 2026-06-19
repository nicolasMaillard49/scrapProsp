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
import { MCC_ID, googleAdsConfigured, mccCustomer } from "./client";
import { bestKeywordsForLead } from "./keywordIdeas";
import { recordAdsAccount, existingCampaignForLead } from "./persistence";
import { createOrReuseAccount, inviteUser, createPausedCampaign } from "./create";

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
  /** Provenance des mots-clés : API Google (volume réel), Claude, ou rule-based. */
  keywordSource: "keyword_ideas" | "claude" | "fallback";
  warnings: string[];
}

export interface CreateResult {
  ok: boolean;
  dryRun: boolean;
  plan: CampaignPlan;
  recordId: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  /** true = la campagne existait déjà pour ce lead, rien n'a été (re)créé (idempotence). */
  alreadyExisted?: boolean;
  error?: string;
}

/** Construit le plan complet (mapping + contenu Claude + négatifs + call tracking). */
export async function buildPlan(lead: EligibiliteLead): Promise<CampaignPlan> {
  const params = leadToCampaignParams(lead);
  const { keywords: copyKeywords, ad, source } = await generateAdContent({
    metier: params.metier,
    ville: params.ville,
    service: params.serviceCible,
  });

  const warnings: string[] = [];

  // Mots-clés "réels" via le Keyword Plan Idea Service (volume réel par zone, SANS
  // ville). On interroge via le MCC (read-only, pas de billing requis). À défaut
  // (pas de credentials, zone vide, erreur API), on retombe sur les mots-clés de
  // copy.ts (désormais eux aussi city-free).
  let keywords = copyKeywords;
  let keywordSource: CampaignPlan["keywordSource"] = source;
  if (googleAdsConfigured()) {
    try {
      const { keywords: apiKw, geoUsed } = await bestKeywordsForLead(mccCustomer(), MCC_ID, {
        metier: params.metier,
        service: params.serviceCible,
        ville: params.ville,
        department: null,
        url: params.finalUrl || lead.site_url || null,
      });
      if (apiKw.length) {
        keywords = apiKw;
        keywordSource = "keyword_ideas";
        console.log(`[google-ads][kw] ${apiKw.length / 2} mots-clés via API (géo: ${geoUsed}) pour lead ${lead.id}`);
      } else {
        warnings.push("Keyword Ideas n'a renvoyé aucun mot-clé diffusable : repli sur les mots-clés rule-based.");
      }
    } catch (e) {
      warnings.push(`Keyword Ideas indisponible (${e instanceof Error ? e.message : e}) : repli rule-based.`);
    }
  }
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
    keywordSource,
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

  // ── Mode réel — Phase 2 ─────────────────────────────────────────────────────
  if (!googleAdsConfigured()) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "Credentials Google Ads incomplets." };
  }
  // La RSA exige une final URL : on refuse de créer sans elle.
  if (!plan.params.finalUrl) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "site_url manquant : final URL obligatoire." };
  }

  try {
    const customerId = await createOrReuseAccount(lead.id, plan.params.accountName);
    let invited = false;
    if (lead.email) {
      invited = await inviteUser(customerId, lead.email);
    }
    const camp = await createPausedCampaign(customerId, plan);

    const recordId = await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      customer_id: customerId,
      mcc_id: plan.mccId,
      campaign_id: camp.campaignId || null,
      budget_id: camp.budgetId || null,
      status: "paused",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: { plan, invited, warnings: [...plan.warnings, ...camp.warnings] },
    });

    return { ok: true, dryRun: false, plan, recordId, customerId, campaignId: camp.campaignId || null };
  } catch (e) {
    const error = describeAdsError(e);
    // Log complet pour les runtime logs Vercel (`vercel logs`) — la vraie cause Google.
    console.error("[google-ads] échec création réelle — lead", lead.id, "—", error, "\nraw:", e);
    await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      mcc_id: plan.mccId,
      status: "error",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: plan,
      error,
    });
    return { ok: false, dryRun: false, plan, recordId: null, error };
  }
}

/**
 * Normalise un customer ID Google Ads saisi à la main → 10 chiffres (sans tirets
 * ni espaces). Renvoie null si ce n'est pas exactement 10 chiffres. PURE (testable).
 */
export function normalizeCustomerId(raw: string | null | undefined): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length === 10 ? digits : null;
}

/**
 * Crée la campagne PAUSED dans un compte client DÉJÀ créé et lié au MCC 671
 * (provisioning manuel : le MCC trop jeune ne peut pas créer de compte par API).
 * Ne crée AUCUN compte — réutilise `createPausedCampaign` sur le customerId fourni
 * par l'admin. `mutateResources` n'est pas concerné par la garde « new accounts ».
 */
export async function createCampaignOnLinkedAccount(
  lead: EligibiliteLead,
  customerIdRaw: string,
): Promise<CreateResult> {
  const customerId = normalizeCustomerId(customerIdRaw); // strip tirets/espaces -> 10 chiffres (évite CUSTOMER_NOT_FOUND)
  const plan = await buildPlan(lead);

  if (!customerId) {
    return { ok: false, dryRun: false, plan, recordId: null, error: `Customer ID invalide (attendu 10 chiffres, reçu « ${customerIdRaw} »).` };
  }
  if (!googleAdsConfigured()) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "Credentials Google Ads incomplets." };
  }
  if (!plan.params.finalUrl) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "site_url manquant : final URL obligatoire pour la RSA." };
  }

  // Idempotence : si une campagne a déjà été créée pour ce lead, on NE recrée rien
  // (un retry réseau / double-clic / 2e onglet créerait sinon une campagne + un budget
  // en double dans le compte client). On renvoie la campagne existante.
  const already = await existingCampaignForLead(lead.id);
  if (already) {
    return {
      ok: true,
      dryRun: false,
      plan,
      recordId: null,
      customerId: already.customerId ?? customerId,
      campaignId: already.campaignId,
      alreadyExisted: true,
    };
  }

  try {
    const camp = await createPausedCampaign(customerId, plan);
    const recordId = await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      customer_id: customerId,
      mcc_id: plan.mccId,
      campaign_id: camp.campaignId || null,
      budget_id: camp.budgetId || null,
      status: "paused",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: { plan, warnings: [...plan.warnings, ...camp.warnings] },
    });
    return { ok: true, dryRun: false, plan, recordId, customerId, campaignId: camp.campaignId || null };
  } catch (e) {
    const error = describeAdsError(e);
    console.error("[google-ads] échec création campagne (compte lié) — lead", lead.id, "cust", customerId, "—", error, "\nraw:", e);
    await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      customer_id: customerId,
      mcc_id: plan.mccId,
      status: "error",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: plan,
      error,
    });
    return { ok: false, dryRun: false, plan, recordId: null, customerId, error };
  }
}

/**
 * Message lisible depuis une erreur google-ads-api. La lib lève souvent un objet
 * (non-Error) de forme { errors: [{ message, error_code }] } → String() donnait
 * "[object Object]". On extrait le détail exploitable.
 */
function describeAdsError(e: unknown): string {
  const x = e as {
    errors?: Array<{
      message?: string;
      error_code?: unknown;
      location?: {
        operation_index?: number | string;
        field_path_elements?: Array<{ field_name?: string; index?: number | string }>;
      };
    }>;
    message?: string;
  };
  if (Array.isArray(x?.errors) && x.errors.length) {
    // Un mutateResources atomique renvoie souvent 1 vraie erreur + N « Resource was
    // not found » (cascade des resource names temporaires). On indexe par opération
    // + champ, on dédoublonne, et on remonte la vraie cause en tête.
    const seen = new Map<string, { label: string; count: number }>();
    for (const er of x.errors) {
      const loc = er.location;
      const opIdx =
        loc?.operation_index ??
        loc?.field_path_elements?.find((f) => f.field_name === "operations")?.index;
      const fields = (loc?.field_path_elements ?? [])
        .filter((f) => f.field_name && f.field_name !== "operations")
        .map((f) => f.field_name)
        .join(".");
      const base = er.message || (er.error_code ? JSON.stringify(er.error_code) : JSON.stringify(er));
      const label = `${opIdx != null ? `op#${opIdx} ` : ""}${fields ? `${fields}: ` : ""}${base}`;
      const key = `${base}|${fields}`;
      const prev = seen.get(key);
      if (prev) prev.count++;
      else seen.set(key, { label, count: 1 });
    }
    return [...seen.values()]
      .sort((a, b) => (/not found|introuv/i.test(a.label) ? 1 : 0) - (/not found|introuv/i.test(b.label) ? 1 : 0))
      .map((en) => (en.count > 1 ? `${en.label} (×${en.count})` : en.label))
      .join(" | ");
  }
  if (e instanceof Error) return e.message;
  if (x?.message) return x.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
