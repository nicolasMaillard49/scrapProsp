import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { sendEmail } from "@/app/lib/email";
import { sendTelegram } from "@/app/lib/notify";
import {
  geocodeVille,
  generateAnalysis,
  computeScore,
  confirmationEmailHtml,
} from "@/app/lib/eligibilite";

/**
 * POST /api/eligibilite/submit
 * Body : { token, radius_km, site_url, employees_range, ca_range, ad_budget_range,
 *          goal_range, first_name, last_name, email, phone }
 * Enregistre les réponses, géocode, génère l'analyse, envoie l'email de confirmation.
 * Renvoie { id } pour rediriger vers la page rapport.
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase (clé secrète) non configuré" }, { status: 503 });
  }
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const token = String(b.token || "");
  if (!token) return NextResponse.json({ error: "token requis" }, { status: 400 });

  const { data: lead, error } = await supabaseAdmin
    .from("eligibilite_leads")
    .select("*")
    .eq("token", token)
    .single();
  if (error || !lead) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });

  const ville = (b.ville as string) || lead.ville;
  const metier = (b.metier as string) || lead.metier;
  const radius_km = Number(b.radius_km) || 10;
  const ad_budget_range = (b.ad_budget_range as string) || "lt_500";

  // Géocodage + analyse en parallèle.
  const [geo, analysis] = await Promise.all([
    geocodeVille(ville || ""),
    generateAnalysis({ metier, ville, radius_km, ad_budget_range }),
  ]);

  const answers = {
    metier,
    ville,
    radius_km,
    site_url: (b.site_url as string) || null,
    employees_range: (b.employees_range as string) || null,
    ca_range: (b.ca_range as string) || null,
    ad_budget_range,
    goal_range: (b.goal_range as string) || null,
    first_name: (b.first_name as string) || null,
    last_name: (b.last_name as string) || null,
    email: (b.email as string) || null,
    phone: (b.phone as string) || lead.phone,
  };

  const { data: updated, error: uErr } = await supabaseAdmin
    .from("eligibilite_leads")
    .update({
      ...answers,
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      service_cible: analysis.service_cible,
      service_reason: analysis.service_reason,
      budget_daily: analysis.budget_daily,
      budget_monthly: analysis.budget_monthly,
      calls_per_month: analysis.calls_per_month,
      revenue_month: analysis.revenue_month,
      score: computeScore(answers),
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .select()
    .single();
  if (uErr || !updated) return NextResponse.json({ error: uErr?.message || "Enregistrement échoué" }, { status: 500 });

  // Email de confirmation ("tout a été pris en compte" + lien rapport).
  if (updated.email) {
    const { subject, html } = confirmationEmailHtml(updated);
    const r = await sendEmail({ to: updated.email, subject, html });
    if (!r.ok) console.error(`[eligibilite/submit] email confirmation NON envoyé à ${updated.email}:`, r.error || (r.skipped ? "skipped (config manquante)" : "?"));
    else console.log(`[eligibilite/submit] email confirmation envoyé à ${updated.email} (id ${r.id})`);
  } else {
    console.warn(`[eligibilite/submit] lead ${updated.id} sans email → aucune confirmation envoyée`);
  }
  // Notif interne temps réel.
  await sendTelegram(
    `🔥 Lead éligibilité — <b>${updated.metier || ""}</b> ${updated.ville || ""} — score ${updated.score} — ` +
      `${updated.phone || ""} ${updated.email || ""}`
  );

  return NextResponse.json({ ok: true, id: updated.id });
}
