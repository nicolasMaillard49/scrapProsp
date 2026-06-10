import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { sendTelegram } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

/** Tolérance sur l'horodatage de la signature Stripe (rejoue d'anciens events sinon). */
const TOLERANCE_S = 300;

/**
 * Vérification manuelle de la signature Stripe (header `stripe-signature`,
 * format `t=...,v1=...`) : HMAC-SHA256(secret, "{t}.{payload}").
 * Évite d'embarquer le SDK stripe pour un seul endpoint.
 */
function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  const parts = new Map(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_S) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook Stripe : encaissement d'une démo via le bouton « Je le veux »
 * (Payment Link avec ?client_reference_id={prospectId}).
 * checkout.session.completed -> prospect en `positive` + paid_at + notif Telegram.
 *
 * À configurer dans Stripe Dashboard > Developers > Webhooks :
 *   https://prospects.nmf-agence.com/api/stripe/webhook (event checkout.session.completed)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET non configuré" }, { status: 503 });
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object ?? {};
    const prospectId = (session.client_reference_id as string | null) ?? null;
    const amount = typeof session.amount_total === "number" ? session.amount_total / 100 : null;

    if (prospectId) {
      const { data: prospect } = await supabase
        .from("prospects")
        .select("id, name, ville, phone, paid_at")
        .eq("id", prospectId)
        .single();

      // Idempotence : Stripe rejoue les webhooks non-2xx / réseau — ne pas re-notifier.
      if (prospect && !prospect.paid_at) {
        await supabase
          .from("prospects")
          .update({ status: "positive", paid_at: new Date().toISOString() })
          .eq("id", prospectId);
        await sendTelegram(
          `💰💰💰 <b>PAIEMENT REÇU</b>\n<b>${prospect.name}</b> (${prospect.ville}) a payé${amount != null ? ` ${amount} €` : ""} directement depuis sa démo.\n📞 ${prospect.phone} — appelle-le pour lancer le projet !`,
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
