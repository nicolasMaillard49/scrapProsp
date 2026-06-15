/**
 * Client Google Ads (lib google-ads-api). On opère via le MCC 671 "NMF Agence"
 * (login_customer_id), le dev token étant porté par le MCC 781. API v22.
 */
import { GoogleAdsApi, type Customer } from "google-ads-api";

export const MCC_ID = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");

export function googleAdsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

let _api: GoogleAdsApi | null = null;
function api(): GoogleAdsApi {
  if (!_api) {
    _api = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    });
  }
  return _api;
}

/** Le MCC 671 lui-même (création de comptes clients, requêtes manager). */
export function mccCustomer(): Customer {
  return api().Customer({
    customer_id: MCC_ID,
    login_customer_id: MCC_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
  });
}

/** Un compte client (enfant du MCC), pour créer budget/campagne/ad group… */
export function clientCustomer(customerId: string): Customer {
  return api().Customer({
    customer_id: customerId.replace(/-/g, ""),
    login_customer_id: MCC_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
  });
}
