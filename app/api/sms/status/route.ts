import { NextRequest } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

/**
 * Webhook Twilio (POST x-www-form-urlencoded) appelé à chaque changement de
 * statut d'un SMS sortant : queued -> sent -> delivered (ou undelivered/failed).
 * On met à jour la ligne `sms_messages` correspondante par `twilio_sid`.
 *
 * Branché via le paramètre `statusCallback` passé à `messages.create`
 * (cf. /api/sms et /api/blast). Route publique : Twilio n'envoie pas de cookie,
 * elle est donc exemptée dans middleware.ts.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return new Response("", { status: 200 });

  const form = await req.formData();
  const sid = String(form.get("MessageSid") ?? "");
  const status = String(form.get("MessageStatus") ?? "");

  if (sid && status) {
    try {
      await supabase.from("sms_messages").update({ status }).eq("twilio_sid", sid);
    } catch (e) {
      console.error("[sms/status] update failed:", e);
    }
  }

  return new Response("", { status: 200 });
}
