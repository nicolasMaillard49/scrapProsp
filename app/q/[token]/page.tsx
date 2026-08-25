import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import QualifyForm from "./QualifyForm";

/**
 * L'écran que l'artisan ouvre depuis sa notification : « ce devis a signé, et
 * pour combien ». C'est le seul maillon humain de la remontée de valeur, et il
 * se remplit sur un chantier, au téléphone, d'une main — d'où deux champs, pas
 * un de plus, et aucune authentification autre que le jeton du lien.
 */

export const dynamic = "force-dynamic";

export default async function QualifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!supabaseAdminConfigured) return <Centered>Configuration serveur manquante.</Centered>;

  const { data: lead } = await supabaseAdmin
    .from("ads_leads")
    .select("token, name, phone, commune, service, message, status, amount_cents, received_at")
    .eq("token", token)
    .single();

  if (!lead) return <Centered>Lien inconnu ou expiré.</Centered>;

  return (
    <main className="min-h-screen flex items-start justify-center p-4 py-10">
      <QualifyForm
        token={lead.token}
        name={lead.name}
        phone={lead.phone}
        commune={lead.commune}
        service={lead.service}
        message={lead.message}
        status={lead.status}
        amountCents={lead.amount_cents}
        receivedAt={lead.received_at}
      />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 text-center"
      style={{ color: "var(--color-text-secondary)" }}
    >
      {children}
    </main>
  );
}
