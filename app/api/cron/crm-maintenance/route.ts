import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { sendEmail } from "@/app/lib/email";
import {
  maintenancesDues,
  maintenanceReminderEmail,
  type MaintenanceClient,
} from "@/app/lib/crmMaintenance";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = !!secret && (
    req.headers.get("x-cron-secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}`
  );
  if (!authorized) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const { data, error } = await supabase
    .from("clients")
    .select("id, nom, maintenance_ht, maintenance_day")
    .gt("maintenance_ht", 0)
    .not("maintenance_day", "is", null)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dues = maintenancesDues((data ?? []) as MaintenanceClient[], new Date());
  if (!dues.length) return NextResponse.json({ ok: true, due: 0, sent: false });

  // Une facture déjà encaissée pour ce mois éteint le rappel. Une facture
  // absente ou encore ouverte reste à traiter : l'email sert précisément à ne
  // pas oublier de l'émettre ou de vérifier le virement.
  const periode = `${dues[0].due_date.slice(0, 7)}-01`;
  const { data: invoices, error: invoiceError } = await supabase
    .from("client_invoices")
    .select("client_id, paid_at")
    .in("client_id", dues.map((row) => row.id))
    .eq("periode", periode);
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 });

  const paid = new Set((invoices ?? []).filter((row) => row.paid_at).map((row) => row.client_id as string));
  const pending = dues.filter((row) => !paid.has(row.id));
  if (!pending.length) return NextResponse.json({ ok: true, due: dues.length, pending: 0, sent: false });

  const email = maintenanceReminderEmail(pending);
  if (req.nextUrl.searchParams.get("dry") === "1") {
    return NextResponse.json({ dry: true, due: dues.length, pending: pending.length, subject: email.subject });
  }

  // Variable dédiée en priorité ; EMAIL_BCC garde la compatibilité avec la
  // configuration Resend déjà posée pour recevoir les emails du funnel.
  const recipient = (process.env.CRM_ALERT_EMAIL || process.env.EMAIL_BCC || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
  if (!recipient) return NextResponse.json({ error: "CRM_ALERT_EMAIL non configuré" }, { status: 503 });

  const result = await sendEmail({ to: recipient, subject: email.subject, html: email.html });
  if (!result.ok) return NextResponse.json({ error: result.error || "Email non envoyé" }, { status: 502 });
  return NextResponse.json({ ok: true, due: dues.length, pending: pending.length, sent: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
