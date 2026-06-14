import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendEmail } from "@/app/lib/email";
import { sendTelegram } from "@/app/lib/notify";
import { launchEmailHtml } from "@/app/lib/eligibilite";

/**
 * POST /api/eligibilite/launch  { id: string }
 * Marque la campagne comme "lancée" et envoie le 2e email (activation).
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }
  let b: { id?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { data: lead, error } = await supabaseAdmin
    .from("eligibilite_leads")
    .update({ status: "launched", launched_at: new Date().toISOString() })
    .eq("id", b.id)
    .select()
    .single();
  if (error || !lead) return NextResponse.json({ error: error?.message || "Lead introuvable" }, { status: 404 });

  if (lead.email) {
    const { subject, html } = launchEmailHtml(lead);
    await sendEmail({ to: lead.email, subject, html });
  }
  await sendTelegram(`🚀 Campagne lancée — ${lead.metier || ""} ${lead.ville || ""} — ${lead.phone || ""}`);

  return NextResponse.json({ ok: true });
}
