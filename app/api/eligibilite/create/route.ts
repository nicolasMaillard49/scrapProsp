import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { twilioClient, twilioConfigured, messagingServiceSid } from "@/app/lib/twilio";
import { toE164 } from "@/app/lib/sms";
import { makeToken, appBase } from "@/app/lib/eligibilite";
import { sendTelegram } from "@/app/lib/notify";

/**
 * POST /api/eligibilite/create  { prospectId: string, dryRun?: boolean }
 * Génère un formulaire d'éligibilité pour un prospect et lui envoie le lien par SMS.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }
  let body: { prospectId?: string; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const prospectId = body.prospectId;
  if (!prospectId) return NextResponse.json({ error: "prospectId requis" }, { status: 400 });

  const { data: prospect, error: pErr } = await supabase
    .from("prospects")
    .select("id, name, metier, ville, phone")
    .eq("id", prospectId)
    .single();
  if (pErr || !prospect) return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });

  const token = makeToken();
  const formUrl = `${appBase()}/eligibilite/${token}`;
  const message =
    `${prospect.name || "Bonjour"}, votre place ${prospect.metier || ""} sur ${prospect.ville || "votre ville"} ` +
    `est peut-être encore libre. Vérifiez en 2 min : ${formUrl}`;

  // Aperçu seul : ne crée pas de lead (sinon une ligne orpheline par clic « aperçu »).
  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, token, formUrl, message });
  }

  const { data: lead, error: lErr } = await supabaseAdmin
    .from("eligibilite_leads")
    .insert({
      prospect_id: prospect.id,
      token,
      metier: prospect.metier,
      ville: prospect.ville,
      phone: prospect.phone,
      status: "created",
    })
    .select()
    .single();
  if (lErr || !lead) return NextResponse.json({ error: lErr?.message || "Création échouée" }, { status: 500 });

  // Envoi SMS
  if (!twilioConfigured) {
    return NextResponse.json({ ok: true, smsSent: false, reason: "Twilio non configuré", leadId: lead.id, formUrl });
  }
  const to = toE164(prospect.phone);
  if (!to) return NextResponse.json({ error: "Téléphone prospect invalide" }, { status: 400 });

  try {
    const sms = await twilioClient().messages.create({ to, body: message, messagingServiceSid });
    await supabaseAdmin
      .from("eligibilite_leads")
      .update({ status: "sms_sent", sms_sent_at: new Date().toISOString() })
      .eq("id", lead.id);
    // Même lien formulaire envoyé sur mon Telegram pour pouvoir l'ouvrir vite.
    await sendTelegram(
      `📩 Lien éligibilité envoyé — ${prospect.metier || ""} ${prospect.ville || ""} — ${prospect.phone || ""}\n${formUrl}`,
    );
    return NextResponse.json({ ok: true, smsSent: true, sid: sms.sid, leadId: lead.id, token, formUrl });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Echec SMS", leadId: lead.id, formUrl },
      { status: 502 }
    );
  }
}
