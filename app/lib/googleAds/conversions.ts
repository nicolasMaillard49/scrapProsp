/**
 * Remontée des conversions hors ligne, par le gclid.
 *
 * Google ne sait pas qu'un devis a rapporté 4 200 € : c'est nous qui le lui
 * disons. À chaque clic il fabrique un `gclid` — un numéro de ticket — que la
 * landing page ramasse et que la base garde. Le jour où l'artisan dit « celui-là
 * a signé », on rend le ticket avec le montant écrit dessus, et Google retrouve
 * le mot-clé, l'annonce et la commune qui ont produit ce chiffre d'affaires.
 *
 * Deux contraintes dures, qui expliquent la forme de ce module :
 *  · 90 jours. Passé ce délai après le clic, Google refuse le gclid.
 *  · 4 à 6 heures. Une action de conversion tout juste créée refuse les imports.
 *    Un envoi lancé trop tôt échoue en silence.
 */
import { clientCustomer, googleAdsConfigured } from "./client";
import { googleAdsDateTime, parisOffsetMinutes } from "../adsLeads";

export interface UploadResult {
  ok: boolean;
  /** Renseigné dès qu'on sait pourquoi ça n'est pas passé — à écrire en base. */
  error?: string;
  /** Vrai quand la configuration manque : ce n'est pas une panne, on réessaiera. */
  skipped?: boolean;
}

/** Le libellé d'erreur de Google, quand il y en a un, sinon le message brut. */
function readError(e: unknown): string {
  if (e && typeof e === "object") {
    const anyE = e as { errors?: { message?: string }[]; message?: string };
    const first = anyE.errors?.[0]?.message;
    if (first) return first;
    if (anyE.message) return anyE.message;
  }
  return String(e);
}

/**
 * `partial_failure` renvoie les rejets ligne par ligne dans la réponse au lieu
 * de faire tomber le lot. Un gclid périmé ne doit pas emporter les autres.
 */
function partialFailure(res: unknown): string | null {
  const r = res as { partial_failure_error?: { message?: string } | null };
  const msg = r?.partial_failure_error?.message;
  return msg ? msg : null;
}

interface UploadInput {
  customerId: string;
  /** L'identifiant de RESSOURCE de l'action, pas son libellé. */
  conversionAction: string;
  gclid: string;
  /** Date du fait mesuré : réception du formulaire, ou signature du devis. */
  at: Date;
  /** L'identifiant du lead. Rend l'envoi rejouable sans doubler la conversion. */
  orderId: string;
  /** Uniquement pour « Devis signé ». */
  valueEuros?: number;
}

/**
 * Envoie une conversion. Idempotent par `order_id` : rejouer le même envoi ne
 * crée pas de doublon côté Google, ce qui permet de relancer sans réfléchir.
 */
export async function uploadClickConversion(input: UploadInput): Promise<UploadResult> {
  if (!googleAdsConfigured()) return { ok: false, skipped: true, error: "Google Ads non configuré" };
  if (!input.customerId) return { ok: false, skipped: true, error: "customer_id absent" };
  if (!input.conversionAction) return { ok: false, skipped: true, error: "action de conversion absente" };
  if (!input.gclid) return { ok: false, skipped: true, error: "aucun gclid sur ce lead" };

  const customer = clientCustomer(input.customerId);
  const conversion: Record<string, unknown> = {
    gclid: input.gclid,
    conversion_action: input.conversionAction,
    conversion_date_time: googleAdsDateTime(input.at, parisOffsetMinutes(input.at)),
    order_id: input.orderId,
  };
  if (typeof input.valueEuros === "number") {
    conversion.conversion_value = input.valueEuros;
    conversion.currency_code = "EUR";
  }

  try {
    const res = await customer.conversionUploads.uploadClickConversions({
      customer_id: input.customerId,
      conversions: [conversion],
      partial_failure: true,
    } as never);
    const failed = partialFailure(res);
    return failed ? { ok: false, error: failed } : { ok: true };
  } catch (e) {
    return { ok: false, error: readError(e) };
  }
}

/**
 * Corrige la valeur d'une conversion déjà remontée — le devis annoncé à 4 200 €
 * mais facturé 5 800 €. Sans ça, Google apprendrait un ordre de grandeur au lieu
 * du montant réel, et enchérirait à côté sur les mots-clés qui rapportent.
 *
 * La conversion visée est retrouvée par `order_id`, celui de l'envoi initial.
 */
export async function restateConversionValue(input: {
  customerId: string;
  conversionAction: string;
  orderId: string;
  /** Date de l'envoi d'origine, celle qu'on a écrite en base. */
  originalAt: Date;
  at: Date;
  valueEuros: number;
}): Promise<UploadResult> {
  if (!googleAdsConfigured()) return { ok: false, skipped: true, error: "Google Ads non configuré" };
  if (!input.customerId || !input.conversionAction) {
    return { ok: false, skipped: true, error: "compte ou action de conversion absent" };
  }

  const customer = clientCustomer(input.customerId);
  try {
    const res = await customer.conversionAdjustmentUploads.uploadConversionAdjustments({
      customer_id: input.customerId,
      conversion_adjustments: [
        {
          conversion_action: input.conversionAction,
          adjustment_type: "RESTATEMENT",
          adjustment_date_time: googleAdsDateTime(input.at, parisOffsetMinutes(input.at)),
          order_id: input.orderId,
          restatement_value: { adjusted_value: input.valueEuros, currency_code: "EUR" },
        },
      ],
      partial_failure: true,
    } as never);
    const failed = partialFailure(res);
    return failed ? { ok: false, error: failed } : { ok: true };
  } catch (e) {
    return { ok: false, error: readError(e) };
  }
}

/** Un gclid de plus de 90 jours est refusé : inutile de tenter l'envoi. */
export function withinUploadWindow(clickedAt: Date, now = new Date()): boolean {
  return now.getTime() - clickedAt.getTime() < 90 * 24 * 60 * 60 * 1000;
}
