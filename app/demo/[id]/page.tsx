import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { TEMPLATES, templateForMetier, type TemplateKey } from "@/app/lib/demoTemplate";
import { metierLabel } from "@/app/maquette/templates/data";
import type { TemplateProps } from "@/app/maquette/templates/data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function getProspect(id: string): Promise<TemplateProps | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase
    .from("prospects")
    .select("name, metier, phone, ville, rating, reviews, address")
    .eq("id", id)
    .single();
  return (data as TemplateProps) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const prospect = await getProspect(id);
  if (!prospect) return { title: "Démo" };
  const label = metierLabel(prospect.metier);
  return {
    title: `${prospect.name} — ${label} à ${prospect.ville}`,
    description: `Aperçu du site web de ${prospect.name}, ${label} à ${prospect.ville}. Démo réalisée par NMF Agence.`,
    robots: { index: false, follow: false },
  };
}

const messageStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
  fontFamily: "system-ui",
  color: "#6b7280",
};

export default async function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const { id } = await params;
  const { style } = await searchParams;
  const prospect = await getProspect(id);

  if (!prospect) {
    return <div style={messageStyle}>Démo introuvable.</div>;
  }

  const key: TemplateKey =
    style && style in TEMPLATES ? (style as TemplateKey) : templateForMetier(prospect.metier);
  const Template = TEMPLATES[key];

  return <Template {...prospect} nmfCredit />;
}
