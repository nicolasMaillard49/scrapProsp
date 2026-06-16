import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import ActivationStatus from "./ActivationStatus";

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

        <h1 className="text-[27px] font-extrabold leading-[1.12]" style={{ color: "var(--ink)", textWrap: "balance" }}>
          {lead.first_name ? `${lead.first_name}, dernière` : "Dernière"} étape : ajoutez votre carte.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Votre campagne {lead.service_cible ? <b style={{ color: "var(--ink)" }}>{lead.service_cible}</b> : ""}{" "}
          est configurée et prête. Pour qu&apos;elle démarre, Google a besoin de votre moyen de paiement.
        </p>

        {/* Compte créé + statut d'activation (polling) */}
        {adsAccount?.customer_id ? (
          <div className="mt-5">
            <div
              className="flex items-center gap-3 rounded-[16px] p-4"
              style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.30)" }}
            >
              <span aria-hidden style={{ fontSize: 18 }}>✅</span>
              <div>
                <p className="text-sm font-bold" style={{ color: "#047857" }}>
                  Votre compte est créé · ID {formatCustomerId(adsAccount.customer_id)}
                </p>
                {lead.email ? (
                  <p className="mt-0.5 text-sm" style={{ color: "var(--ink-soft)" }}>
                    Google a envoyé une invitation à <b style={{ color: "var(--ink)" }}>{lead.email}</b>.
                  </p>
                ) : null}
              </div>
            </div>
            <ActivationStatus id={id} />
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
            Dans la section <b style={{ color: "var(--ink)" }}>« Mode de paiement »</b>, renseignez votre carte bancaire,
            cochez les conditions Google, puis validez en bas de page. Voici l&apos;écran que vous verrez :
            <PaymentMockup />
          </Step>
          <Step n={4} title="C'est lancé" last>
            Dès votre carte validée, <b style={{ color: "var(--ink)" }}>votre compte est activé</b>. On surveille tout
            de notre côté et on met votre campagne en ligne <b style={{ color: "var(--ink)" }}>avec vous</b>.
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
        <p className="mt-2 text-center text-xs" style={{ color: "var(--muted)" }}>
          S&apos;ouvre dans un nouvel onglet, sur votre compte Google Ads.
        </p>

        <div
          className="mt-5 rounded-[16px] p-4 text-center text-sm"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
        >
          Un doute, une question ? On le fait <b style={{ color: "var(--ink)" }}>avec vous au téléphone</b> en 5 minutes.
          {NMF_PHONE ? (
            <> <a href={`tel:${NMF_PHONE.replace(/\s/g, "")}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{NMF_PHONE}</a></>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          NMF Agence — Nicolas Maillard, entrepreneur individuel.<br />
          SIRET 102 905 379 00016 · TVA non applicable, art. 293 B du CGI.
        </p>
      </div>
    </main>
  );
}

/** Recréation fidèle (HTML/CSS) du panneau « Mode de paiement » de Google Ads — repère visuel pour l'étape 3. */
function PaymentMockup() {
  return (
    <span className="mt-3 block">
      <span
        className="block rounded-[14px] p-3"
        style={{ background: "var(--accent-soft)", border: "1.5px solid var(--accent)" }}
      >
        {/* Faux cadre fieldset façon Google */}
        <span className="relative block rounded-[10px] bg-white p-4" style={{ border: "1px solid #dadce0" }}>
          <span
            className="absolute px-1 text-[11px]"
            style={{ top: -8, left: 12, background: "#fff", color: "#5f6368" }}
          >
            Mode de paiement
          </span>
          <span className="flex items-center gap-3">
            {/* Logo Mastercard */}
            <span className="relative inline-block shrink-0" style={{ width: 34, height: 22 }} aria-hidden>
              <span className="absolute rounded-full" style={{ width: 22, height: 22, left: 0, background: "#EB001B" }} />
              <span className="absolute rounded-full" style={{ width: 22, height: 22, left: 12, background: "#F79E1B", mixBlendMode: "multiply" }} />
            </span>
            <span className="flex-1 text-[14px] font-medium" style={{ color: "#202124" }}>
              Mastercard&nbsp;•••• 1233
            </span>
            <span className="text-[14px] font-medium" style={{ color: "#1a73e8" }}>Modifier</span>
          </span>
          <span className="mt-2 block text-[12px] leading-snug" style={{ color: "#5f6368" }}>
            Une <b style={{ color: "#202124" }}>autorisation temporaire de 10,00 €</b> apparaîtra sur votre carte
            (généralement supprimée au bout d&apos;une semaine).
          </span>
        </span>
        <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--accent-dark)" }}>
          <span aria-hidden>↑</span> C&apos;est ici que vous ajoutez votre carte, puis vous validez en bas de page.
        </span>
      </span>
    </span>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="relative flex gap-4">
      {/* Pastille numérotée + ligne de liaison */}
      <div className="flex flex-col items-center">
        <span
          className="grid place-items-center rounded-full font-extrabold shrink-0"
          style={{ width: 38, height: 38, background: "var(--accent)", color: "#fff", boxShadow: "0 6px 14px -6px rgba(255,110,0,.6)" }}
        >
          {n}
        </span>
        {!last && <span style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4, marginBottom: 4, borderRadius: 999 }} />}
      </div>
      <div className="fnl-card p-4 flex-1 mb-1">
        <h3 className="font-extrabold text-[15px]" style={{ color: "var(--ink)" }}>{title}</h3>
        <div className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{children}</div>
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
