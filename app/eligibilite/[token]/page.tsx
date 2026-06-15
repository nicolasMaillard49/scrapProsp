import { supabaseAdmin, supabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import QuizForm from "./QuizForm";

export const dynamic = "force-dynamic";

export default async function EligibiliteFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!supabaseAdminConfigured) {
    return <Centered>Configuration serveur manquante.</Centered>;
  }
  const { data: lead } = await supabaseAdmin
    .from("eligibilite_leads")
    .select("token, metier, ville, phone, status")
    .eq("token", token)
    .single();

  if (!lead) return <Centered>Lien invalide ou expiré.</Centered>;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-10">
      <QuizForm
        token={lead.token}
        metier={lead.metier ?? ""}
        ville={lead.ville ?? ""}
        phone={lead.phone ?? ""}
      />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: "var(--ink-soft)" }}>
      {children}
    </main>
  );
}
