import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import LaunchButton from "./LaunchButton";

export const dynamic = "force-dynamic";

const euro = (n: number | null | undefined) => (n ?? 0).toLocaleString("fr-FR");

export default async function RapportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!supabaseAdminConfigured) {
    return <Centered>Configuration serveur manquante.</Centered>;
  }
  const { data: lead } = await supabaseAdmin.from("eligibilite_leads").select("*").eq("id", id).single();
  if (!lead) return <Centered>Analyse introuvable.</Centered>;

  // Marque la consultation (idempotent : seulement si pas déjà lancé).
  if (lead.status === "submitted") {
    await supabaseAdmin
      .from("eligibilite_leads")
      .update({ status: "report_viewed", report_viewed_at: new Date().toISOString() })
      .eq("id", id);
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-slate-100 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="text-xs tracking-[0.2em] text-slate-500">LOKADS · ANALYSE</p>
        <h1 className="mt-2 text-2xl font-bold">
          {lead.first_name || "Bonjour"}, vous êtes éligible. 📊
        </h1>
        <p className="mt-2 text-slate-400">
          On a regardé votre activité de <b className="text-slate-200">{lead.metier}</b> sur{" "}
          <b className="text-slate-200">{lead.ville} + {lead.radius_km ?? 10} km</b>. Estimation à partir de
          performances moyennes — ce n'est pas une garantie.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Revenu add." value={`+${euro(lead.revenue_month)} €`} sub="/ mois" />
          <Stat label="Demandes" value={`~${lead.calls_per_month ?? 0}`} sub="/ mois" />
          <Stat label="Budget Google" value={`${lead.budget_daily ?? 0} €`} sub="/ jour" />
        </div>

        <div className="mt-6 rounded-2xl border border-[#2a2a35] bg-[#13131a] p-5">
          <p className="text-xs tracking-widest text-orange-400">SERVICE CIBLÉ · RECOMMANDÉ</p>
          <h2 className="mt-1 text-lg font-bold">{lead.service_cible}</h2>
          <p className="mt-2 text-sm text-slate-400">{lead.service_reason}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Mini label="Zone ciblée" value={`${lead.ville} + ${lead.radius_km ?? 10} km`} />
            <Mini label="Budget conseillé" value={`${lead.budget_daily ?? 0} €/j · ${euro(lead.budget_monthly)} €/mois`} />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 text-center">
          <h3 className="text-lg font-bold">Prêt à lancer votre campagne ?</h3>
          <p className="mt-1 text-sm text-slate-400">
            5 minutes pour configurer. La 1ʳᵉ semaine est offerte, sans CB.
          </p>
          <div className="mt-4">
            <LaunchButton id={lead.id} alreadyLaunched={lead.status === "launched"} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-600">
          Version démo (clone Lokads) — scrapProsp.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#13131a] p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
      <div className="mt-1 text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0b0b0f] text-slate-300 flex items-center justify-center p-6 text-center">
      {children}
    </main>
  );
}
