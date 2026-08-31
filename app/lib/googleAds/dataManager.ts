/**
 * Data Manager API — la porte d'entrée des conversions hors ligne depuis le
 * 15 juin 2026.
 *
 * Google a fermé `ConversionUploadService.UploadClickConversions` de l'API
 * Google Ads aux nouvelles intégrations. Constaté le 31/08/2026 sur le compte
 * Totowood, en `validate_only`, avant même toute validation du gclid :
 *
 *   « New integrations for uploading click conversions should use the Data
 *     Manager API. Usage of ConversionUploadService.UploadClickConversions is
 *     limited to existing users. »
 *
 * Ce n'est pas une bascule de configuration : l'endpoint, l'authentification et
 * la forme de la requête changent tous les trois.
 *
 *   ancien   Google Ads API · scope adwords · developer token · resource name
 *   nouveau  datamanager.googleapis.com/v1/events:ingest · scope datamanager
 *            · pas de developer token · identifiant NUMÉRIQUE de l'action
 *
 * Le jeton de rafraîchissement doit porter le scope `datamanager` EN PLUS de
 * `adwords`, qui reste nécessaire à la création de campagnes (campaign.ts,
 * create.ts). Un jeton qui ne porte que `adwords` se fait renvoyer un 403
 * ACCESS_TOKEN_SCOPE_INSUFFICIENT. Voir scripts/google-oauth-consent.mjs.
 */

/** Le MCC sous lequel on opère, et qui porte l'autorisation. */
const LOGIN_ACCOUNT = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");

const ENDPOINT = "https://datamanager.googleapis.com/v1/events:ingest";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const DATA_MANAGER_SCOPE = "https://www.googleapis.com/auth/datamanager";

export function dataManagerConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

/*
 * Un access token vit une heure. On le garde en mémoire du processus avec une
 * marge d'une minute : sur une fonction serverless réutilisée, ça évite un
 * aller-retour OAuth à chaque lead sans jamais servir un jeton périmé.
 */
let cache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.token;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `OAuth HTTP ${res.status}`);
  }
  /*
   * Le scope manquant ne se voit qu'au 403 de l'appel suivant, dont le message
   * ne dit pas lequel manque. On le dit ici, où on a la réponse sous les yeux.
   */
  if (body.scope && !body.scope.includes(DATA_MANAGER_SCOPE)) {
    throw new Error(
      `le jeton ne porte pas le scope ${DATA_MANAGER_SCOPE} — rejouer scripts/google-oauth-consent.mjs`
    );
  }
  cache = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(0, (body.expires_in || 3600) - 60) * 1000,
  };
  return cache.token;
}

/**
 * La base garde l'identifiant de ressource complet, hérité de l'API Google Ads
 * (`customers/3702463294/conversionActions/7741078076`). Data Manager veut le
 * dernier segment, en numérique. On convertit ici plutôt que de migrer la base :
 * la colonne reste lisible, et l'ancien format documente d'où vient l'action.
 */
export function conversionActionId(resourceOrId: string): string {
  const m = String(resourceOrId).match(/conversionActions\/(\d+)/);
  if (m) return m[1];
  return String(resourceOrId).replace(/\D/g, "");
}

/** RFC 3339. `googleAdsDateTime` produit la même chose avec un espace. */
export function rfc3339(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}T` +
    `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}` +
    `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}

export interface IngestInput {
  /** Le compte client, sans tirets. */
  operatingAccountId: string;
  /** Resource name ou identifiant numérique : les deux sont acceptés. */
  conversionAction: string;
  gclid: string;
  at: Date;
  offsetMinutes: number;
  /** Notre identifiant de lead. Porte la déduplication côté Google. */
  transactionId: string;
  valueEuros?: number;
  /**
   * Horodatage de dernière modification de l'événement. Non utilisé pour
   * corriger une valeur : la correction passe par l'API Google Ads, seule à
   * offrir un vrai `RESTATEMENT` (voir conversions.ts).
   */
  lastUpdatedAt?: Date;
  /** Valide la requête sans rien écrire. */
  validateOnly?: boolean;
}

export interface IngestResult {
  ok: boolean;
  error?: string;
  /** Vrai quand la configuration manque : ce n'est pas une panne, on réessaiera. */
  skipped?: boolean;
}

/**
 * Envoie un événement de conversion.
 *
 * `consent` est requis par l'API. On déclare le consentement accordé : le
 * formulaire porte la mention d'information et la conversion ne remonte qu'un
 * gclid, jamais de donnée personnelle — `userData` est délibérément absent, ce
 * qui évite d'avoir à hacher quoi que ce soit et garde l'envoi minimal.
 */
export async function ingestEvent(input: IngestInput): Promise<IngestResult> {
  if (!dataManagerConfigured()) return { ok: false, skipped: true, error: "Google non configuré" };
  if (!input.operatingAccountId) return { ok: false, skipped: true, error: "customer_id absent" };
  if (!input.conversionAction) return { ok: false, skipped: true, error: "action de conversion absente" };
  if (!input.gclid) return { ok: false, skipped: true, error: "aucun gclid sur ce lead" };

  const event: Record<string, unknown> = {
    eventTimestamp: rfc3339(input.at, input.offsetMinutes),
    transactionId: input.transactionId,
    adIdentifiers: { gclid: input.gclid },
    eventSource: "WEB",
  };
  if (typeof input.valueEuros === "number") {
    event.conversionValue = input.valueEuros;
    event.currency = "EUR";
  }
  if (input.lastUpdatedAt) {
    event.lastUpdatedTimestamp = rfc3339(input.lastUpdatedAt, input.offsetMinutes);
  }

  const payload = {
    destinations: [
      {
        operatingAccount: { accountType: "GOOGLE_ADS", accountId: input.operatingAccountId },
        loginAccount: { accountType: "GOOGLE_ADS", accountId: LOGIN_ACCOUNT },
        productDestinationId: conversionActionId(input.conversionAction),
      },
    ],
    events: [event],
    validateOnly: !!input.validateOnly,
    consent: { adPersonalization: "CONSENT_GRANTED", adUserData: "CONSENT_GRANTED" },
  };

  let token: string;
  try {
    token = await accessToken();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      /* Les rejets ligne par ligne, quand la requête elle-même passe. */
      errors?: unknown[];
    };
    if (!res.ok) {
      return { ok: false, error: body.error?.message || `HTTP ${res.status}` };
    }
    if (Array.isArray(body.errors) && body.errors.length) {
      return { ok: false, error: JSON.stringify(body.errors[0]) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
