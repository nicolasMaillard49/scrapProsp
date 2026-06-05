import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { TEMPLATES, templateForMetier, type TemplateKey } from "@/app/lib/demoTemplate";
import { metierLabel } from "@/app/maquette/templates/data";
import type { TemplateProps } from "@/app/maquette/templates/data";
import type { Metadata } from "next";

/** Colonnes nécessaires au rendu d'une démo. */
const SELECT = "name, metier, phone, ville, rating, reviews, address";

/** Récupère un prospect par son UUID complet (route /demo/[id]). */
export async function getProspectById(id: string): Promise<TemplateProps | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.from("prospects").select(SELECT).eq("id", id).single();
  return (data as TemplateProps) ?? null;
}

/**
 * Récupère un prospect par un préfixe d'UUID (route courte /d/[code]).
 * La colonne `id` étant de type uuid, on ne peut pas faire de LIKE : on borne
 * par une plage uuid [code-0000…, (code+1)-0000…) — la comparaison uuid est
 * octet-par-octet, donc équivalente au préfixe hexadécimal.
 */
export async function getProspectByCode(code: string): Promise<TemplateProps | null> {
  if (!supabaseConfigured) return null;
  const c = code.toLowerCase();
  if (!/^[0-9a-f]{1,8}$/.test(c)) return null;
  const lo = `${c.padEnd(8, "0")}-0000-0000-0000-000000000000`;
  const next = Number.parseInt(c.padEnd(8, "0"), 16) + 1;
  // Borne haute : préfixe + 1. Si débordement (ffffffff), pas de borne haute.
  const hiPrefix = next > 0xffffffff ? null : next.toString(16).padStart(8, "0");
  let query = supabase.from("prospects").select(SELECT).gte("id", lo);
  if (hiPrefix) query = query.lt("id", `${hiPrefix}-0000-0000-0000-000000000000`);
  const { data } = await query.limit(1);
  return (data?.[0] as TemplateProps) ?? null;
}

/** Base absolue pour les URLs de métadonnées (og:image doit être absolue pour WhatsApp/social). */
const METADATA_BASE = new URL(
  process.env.NEXT_PUBLIC_DEMO_BASE_URL ?? "https://prospects.nmf-agence.com",
);

/**
 * Métadonnées partagées : noindex (démos privées de prospection) MAIS Open Graph
 * + Twitter Card complets -> carte d'aperçu avec image quand le lien est partagé
 * (WhatsApp, iMessage, réseaux). L'image elle-même vient du fichier
 * opengraph-image.tsx du segment (injecté automatiquement par Next).
 */
export function demoMetadata(prospect: TemplateProps | null): Metadata {
  if (!prospect) return { title: "Démo", metadataBase: METADATA_BASE };
  const label = metierLabel(prospect.metier);
  const title = `${prospect.name} — ${label} à ${prospect.ville}`;
  const description = `Aperçu du site web de ${prospect.name}, ${label} à ${prospect.ville}. Réalisé par NMF Agence — gratuit, sans engagement.`;
  return {
    metadataBase: METADATA_BASE,
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "NMF Agence" },
    twitter: { card: "summary_large_image", title, description },
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

/** Rendu de la démo (template auto selon métier, override possible via ?style=). */
export function DemoView({ prospect, style }: { prospect: TemplateProps | null; style?: string }) {
  if (!prospect) return <div style={messageStyle}>Démo introuvable.</div>;
  const key: TemplateKey =
    style && style in TEMPLATES ? (style as TemplateKey) : templateForMetier(prospect.metier);
  const Template = TEMPLATES[key];
  return <Template {...prospect} nmfCredit />;
}
