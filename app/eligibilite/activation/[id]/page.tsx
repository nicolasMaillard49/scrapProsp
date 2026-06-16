import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const NMF_PHONE = process.env.NEXT_PUBLIC_NMF_PHONE || "";

export default async function ActivationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseAdminConfigured) return <Centered>Configuration serveur manquante.</Centered>;
  const { data: lead } = await supabaseAdmin
    .from("eligibilite_leads")
    .select("first_name, email, ville, service_cible, budget_daily")
    .eq("id", id)
    .single();
  if (!lead) return <Centered>Activation introuvable.</Centered>;

  const { data: adsAccount } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id, status")
    .eq("lead_id", id)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cap = lead.budget_daily ? lead.budget_daily * 7 : null;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[13px] font-extrabold tracking-[0.14em]" style={{ color: "var(--accent)" }}>NMF&nbsp;AGENCE</span>
          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Activation</span>
        </div>

        <h1 className="text-[26px] font-extrabold leading-tight" style={{ color: "var(--ink)", textWrap: "balance" }}>
          {lead.first_name ? `${lead.first_name}, dernière` : "Dernière"} étape : ajoutez votre carte.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Votre campagne {lead.service_cible ? <b style={{ color: "var(--ink)" }}>{lead.service_cible}</b> : ""}{" "}
          est configurée et prête. Pour qu&apos;elle démarre, Google a besoin de votre moyen de paiement.
        </p>

        {adsAccount?.customer_id ? (
          <div
            className="mt-5 rounded-[16px] p-4"
            style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.30)" }}
          >
            <p className="text-sm font-bold" style={{ color: "#047857" }}>
              ✅ Votre compte est créé · ID {formatCustomerId(adsAccount.customer_id)}
            </p>
            {lead.email ? (
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                Google a envoyé une invitation à <b style={{ color: "var(--ink)" }}>{lead.email}</b>. Acceptez-la pour accéder à votre compte.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Pourquoi ma carte — rassurance */}
        <div className="mt-5 fnl-card p-5">
          <p className="text-[11px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>POURQUOI MA CARTE ?</p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            C&apos;est <b style={{ color: "var(--ink)" }}>vous qui financez vos clics</b> directement auprès de Google.
            Notre <b style={{ color: "var(--ink)" }}>gestion est 100 % offerte</b> la 1ʳᵉ semaine — nous ne prélevons rien.
            {cap ? (
              <> Votre budget est <b style={{ color: "var(--ink)" }}>plafonné à {cap} € sur la semaine</b> : vous ne dépasserez jamais ce montant.</>
            ) : null}
          </p>
        </div>

        {/* Étapes */}
        <div className="mt-7 space-y-3">
          <Step n={1} title="Ouvrez l'email de Google">
            Cherchez l&apos;email <b style={{ color: "var(--ink)" }}>« Invitation à gérer un compte Google Ads »</b>
            {lead.email ? <> envoyé à <b style={{ color: "var(--ink)" }}>{lead.email}</b></> : null}. Pensez à regarder
            dans vos <b style={{ color: "var(--ink)" }}>spams / promotions</b> s&apos;il n&apos;apparaît pas tout de suite.
          </Step>
          <Step n={2} title="Acceptez l'invitation">
            Cliquez sur <b style={{ color: "var(--ink)" }}>« Accepter l&apos;invitation »</b>. Vous arrivez directement sur
            votre compte publicitaire — celui qu&apos;on a préparé pour vous.
          </Step>
          <Step n={3} title="Ajoutez votre carte">
            Dans le menu <b style={{ color: "var(--ink)" }}>Facturation &amp; paiements</b>, choisissez
            <b style={{ color: "var(--ink)" }}> « Ajouter un mode de paiement »</b> et saisissez votre carte. Quelques
            informations (adresse, TVA) peuvent être demandées par Google.
          </Step>
          <Step n={4} title="C'est lancé" last>
            Dès votre carte validée, <b style={{ color: "var(--ink)" }}>votre campagne démarre automatiquement</b>.
            Vous recevrez vos premiers appels dans les heures qui suivent. On surveille tout de notre côté.
          </Step>
        </div>

        {/* CTA */}
        <a
          href="https://ads.google.com"
          target="_blank"
          rel="noreferrer"
          className="fnl-btn"
          style={{ marginTop: 28, textDecoration: "none" }}
        >
          Ouvrir Google Ads →
        </a>

        <div
          className="mt-4 rounded-[16px] p-4 text-center text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
        >
          Un doute, une question ? On le fait <b style={{ color: "var(--ink)" }}>avec vous au téléphone</b> en 5 minutes.
          {NMF_PHONE ? (
            <> <a href={`tel:${NMF_PHONE.replace(/\s/g, "")}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{NMF_PHONE}</a></>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: "var(--muted)" }}>
          NMF Agence — sites web &amp; acquisition pour artisans.
        </p>
      </div>
    </main>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="relative flex gap-4">
      {/* Pastille numérotée + ligne de liaison */}
      <div className="flex flex-col items-center">
        <span
          className="grid place-items-center rounded-full font-extrabold shrink-0"
          style={{ width: 38, height: 38, background: "var(--accent)", color: "#fff", boxShadow: "0 6px 14px -6px rgba(91,52,192,.6)" }}
        >
          {n}
        </span>
        {!last && <span style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4, marginBottom: 4, borderRadius: 999 }} />}
      </div>
      <div className="fnl-card p-4 flex-1 mb-1">
        <h3 className="font-extrabold text-[15px]" style={{ color: "var(--ink)" }}>{title}</h3>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{children}</p>
      </div>
    </div>
  );
}

/** 6711813801 -> "671-181-3801" (format compte Google Ads). */
function formatCustomerId(id: string): string {
  const d = id.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : id;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: "var(--ink-soft)" }}>
      {children}
    </main>
  );
}
