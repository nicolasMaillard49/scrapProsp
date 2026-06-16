/**
 * Écritures RÉELLES Google Ads (Phase 2). Isolé de campaign.ts pour rester lisible.
 * - createOrReuseAccount : sous-compte sous le MCC 671 (idempotent par lead).
 * - inviteUser : invite l'email du lead -> Google envoie son email d'invitation.
 * - createPausedCampaign : campagne PAUSED (Task 4).
 */
import { enums } from "google-ads-api";
import { mccCustomer, clientCustomer, MCC_ID } from "./client";
import { existingCustomerForLead } from "./persistence";
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
