import Link from "next/link";
import { ArrowLeft, Radio, Mail, Smartphone, ExternalLink, Megaphone } from "lucide-react";
import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { confirmationEmailHtml, launchEmailHtml } from "@/app/lib/eligibilite";
import LeadAdsPanel, { type PlanLike } from "./LeadAdsPanel";

export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  ref: number;
  token: string;
  metier: string | null;
  ville: string | null;
  first_name: string | null;
  service_cible: string | null;
  budget_daily: number | null;
  calls_per_month: number | null;
  status: string | null;
  phone: string | null;
  created_at: string | null;
}

/* Lead de DÉMO (seedé en base via scripts/seed-demo-lead.mjs) : garantit un
   exemple affichable dans les iframes même si aucun vrai lead n'existe encore. */
const SAMPLE: Lead = {
  id: "11111111-1111-4111-8111-111111111111",
  ref: 0,
  token: "demo",
  metier: "plombier",
  ville: "Tours",
  first_name: "Jean",
  service_cible: "Débouchage canalisation urgence",
  budget_daily: 25,
  calls_per_month: 56,
  status: "report_viewed",
  phone: "06 15 90 78 73",
  created_at: null,
};

const STATUS_LABEL: Record<string, string> = {
  created: "créé", sms_sent: "SMS envoyé", submitted: "formulaire rempli",
  report_viewed: "rapport vu", launched: "lancé",
};

