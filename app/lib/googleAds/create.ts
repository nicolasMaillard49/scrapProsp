/**
 * Écritures RÉELLES Google Ads (Phase 2). Isolé de campaign.ts pour rester lisible.
 * - createOrReuseAccount : sous-compte sous le MCC 671 (idempotent par lead).
 * - inviteUser : invite l'email du lead -> Google envoie son email d'invitation.
 * - createPausedCampaign : campagne PAUSED (Task 4).
 */
import { enums, ResourceNames } from "google-ads-api";
import { mccCustomer, clientCustomer, MCC_ID } from "./client";
import { existingCustomerForLead } from "./persistence";
import { endDatePlusDays, TEST_DURATION_DAYS } from "./mapping";
import type { CampaignPlan } from "./campaign";

/** Extrait le dernier groupe de chiffres d'un resource_name (= customer_id créé). */
function lastNumericId(resourceName: string | undefined | null): string | null {
  const ids = (resourceName || "").match(/\d+/g);
  return ids && ids.length ? ids[ids.length - 1] : null;
}

/** Crée le sous-compte (ou réutilise l'existant pour ce lead). Renvoie le customer_id (sans tirets). */
export async function createOrReuseAccount(leadId: string, accountName: string): Promise<string> {
  const existing = await existingCustomerForLead(leadId);
  if (existing) return existing.replace(/-/g, "");

  // customers.createCustomerClient(request) : customer_id = MCC manager, customer_client = le compte à créer.
  // La lib type le paramètre via la *classe* CreateCustomerClientRequest (et non l'interface
  // ICreateCustomerClientRequest), exigeant à tort des membres comme toJSON/validate_only. En runtime
  // un objet simple est attendu (le wrapper le transmet tel quel à gRPC). Cast localisé sur l'argument.
  const createReq = {
    customer_id: MCC_ID,
    customer_client: {
      descriptive_name: accountName,
      currency_code: "EUR",
      time_zone: "Europe/Paris",
    },
  };
  const res = await mccCustomer().customers.createCustomerClient(
    createReq as unknown as Parameters<ReturnType<typeof mccCustomer>["customers"]["createCustomerClient"]>[0],
  );
  const customerId = lastNumericId(res.resource_name);
  if (!customerId) {
    throw new Error(`createCustomerClient: resource_name inattendu (${JSON.stringify(res)})`);
  }
  return customerId;
}

/**
 * Le compte a-t-il un moyen de paiement actif (billing) ? LECTURE SEULE.
 * Sert au polling de la page d'activation : true = la carte a été ajoutée côté Google.
 * N'écrit rien, ne dé-pause rien.
 */
export async function isBillingActive(customerId: string): Promise<boolean> {
  const rows = await clientCustomer(customerId).query(
    "SELECT billing_setup.status FROM billing_setup",
  );
  const active = new Set<unknown>([
    enums.BillingSetupStatus.APPROVED,
    enums.BillingSetupStatus.APPROVED_HELD,
    "APPROVED",
    "APPROVED_HELD",
  ]);
  return rows.some((r) => active.has((r as { billing_setup?: { status?: unknown } }).billing_setup?.status));
}

/** Invite l'email sur le compte client (rôle ADMIN). true = invitation envoyée, false = déjà invité/membre. */
export async function inviteUser(customerId: string, email: string): Promise<boolean> {
  try {
    await clientCustomer(customerId).customerUserAccessInvitations.create([
      { email_address: email, access_role: enums.AccessRole.ADMIN },
    ]);
    return true;
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/already|exist|pending|duplicate/i.test(msg)) return false; // déjà invité : non bloquant
    throw e;
  }
}

/** Nom (ASCII, stable) de l'action de conversion « appel depuis les annonces ». */
const CALL_CONVERSION_NAME = "Appel NMF 30s";

/**
 * Garantit l'existence d'une action de conversion « Appels depuis les annonces »
 * (durée mini 30 s) au niveau du compte, et renvoie son resource_name.
 * Idempotent : réutilise celle qui existe (par nom + type AD_CALL). Renvoie null
 * en cas d'échec (la campagne sera créée SANS call asset — non bloquant).
 * ⚠️ Formes exactes (enums, phone_call_duration_seconds) à confirmer au smoke-test.
 */
