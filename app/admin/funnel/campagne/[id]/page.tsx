import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, AlertTriangle } from "lucide-react";
import { getTrackedCampaign } from "@/app/lib/googleAds/persistence";
import { fetchCampaignReport, emptyReport, type Metrics, type CampaignReport } from "@/app/lib/googleAds/report";
import type { PlanLike } from "../../LeadAdsPanel";
import CampaignChat from "./CampaignChat";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  SERVING: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  ENABLED: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  PENDING: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  PAUSED: "bg-slate-500/15 border-slate-500/40 text-slate-300",
  SUSPENDED: "bg-rose-500/15 border-rose-500/40 text-rose-300",
  ENDED: "bg-slate-500/15 border-slate-500/40 text-slate-400",
};
const APPROVAL_TONE: Record<string, string> = {
  APPROVED: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  APPROVED_LIMITED: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  UNDER_REVIEW: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  AREA_OF_INTEREST_ONLY: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  DISAPPROVED: "bg-rose-500/15 border-rose-500/40 text-rose-300",
};

function eur(n: number) {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}
function pct(r: number | null) {
  return r == null ? "—" : `${(r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camp = await getTrackedCampaign(id);
  if (!camp) notFound();

  const report: CampaignReport = camp.customer_id
    ? await fetchCampaignReport(camp.customer_id, camp.campaign_id)
    : emptyReport(camp.campaign_id, ["Compte client inconnu : pas de données live."]);

  const plan = camp.plan as PlanLike | null;
  const c = report.campaign;
  const dailyBudget = report.budget.dailyEur ?? camp.daily_budget;

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/funnel" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Console funnel
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Megaphone className="w-5 h-5 text-orange-300" />
          <h1 className="text-2xl font-bold">{camp.client_name}</h1>
          <span className="text-slate-500 text-sm">{camp.metier} · {camp.ville}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={STATUS_TONE[c.servingStatus] ?? STATUS_TONE[c.status] ?? "bg-slate-700/50 border-slate-600 text-slate-300"}>
            diffusion : {c.servingStatus || c.status || "?"}
          </Badge>
          {c.adApproval ? (
            <Badge tone={APPROVAL_TONE[c.adApproval] ?? "bg-slate-700/50 border-slate-600 text-slate-300"}>
              annonce : {c.adApproval}
            </Badge>
          ) : null}
          <span className="text-slate-600">campagne {camp.campaign_id} · compte {camp.customer_id ?? "?"}</span>
        </div>

        {!report.live ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[13px] text-amber-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Métriques live indisponibles — affichage de la config en base. {report.warnings.join(" · ")}</span>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
          {/* ── Détails ── */}
          <div className="space-y-6">
            <Card title="Aperçu">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Field label="Budget / jour" value={dailyBudget == null ? "—" : eur(dailyBudget)} />
                <Field label="Stratégie" value={c.biddingStrategy || "—"} />
                <Field label="Début" value={c.startDate ?? "—"} />
                <Field label="Fin" value={c.endDate ?? "(aucune)"} />
              </dl>
            </Card>

            <Card title="Performance">
              <div className="grid sm:grid-cols-2 gap-4">
                <MetricsBlock title="30 derniers jours" m={report.metrics30d} eur={eur} pct={pct} />
                <MetricsBlock title="7 derniers jours" m={report.metrics7d} eur={eur} pct={pct} />
              </div>
            </Card>

            <Card title="Top mots-clés (par clics, 30 j)">
              {report.topKeywords.length ? (
                <ul className="divide-y divide-[#23232c] text-sm">
                  {report.topKeywords.map((k, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate">{k.text} <span className="text-slate-500">[{k.matchType}]</span></span>
                      <span className="shrink-0 text-slate-400 text-xs">
                        {k.clicks} clics · QS {k.qualityScore ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Aucun mot-clé avec données sur la période.</p>
              )}
            </Card>

            {plan?.ad ? (
              <Card title="Annonce (RSA)">
                <div className="text-sm space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Titres</div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.ad.headlines.map((h, i) => (
                        <span key={i} className="rounded bg-[#0b0b0f] border border-[#23232c] px-2 py-0.5 text-[12px] text-slate-300">{h}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Descriptions</div>
                    <ul className="space-y-1 text-slate-300 text-[13px]">
                      {plan.ad.descriptions.map((d, i) => <li key={i}>• {d}</li>)}
                    </ul>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          {/* ── Chatbot ── */}
          <CampaignChat campaignRecordId={camp.id} clientLabel={`${camp.client_name} · ${camp.metier ?? ""} ${camp.ville ?? ""}`} />
        </div>
      </div>
    </main>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded-md border px-2 py-1 font-medium ${tone}`}>{children}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2a2a35] bg-[#13131a] p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 text-right tabular-nums">{value}</dd>
    </>
  );
}

function MetricsBlock({
  title, m, eur, pct,
}: {
  title: string;
  m: Metrics;
  eur: (n: number) => string;
  pct: (r: number | null) => string;
}) {
  const rows: [string, string][] = [
    ["Impressions", m.impressions.toLocaleString("fr-FR")],
    ["Clics", `${m.clicks} (CTR ${pct(m.ctr)})`],
    ["CPC moyen", eur(m.avgCpcEur)],
    ["Dépense", eur(m.costEur)],
    ["Conversions", String(m.conversions)],
    ["Appels", String(m.phoneCalls)],
    ["Coût / conv.", m.costPerConvEur == null ? "—" : eur(m.costPerConvEur)],
    ["Budget perdu", pct(m.searchBudgetLostIs)],
  ];
  return (
    <div className="rounded-lg bg-[#0b0b0f] border border-[#23232c] p-3">
      <div className="text-[11px] font-medium text-slate-400 mb-2">{title}</div>
      <dl className="space-y-1.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
