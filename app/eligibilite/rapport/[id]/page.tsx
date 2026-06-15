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
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[13px] font-extrabold tracking-[0.14em]" style={{ color: "var(--accent)" }}>NMF&nbsp;AGENCE</span>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: "var(--success)", background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.25)" }}
          >
            ✓ Éligible
          </span>
        </div>

        <h1 className="text-[26px] font-extrabold leading-tight" style={{ color: "var(--ink)", textWrap: "balance" }}>
          {lead.first_name ? `${lead.first_name}, votre` : "Votre"} potentiel sur Google.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Analyse de votre activité de <b style={{ color: "var(--ink)" }}>{lead.metier}</b> sur{" "}
          <b style={{ color: "var(--ink)" }}>{lead.ville} + {lead.radius_km ?? 10} km</b>. Estimation à partir de
          performances moyennes — ce n&apos;est pas une garantie.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Revenu add." value={`+${euro(lead.revenue_month)} €`} sub="/ mois" highlight />
          <Stat label="Demandes" value={`~${lead.calls_per_month ?? 0}`} sub="/ mois" />
          <Stat label="Budget Google" value={`${lead.budget_daily ?? 0} €`} sub="/ jour" />
        </div>

        <div className="mt-6 fnl-card p-5">
          <p className="text-[11px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>SERVICE CIBLÉ · RECOMMANDÉ</p>
          <h2 className="mt-1.5 text-lg font-extrabold" style={{ color: "var(--ink)" }}>{lead.service_cible}</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{lead.service_reason}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Mini label="Zone ciblée" value={`${lead.ville} + ${lead.radius_km ?? 10} km`} />
            <Mini label="Budget conseillé" value={`${lead.budget_daily ?? 0} €/j · ${euro(lead.budget_monthly)} €/mois`} />
          </div>
        </div>

        <div
          className="mt-8 rounded-[22px] p-6 text-center"
          style={{ background: "linear-gradient(180deg,#fff, var(--accent-soft))", border: "1px solid #ffe0c7" }}
        >
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>Prêt à lancer votre campagne ?</h3>
          <p className="mt-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            5 minutes pour configurer. La 1ʳᵉ semaine de gestion est offerte.
          </p>
          <div className="mt-5">
            <LaunchButton id={lead.id} alreadyLaunched={lead.status === "launched"} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: "var(--muted)" }}>
          NMF Agence — sites web &amp; acquisition pour artisans.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="fnl-stat" style={highlight ? { background: "var(--accent-soft)", borderColor: "#ffe0c7" } : undefined}>
      <div className="text-lg font-extrabold" style={{ color: highlight ? "var(--accent-dark)" : "var(--ink)" }}>{value}</div>
      <div className="text-[10px]" style={{ color: "var(--muted)" }}>{sub}</div>
      <div className="mt-1 text-[11px] font-medium" style={{ color: "var(--ink-soft)" }}>{label}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-semibold" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: "var(--ink-soft)" }}>
      {children}
    </main>
  );
}