export async function ensureCallConversionAction(customerId: string): Promise<string | null> {
  const cust = clientCustomer(customerId);
  try {
    const rows = await cust.query(
      `SELECT conversion_action.resource_name FROM conversion_action ` +
        `WHERE conversion_action.name = '${CALL_CONVERSION_NAME}' AND conversion_action.type = 'AD_CALL' LIMIT 1`,
    );
    const existing = (rows[0] as { conversion_action?: { resource_name?: string } } | undefined)?.conversion_action?.resource_name;
    if (existing) return existing;

    const res = await cust.conversionActions.create([
      {
        name: CALL_CONVERSION_NAME,
        type: enums.ConversionActionType.AD_CALL,
        category: enums.ConversionActionCategory.PHONE_CALL_LEAD,
        status: enums.ConversionActionStatus.ENABLED,
        phone_call_duration_seconds: 30,
        counting_type: enums.ConversionActionCountingType.ONE_PER_CLICK,
        value_settings: { default_value: 0, always_use_default_value: true },
      },
    ]);
    return res.results?.[0]?.resource_name ?? null;
  } catch (e) {
    console.warn("[google-ads] ensureCallConversionAction échec (campagne créée sans call asset):", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface CampaignIds {
  campaignId: string;
  budgetId: string;
  warnings: string[];
}

/** Crée budget + campagne PAUSED + ad group + keywords + RSA + négatifs + géo/langue. */
export async function createPausedCampaign(customerId: string, plan: CampaignPlan): Promise<CampaignIds> {
  const cust = clientCustomer(customerId);
  const warnings: string[] = [];

  // Conversion appel (≥30s) au niveau du compte (idempotent) → référencée par le call
  // asset. Non bloquant : si l'action n'a pas pu être créée, on omet le call asset.
  let callConversionRN: string | null = null;
  if (plan.callTracking.enabled && plan.params.callPhoneE164) {
    callConversionRN = await ensureCallConversionAction(customerId);
    if (!callConversionRN) warnings.push("Action de conversion appel non créée : call asset omis (à configurer à la main).");
  }

  const budgetRN = ResourceNames.campaignBudget(customerId, "-1");
  const campaignRN = ResourceNames.campaign(customerId, "-2");
  const adGroupRN = ResourceNames.adGroup(customerId, "-3");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];

  ops.push({
    entity: "campaign_budget",
    operation: "create",
    resource: {
      resource_name: budgetRN,
      name: `${plan.params.campaignName} — budget`.slice(0, 250),
      amount_micros: plan.params.dailyBudgetMicros,
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
      explicitly_shared: false,
    },
  });

  ops.push({
    entity: "campaign",
    operation: "create",
    resource: {
      resource_name: campaignRN,
      name: plan.params.campaignName,
      status: enums.CampaignStatus.PAUSED,
      advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
      campaign_budget: budgetRN,
      // Pas de end_date à la création : la campagne naît PAUSED, sans date de fin.
      // La fin (J+7) est posée à l'ACTIVATION (cf. activateCampaign) = 7 jours de
      // DIFFUSION réelle, ce qui absorbe le délai de validation Google.
      network_settings: {
        target_google_search: true,
        // Partenaires de recherche OFF : trafic moins qualifié pour de l'artisan local
        // (best-practice skill google-ads-artisans). Display déjà OFF.
        target_search_network: false,
        target_content_network: false,
        target_partner_search_network: false,
      },
      geo_target_type_setting: {
        positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
        negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
      },
      // Maximize Clicks = champ `target_spend` sur la campagne (PAS `maximize_clicks`,
      // qui n'existe pas → stratégie d'enchères vide → « required field not present »).
      target_spend: plan.params.cpcCeilingMicros > 0
        ? { cpc_bid_ceiling_micros: plan.params.cpcCeilingMicros }
        : {},
    },
  });

  ops.push({
    entity: "ad_group",
    operation: "create",
    resource: {
      resource_name: adGroupRN,
      name: plan.params.adGroupName,
      campaign: campaignRN,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  });

  for (const kw of plan.keywords) {
    ops.push({
      entity: "ad_group_criterion",
      operation: "create",
      resource: {
        ad_group: adGroupRN,
        status: enums.AdGroupCriterionStatus.ENABLED,
        keyword: { text: kw.text, match_type: enums.KeywordMatchType[kw.match] },
      },
    });
  }

  ops.push({
    entity: "ad_group_ad",
    operation: "create",
    resource: {
      ad_group: adGroupRN,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [plan.params.finalUrl],
        responsive_search_ad: {
          headlines: plan.ad.headlines.map((t) => ({ text: t })),
          descriptions: plan.ad.descriptions.map((t) => ({ text: t })),
          ...(plan.ad.path1 ? { path1: plan.ad.path1 } : {}),
          ...(plan.ad.path2 ? { path2: plan.ad.path2 } : {}),
        },
      },
    },
  });

  for (const neg of plan.negatives) {
    ops.push({
      entity: "campaign_criterion",
      operation: "create",
      resource: {
        campaign: campaignRN,
        negative: true,
        keyword: { text: neg, match_type: enums.KeywordMatchType.PHRASE },
      },
    });
  }

  if (plan.params.geo.kind === "proximity") {
    ops.push({
      entity: "campaign_criterion",
      operation: "create",
      resource: {
        campaign: campaignRN,
        proximity: {
          geo_point: {
            latitude_in_micro_degrees: plan.params.geo.latMicro,
            longitude_in_micro_degrees: plan.params.geo.lonMicro,
          },
          radius: plan.params.geo.radiusKm,
          radius_units: enums.ProximityRadiusUnits.KILOMETERS,
        },
      },
    });
  } else {
    warnings.push("Pas de lat/lon : campagne PAUSED créée SANS ciblage géo (à cibler à la main).");
  }

  ops.push({
    entity: "campaign_criterion",
    operation: "create",
    resource: { campaign: campaignRN, language: { language_constant: plan.params.languageConstant } },
  });

  // Call asset (numéro affiché + suivi) lié à la campagne, référençant la conversion appel.
  if (callConversionRN) {
    const assetRN = ResourceNames.asset(customerId, "-4");
    const nationalPhone = plan.params.callPhoneE164.replace(/^\+33/, "0"); // CallAsset attend le national + country_code
    ops.push({
      entity: "asset",
      operation: "create",
      resource: {
        resource_name: assetRN,
        call_asset: {
          country_code: "FR",
          phone_number: nationalPhone,
          call_conversion_reporting_state: enums.CallConversionReportingState.USE_RESOURCE_LEVEL_CALL_CONVERSION_ACTION,
          call_conversion_action: callConversionRN,
        },
      },
    });
    ops.push({
      entity: "campaign_asset",
      operation: "create",
      resource: { campaign: campaignRN, asset: assetRN, field_type: enums.AssetFieldType.CALL },
    });
  }

  const result = await cust.mutateResources(ops);
  // La forme exacte de mutate_operation_responses (clés campaign_result, campaign_budget_result)
  // est à confirmer au smoke-test runtime (Task 7) -> cast tolérant via unknown.
  const results = (result as unknown as {
    mutate_operation_responses?: Array<Record<string, { resource_name?: string }>>;
  }).mutate_operation_responses ?? [];
  const find = (key: string) =>
    lastNumericId(results.map((r) => r[key]?.resource_name).find(Boolean) as string | undefined) ?? "";

  return { campaignId: find("campaign_result"), budgetId: find("campaign_budget_result"), warnings };
}

/**
 * Active une campagne PAUSED : la passe ENABLED et fixe sa fin à J+TEST_DURATION_DAYS
 * à partir de MAINTENANT (= go-live réel), pas de la création. La « semaine de test »
 * compte donc 7 jours de DIFFUSION effective, ce qui absorbe le délai de validation
 * Google (compte/annonces). Renvoie la date de fin posée (YYYYMMDD).
 */
export async function activateCampaign(
  customerId: string,
  campaignId: string,
): Promise<{ endDate: string }> {
  const endDate = endDatePlusDays(TEST_DURATION_DAYS);
  // end_date est un champ Campaign valide (la création l'utilise via mutateResources),
  // mais le typage strict de campaigns.update() le rejette → cast localisé de l'argument
  // (même approche que createOrReuseAccount). .update() construit le field mask seul.
  await clientCustomer(customerId).campaigns.update([
    {
      resource_name: ResourceNames.campaign(customerId, campaignId),
      status: enums.CampaignStatus.ENABLED,
      end_date: endDate,
    },
  ] as unknown as Parameters<ReturnType<typeof clientCustomer>["campaigns"]["update"]>[0]);
  return { endDate };
}
