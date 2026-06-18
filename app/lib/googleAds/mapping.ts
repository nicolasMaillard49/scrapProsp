/**
 * Mapping lead d'éligibilité → paramètres de campagne Google Ads.
 *
 * Cœur PUR (aucune I/O) : c'est exactement ce que le dry-run loggue et ce qui est
 * couvert par les tests. La stratégie d'enchères (provisoire) est isolée ici pour
 * pouvoir évoluer sans toucher au reste.
 */
import { normalizePhoneFR } from "../match";

/** Forme minimale d'un lead `eligibilite_leads` utile à la campagne. */
export interface EligibiliteLead {
  id: string;
  email?: string | null;
  metier?: string | null;
  ville?: string | null;
  lat?: number | null;
  lon?: number | null;
  radius_km?: number | null;
  site_url?: string | null;
  service_cible?: string | null;
  budget_daily?: number | null;
  ad_budget_range?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

export interface CampaignParams {
  accountName: string;
  campaignName: string;
  adGroupName: string;
  serviceCible: string;
  metier: string;
  ville: string;
  dailyBudgetMicros: number;
  /** Enveloppe totale du test (100 € sur la semaine). */
  capEuros: number;
  geo:
    | { kind: "proximity"; latMicro: number; lonMicro: number; radiusKm: number }
    | { kind: "city"; ville: string };
  /** Critère langue Français (geo_target_constant n'est pas requis pour la langue). */
  languageConstant: string;
  finalUrl: string;
  callPhoneE164: string;
  /** Stratégie d'enchères provisoire (cf. spec §9). */
  biddingStrategy: "MAXIMIZE_CLICKS";
  /** Plafond CPC en micros pour Maximize Clicks (0 = pas de plafond). */
  cpcCeilingMicros: number;
}

export const TEST_DURATION_DAYS = 7;
/** Enveloppe FIXE du test : 100 € pour toute la semaine (au-delà, on réadapte à la main). */
const TEST_BUDGET_TOTAL_EUROS = 100;
/** Critère de langue Français dans l'API Google Ads. */
const LANGUAGE_FR = "languageConstants/1002";

/** "plombier"/"electricien" → libellé court présentable dans un nom de campagne. */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Téléphone FR → E.164 (+33XXXXXXXXX). "" si non exploitable. */
export function toE164FR(phone: string | null | undefined): string {
  const d = normalizePhoneFR(phone || ""); // 9 chiffres sans le 0
  return d.length === 9 ? `+33${d}` : "";
}

/** Normalise une URL en https:// (final URL obligatoire pour la campagne). */
export function normalizeUrl(url: string | null | undefined): string {
  const u = (url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

/** Date du jour + n jours au format YYYYMMDD (timezone Europe/Paris ~= local serveur). */
export function endDatePlusDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function leadToCampaignParams(lead: EligibiliteLead, now = new Date()): CampaignParams {
  const metier = (lead.metier || "").trim() || "Artisan";
  const ville = (lead.ville || "").trim() || "";
  const service = (lead.service_cible || metier).trim();
  const owner = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();

  // Budget du test = enveloppe FIXE de 100 € pour la semaine. Google Ads (Search)
  // EXIGE un budget journalier moyen — il n'existe pas de budget "total" pur. On
  // répartit donc les 100 € sur les 7 jours (≈ 14,29 €/j, livraison STANDARD qui
  // étale dans la journée) et la campagne s'éteint à J+7 (end_date) → l'enveloppe
  // tient la semaine sans qu'on impose une "limite journalière" arbitraire.
  const dailyEuros = TEST_BUDGET_TOTAL_EUROS / TEST_DURATION_DAYS;

  const hasGeo = typeof lead.lat === "number" && typeof lead.lon === "number";
  const radiusKm = lead.radius_km && lead.radius_km > 0 ? lead.radius_km : 15;

  const dateLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return {
    accountName: [`${titleCase(metier)} ${ville}`.trim(), owner].filter(Boolean).join(" — "),
    campaignName: `${titleCase(metier)} ${ville} — test ${dateLabel}`.trim(),
    adGroupName: titleCase(service),
    serviceCible: service,
    metier,
    ville,
    // amount_micros DOIT être un multiple de 10 000 (= 1 centime) pour l'EUR, sinon
    // Google rejette « money amount not a multiple of a minimum unit ». On arrondit
    // donc au centime : 100/7 ≈ 14,2857 € → 14,29 € → 14 290 000 micros.
    dailyBudgetMicros: Math.round(dailyEuros * 100) * 10_000,
    capEuros: TEST_BUDGET_TOTAL_EUROS,
    geo: hasGeo
      ? {
          kind: "proximity",
          latMicro: Math.round((lead.lat as number) * 1_000_000),
          lonMicro: Math.round((lead.lon as number) * 1_000_000),
          radiusKm,
        }
      : { kind: "city", ville },
    languageConstant: LANGUAGE_FR,
    finalUrl: normalizeUrl(lead.site_url),
    callPhoneE164: toE164FR(lead.phone),
    // Provisoire : pas d'historique de conversion → Maximize Clicks (cf. spec §9).
    biddingStrategy: "MAXIMIZE_CLICKS",
    cpcCeilingMicros: 0,
  };
}