export default async function FunnelConsolePage() {
  let leads: Lead[] = [];
  if (supabaseAdminConfigured) {
    const { data } = await supabaseAdmin
      .from("eligibilite_leads")
      .select("id, ref, token, metier, ville, first_name, service_cible, budget_daily, calls_per_month, status, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    leads = (data as Lead[]) ?? [];
  }

  // Provisioning Google Ads : pour chaque lead « lancé », son dernier record ads
  // (plan généré + statut/customer_id éventuels). Plan = payload.plan ?? payload.
  const launchedLeads = leads.filter((l) => l.status === "launched");
  const adsByLead = new Map<string, { status: string; customer_id: string | null; campaign_id: string | null; plan: PlanLike | null }>();
  if (supabaseAdminConfigured && launchedLeads.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("google_ads_accounts")
      .select("lead_id, status, customer_id, campaign_id, payload, created_at")
      .in("lead_id", launchedLeads.map((l) => l.id))
      .order("created_at", { ascending: false });
    for (const r of rows ?? []) {
      if (!r.lead_id) continue;
      const prev = adsByLead.get(r.lead_id);
      if (prev) {
        // Ordre desc → on garde statut/plan de la ligne la plus récente, mais on
        // récupère customer_id/campaign_id depuis une ligne plus ancienne si la plus
        // récente ne les a pas (ex. un retry `error` masquerait la campagne créée →
        // le bouton « Rafraîchir les mots-clés » ne s'afficherait plus).
        if (!prev.customer_id && r.customer_id) prev.customer_id = r.customer_id;
        if (!prev.campaign_id && r.campaign_id) prev.campaign_id = r.campaign_id;
        continue;
      }
      const payload = r.payload as { plan?: PlanLike } | PlanLike | null;
      const plan = (payload && typeof payload === "object" && "plan" in payload ? payload.plan : payload) as PlanLike | null;
      adsByLead.set(r.lead_id, { status: r.status, customer_id: r.customer_id, campaign_id: r.campaign_id, plan: plan ?? null });
    }
  }

  // Pour les aperçus emails / pages : on prend le lead le plus complet dispo.
  const sample = leads.find((l) => l.service_cible) ?? leads[0] ?? SAMPLE;
  const confirmation = confirmationEmailHtml(sample);
  const launch = launchEmailHtml(sample);
  const quizLead = leads[0] ?? SAMPLE;

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Prospects
        </Link>
        <h1 className="text-2xl font-bold">Console funnel éligibilité</h1>
        <p className="text-slate-400 text-sm mt-1">
          Aperçu de tout ce que le client voit + miroir temps réel de la saisie.
        </p>

        {/* ── Leads + miroir live ── */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            <Radio className="w-4 h-4" /> Leads récents — suivi live
          </h2>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun lead pour l&apos;instant.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#2a2a35] bg-[#13131a] px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 rounded-md bg-slate-700/60 border border-slate-600/50 px-2 py-1 text-sm font-bold tabular-nums text-slate-200">
                      #{l.ref}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{l.first_name || "—"} · {l.metier} {l.ville}</div>
                      <div className="text-xs text-slate-500">{STATUS_LABEL[l.status ?? ""] ?? l.status} · {l.phone}</div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/funnel/live/${l.token}`}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 border border-orange-500/40 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/25 transition"
                  >
                    <Radio className="w-3.5 h-3.5" /> Suivre live
                  </Link>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-600">
            « Suivre live » ouvre le miroir : les champs se remplissent en temps réel pendant que le prospect tape.
          </p>
        </section>

        {/* ── Workflow création compte Google Ads ── */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            <Megaphone className="w-4 h-4" /> Workflow création compte Google Ads
          </h2>
          <div className="rounded-xl border border-[#2a2a35] bg-[#13131a] p-4 text-sm text-slate-300 leading-relaxed">
            <p className="text-amber-300/90 text-[13px] mb-3">
              ⚠️ Le MCC 671 ne peut pas créer de comptes par API (manager trop jeune : il
              faut un compte lié ayant dépensé &gt; 1 000 $). On provisionne le compte
              <b> à la main</b>, puis on crée la campagne par API.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Créer un <b>compte Google Ads autonome</b> (hors MCC, mode expert, sans campagne).</li>
              <li>Inviter l&apos;<b>email du client en Administrateur</b> (Outils → Configuration → Accès au compte).</li>
              <li>Le client <b>ajoute sa carte</b> (Facturation → Mode de paiement).</li>
              <li><b>Lier le compte au MCC 671</b> — garder la facturation sur le compte du client.</li>
              <li>Coller le <b>customer ID</b> du compte lié ci-dessous → <b>« Créer la campagne »</b> (PAUSED, par API).</li>
              <li>Tout prêt ? <b>Dé-pauser</b> la campagne à la main dans Google Ads.</li>
            </ol>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-6 mb-3">
            Leads lancés — à provisionner
          </h3>
          {launchedLeads.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun lead « lancé » pour l&apos;instant.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {launchedLeads.map((l) => {
                const ads = adsByLead.get(l.id) ?? null;
                return (
                  <LeadAdsPanel
                    key={l.id}
                    leadId={l.id}
                    leadLabel={`#${l.ref} · ${l.first_name || "—"} · ${l.metier ?? ""} ${l.ville ?? ""}`}
                    plan={ads?.plan ?? null}
                    existing={ads ? { status: ads.status, customer_id: ads.customer_id, campaign_id: ads.campaign_id } : null}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── Aperçu des pages client ── */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            <Smartphone className="w-4 h-4" /> Pages vues par le client
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <PhonePreview title="1 · Formulaire (9 étapes)" href={`/eligibilite/${quizLead.token}`} src={`/eligibilite/${quizLead.token}`} />
            <PhonePreview title="2 · Rapport d'analyse" href={`/eligibilite/rapport/${sample.id}`} src={`/eligibilite/rapport/${sample.id}`} />
          </div>
        </section>

        {/* ── Aperçu des emails ── */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            <Mail className="w-4 h-4" /> Emails envoyés
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <EmailPreview subject={confirmation.subject} html={confirmation.html} caption="Après le formulaire" />
            <EmailPreview subject={launch.subject} html={launch.html} caption="Au clic « Lancer »" />
          </div>
        </section>
      </div>
    </main>
  );
}

function PhonePreview({ title, src, href }: { title: string; src: string; href: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-300">{title}</span>
        <a href={href} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
          ouvrir <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="rounded-2xl border border-[#2a2a35] overflow-hidden bg-black">
        <iframe src={src} title={title} className="w-full" style={{ height: 560 }} />
      </div>
    </div>
  );
}

function EmailPreview({ subject, html, caption }: { subject: string; html: string; caption: string }) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-medium text-slate-300 truncate">{subject}</div>
        <div className="text-xs text-slate-500">{caption}</div>
      </div>
      <div className="rounded-2xl border border-[#2a2a35] overflow-hidden bg-white">
        <iframe srcDoc={html} title={subject} className="w-full" style={{ height: 480 }} />
      </div>
    </div>
  );
}
