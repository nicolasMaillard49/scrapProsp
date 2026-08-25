import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendTelegram } from "@/app/lib/notify";
import { sendEmail } from "@/app/lib/email";
import { parseLead, leadNotification, makeToken, escapeHtml } from "@/app/lib/adsLeads";
import { uploadClickConversion } from "@/app/lib/googleAds/conversions";

/**
 * POST /api/leads
 *
 * Réception d'une demande de devis venue d'une landing page Google Ads. C'est
 * l'endpoint que `LEAD_FORWARD_URL` désigne côté projet des landing pages.
 *
 * Trois choses, dans cet ordre, et la première seule est bloquante :
 *  1. écrire le lead — sans ça la demande est perdue ;
 *  2. prévenir l'artisan, avec le lien de qualification ;
 *  3. rendre le ticket à Google — « Demande de devis », à J0.
 *
 * Un échec sur 2 ou 3 ne fait jamais échouer la requête : le lead est déjà en
 * base, la conversion se rattrape, la notification se relit. Ce qu'on refuse,
 * c'est de répondre `ok` sans avoir écrit.
 *
 * Authentification par jeton partagé, en `Authorization: Bearer`. La route est
 * ouverte dans le middleware, donc c'est ce contrôle-ci qui la protège.
 */

export const dynamic = "force-dynamic";

const SECRET = process.env.LEAD_INGEST_SECRET ?? "";

/** L'origine du lien de qualification, celle que l'artisan ouvrira. */
const PUBLIC_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://scrap-prosp.vercel.app").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "LEAD_INGEST_SECRET non configuré" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const slug = typeof body.client === "string" && body.client ? body.client : "totowood";
  const parsed = parseLead(body, slug, makeToken());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const row = parsed.row;

  const { data: client } = await supabaseAdmin
    .from("ads_clients")
    .select("slug, label, customer_id, action_request, notify_email, notify_telegram")
    .eq("slug", slug)
    .single();
  if (!client) {
    return NextResponse.json({ error: `Client « ${slug} » inconnu` }, { status: 404 });
  }

  // ── 1. Écrire. Le seul échec qui doit remonter au formulaire.
  const { data: lead, error } = await supabaseAdmin
    .from("ads_leads")
    .insert(row)
    .select("id, token, received_at")
    .single();

  if (error) {
    // 23505 = doublon sur l'index anti-rejeu (même numéro, même heure). Le
    // visiteur a cliqué deux fois : sa demande est déjà passée, on le rassure.
    if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[leads] écriture impossible", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }

  const qualifyUrl = `${PUBLIC_URL}/q/${lead.token}`;

  // ── 2. Prévenir. Un lead qu'on n'annonce pas est un lead qu'on rappelle trop tard.
  const texte = leadNotification(row, client.label, qualifyUrl);
  const taches: Promise<unknown>[] = [];
  if (client.notify_telegram) taches.push(sendTelegram(texte));
  if (client.notify_email) {
    taches.push(
      sendEmail({
        to: client.notify_email,
        subject: `${client.label} — nouvelle demande de devis : ${row.name}`,
        html:
          `<p><b>${escapeHtml(row.name)}</b> — <a href="tel:${escapeHtml(row.phone)}">${escapeHtml(row.phone)}</a>` +
          (row.commune ? ` · ${escapeHtml(row.commune)}` : "") +
          `</p><p>${escapeHtml(row.message).replace(/\n/g, "<br>")}</p>` +
          `<p><a href="${qualifyUrl}">Ce devis a été signé →</a></p>`,
      }),
    );
  }

  // ── 3. Rendre le ticket à Google, tout de suite. À J0 on est très loin de la
  // limite des 90 jours, et le compte a du signal dès la première semaine.
  const envoi = uploadClickConversion({
    customerId: client.customer_id || "",
    conversionAction: client.action_request || "",
    gclid: row.gclid || "",
    at: new Date(lead.received_at),
    orderId: lead.id,
  });

  const [, resultat] = await Promise.all([Promise.allSettled(taches), envoi]);

  if (resultat.ok) {
    await supabaseAdmin
      .from("ads_leads")
      .update({ request_uploaded_at: new Date().toISOString(), upload_error: null })
      .eq("id", lead.id);
  } else if (!resultat.skipped) {
    console.error("[leads] conversion non remontée", resultat.error);
    await supabaseAdmin.from("ads_leads").update({ upload_error: resultat.error }).eq("id", lead.id);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}
