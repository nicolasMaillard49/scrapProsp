/**
 * Envoi d'emails transactionnels via Resend (https://resend.com).
 *
 * Setup (gratuit) :
 *  1. Crée un compte Resend, récupère une API key -> RESEND_API_KEY.
 *  2. EN TEST : laisse RESEND_FROM vide -> on utilise "onboarding@resend.dev"
 *     (fonctionne sans domaine vérifié, mais n'envoie qu'à TON adresse de compte Resend).
 *  3. EN PROD : vérifie ton domaine dans Resend, puis RESEND_FROM="Lokads <noreply@tondomaine.fr>".
 *
 * Sans RESEND_API_KEY -> no-op silencieux (renvoie {ok:false, skipped:true}).
 */

const API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.RESEND_FROM || "Eligibilité <onboarding@resend.dev>";

export const emailConfigured = !!API_KEY;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  if (!emailConfigured) return { ok: false, skipped: true, error: "RESEND_API_KEY manquant" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        reply_to: input.replyTo,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
