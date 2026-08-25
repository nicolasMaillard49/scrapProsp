import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendTelegram } from "@/app/lib/notify";
import { escapeHtml } from "@/app/lib/adsLeads";
import {
  uploadClickConversion,
  restateConversionValue,
  withinUploadWindow,
} from "@/app/lib/googleAds/conversions";

/**
 * POST /api/leads/qualify
 * Body : { token, status: "signe" | "perdu", amount? }  — montant en euros.
 *
 * Le geste de l'artisan, depuis le lien reçu dans sa notification. C'est le seul
 * maillon humain de toute la chaîne : sans lui, Google ne voit que des clics et
 * jamais un euro.
 *
 * Authentifié par le jeton du lien lui-même — il est long, aléatoire, et ne
 * donne accès qu'à cette demande-là. On ne demande pas un mot de passe à
 * quelqu'un qui répond depuis un chantier.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const status = body.status === "perdu" ? "perdu" : "signe";
  if (!token) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });

  const euros = Number(body.amount);
  if (status === "signe" && (!Number.isFinite(euros) || euros <= 0)) {
    return NextResponse.json({ error: "Montant du chantier requis" }, { status: 422 });
  }
  if (status === "signe" && euros > 1_000_000) {
    return NextResponse.json({ error: "Montant invraisemblable — vérifie la saisie" }, { status: 422 });
  }

  const { data: lead } = await supabaseAdmin
    .from("ads_leads")
    .select(
      "id, client_slug, name, gclid, received_at, status, amount_cents, sale_uploaded_at, sale_amount_cents",
    )
    .eq("token", token)
    .single();
  if (!lead) return NextResponse.json({ error: "Lien inconnu ou expiré" }, { status: 404 });

  const cents = status === "signe" ? Math.round(euros * 100) : null;

  const { error: majErr } = await supabaseAdmin
    .from("ads_leads")
    .update({ status, amount_cents: cents, qualified_at: new Date().toISOString() })
    .eq("id", lead.id);
  if (majErr) {
    console.error("[leads] qualification non enregistrée", majErr);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }

  // Un devis perdu ne remonte rien : Google n'apprend que ce qui a rapporté.
  if (status === "perdu") {
    await sendTelegram(`❌ <b>${escapeHtml(lead.name)}</b> — devis perdu.`);
    return NextResponse.json({ ok: true, status });
  }

  const { data: client } = await supabaseAdmin
    .from("ads_clients")
    .select("customer_id, action_sale, label")
    .eq("slug", lead.client_slug)
    .single();

  const clique = new Date(lead.received_at);
  let resultat;

  if (lead.sale_uploaded_at) {
    // Déjà remontée : l'artisan corrige un montant. On restate au lieu de
    // renvoyer, sinon Google compterait deux chantiers pour un seul.
    resultat = await restateConversionValue({
      customerId: client?.customer_id || "",
      conversionAction: client?.action_sale || "",
      orderId: lead.id,
      originalAt: new Date(lead.sale_uploaded_at),
      at: new Date(),
      valueEuros: euros,
    });
  } else if (!withinUploadWindow(clique)) {
    // Le clic a plus de 90 jours : Google refusera. On l'écrit noir sur blanc
    // plutôt que de laisser croire à une remontée silencieuse.
    resultat = { ok: false, error: "Clic de plus de 90 jours — Google refuse l'import" };
  } else {
    resultat = await uploadClickConversion({
      customerId: client?.customer_id || "",
      conversionAction: client?.action_sale || "",
      gclid: lead.gclid || "",
      at: new Date(),
      orderId: lead.id,
      valueEuros: euros,
    });
  }

  if (resultat.ok) {
    await supabaseAdmin
      .from("ads_leads")
      .update({
        sale_uploaded_at: new Date().toISOString(),
        sale_amount_cents: cents,
        upload_error: null,
      })
      .eq("id", lead.id);
  } else if (!resultat.skipped) {
    console.error("[leads] valeur non remontée", resultat.error);
    await supabaseAdmin.from("ads_leads").update({ upload_error: resultat.error }).eq("id", lead.id);
  }

  await sendTelegram(
    `✅ <b>${escapeHtml(lead.name)}</b> — devis signé, ${euros.toLocaleString("fr-FR")} €.` +
      (resultat.ok
        ? "\nValeur remontée à Google."
        : `\n⚠️ Valeur non remontée : ${escapeHtml(resultat.error || "raison inconnue")}`),
  );

  // L'artisan a fait son geste : on le remercie même si notre envoi a échoué.
  // C'est notre problème, pas le sien, et l'information est en base.
  return NextResponse.json({ ok: true, status, uploaded: resultat.ok });
}
