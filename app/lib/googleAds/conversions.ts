/**
 * Remontée des conversions hors ligne, par le gclid.
 *
 * Google ne sait pas qu'un devis a rapporté 4 200 € : c'est nous qui le lui
 * disons. À chaque clic il fabrique un `gclid` — un numéro de ticket — que la
 * landing page ramasse et que la base garde. Le jour où l'artisan dit « celui-là
 * a signé », on rend le ticket avec le montant écrit dessus, et Google retrouve
 * le mot-clé, l'annonce et la commune qui ont produit ce chiffre d'affaires.
 *
 * ── Deux APIs, et ce n'est pas un accident ──────────────────────────────────
 *
 * Depuis le 15/06/2026, Google a fermé `ConversionUploadService` de l'API Google
 * Ads aux nouvelles intégrations : l'ENVOI d'une conversion passe désormais par
 * la Data Manager API. Vérifié le 31/08/2026 en `validate_only` sur le compte
 * Totowood, le rejet tombant avant même toute validation du gclid.
 *
 * En revanche `ConversionAdjustmentUploadService` — un service DISTINCT — n'est
 * pas concerné. Vérifié le même jour, au même endroit : l'appel est accepté et
 * ne renvoie qu'un `CONVERSION_NOT_FOUND`, l'erreur attendue pour un `order_id`
 * de sonde. La documentation officielle ne porte aucun avis de dépréciation. La
 * Data Manager API, elle, n'expose aucun endpoint d'ajustement — sa référence ne
 * connaît que `events:ingest`, `adEvents:ingest` (Analytics, sur liste blanche)
 * et les audiences.
 *
 * D'où le partage, qui est la seule combinaison qui fonctionne aujourd'hui :
 *
 *   ENVOI       Data Manager API · events:ingest · scope datamanager
 *   AJUSTEMENT  Google Ads API · ConversionAdjustmentUploadService · scope adwords
 *
 * La couture entre les deux est l'identifiant du lead : il part en
 * `transactionId` à l'envoi et revient en `order_id` à l'ajustement. C'est par
 * lui que Google retrouve la conversion à corriger — la doc le recommande
 * explicitement plutôt que le couple gclid + date.
 *
 * ── Trois contraintes dures ─────────────────────────────────────────────────
 *  · 90 jours. Passé ce délai après le clic, Google refuse le gclid.
 *  · 4 à 6 heures. Une action de conversion tout juste créée refuse les envois
 *    comme les ajustements. Un appel lancé trop tôt échoue en silence.
 *  · Un ajustement ne peut pas créer de conversion : si l'envoi initial n'est
 *    jamais passé, la correction repart en `CONVERSION_NOT_FOUND`.
 */
import { clientCustomer, googleAdsConfigured } from "./client";
import { googleAdsDateTime, parisOffsetMinutes } from "../adsLeads";
import { dataManagerConfigured, ingestEvent } from "./dataManager";

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
 * de faire tomber le lot. Un identifiant périmé ne doit pas emporter les autres.
 */
function partialFailure(res: unknown): string | null {
  const r = res as { partial_failure_error?: { message?: string } | null };
  const msg = r?.partial_failure_error?.message;
  return msg ? msg : null;
}

interface UploadInput {
  customerId: string;
  /** L'identifiant de l'action : resource name hérité, ou numérique. */
  conversionAction: string;
  gclid: string;
  /** Date du fait mesuré : réception du formulaire, ou signature du devis. */
  at: Date;
  /** L'identifiant du lead. Rend l'envoi rejouable sans doubler la conversion. */
  orderId: string;
  /** Uniquement pour « Devis signé ». */
  valueEuros?: number;
  /** Valide la requête auprès de Google sans rien écrire. */
  validateOnly?: boolean;
}

/**
 * Envoie une conversion, par la Data Manager API.
 *
 * `transactionId` porte l'identifiant du lead : Google déduplique dessus, ce qui
 * rend l'envoi rejouable sans compter deux fois. C'est aussi la clé que
 * `restateConversionValue` réutilisera en `order_id`.
 */
export async function uploadClickConversion(input: UploadInput): Promise<UploadResult> {
  if (!dataManagerConfigured()) return { ok: false, skipped: true, error: "Google non configuré" };

  return ingestEvent({
    operatingAccountId: (input.customerId || "").replace(/-/g, ""),
    conversionAction: input.conversionAction,
    gclid: input.gclid,
    at: input.at,
    offsetMinutes: parisOffsetMinutes(input.at),
    transactionId: input.orderId,
    valueEuros: input.valueEuros,
    validateOnly: input.validateOnly,
  });
}

/**
 * Corrige la valeur d'une conversion déjà remontée — le devis annoncé à 4 200 €
 * mais facturé 5 800 €. Sans ça, Google apprendrait un ordre de grandeur au lieu
 * du montant réel, et enchérirait à côté sur les mots-clés qui rapportent.
 *
 * Passe par l'API Google Ads, pas par la Data Manager : voir l'en-tête du
 * fichier. `RESTATEMENT` change la valeur sans toucher au compte de conversions
 * — c'est bien ce qu'on veut, le chantier reste un chantier.
 *
 * La conversion visée est retrouvée par `order_id`, celui de l'envoi initial.
 * Deux conséquences à garder en tête : une correction sur un lead dont l'envoi
 * n'est jamais passé repart en `CONVERSION_NOT_FOUND`, et une conversion déjà
 * ramenée à zéro ne peut plus être ajustée — Google ignore alors l'appel sans
 * message d'erreur.
 */
export async function restateConversionValue(input: {
  customerId: string;
  conversionAction: string;
  orderId: string;
  /** Date de l'envoi d'origine, celle qu'on a écrite en base. */
  originalAt: Date;
  at: Date;
  valueEuros: number;
  validateOnly?: boolean;
}): Promise<UploadResult> {
  if (!googleAdsConfigured()) return { ok: false, skipped: true, error: "Google Ads non configuré" };
  if (!input.customerId || !input.conversionAction) {
    return { ok: false, skipped: true, error: "compte ou action de conversion absent" };
  }

  const customerId = input.customerId.replace(/-/g, "");
  const customer = clientCustomer(customerId);
  try {
    const res = await customer.conversionAdjustmentUploads.uploadConversionAdjustments({
      customer_id: customerId,
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
      validate_only: !!input.validateOnly,
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
