import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TEMPLATES } from "@/app/lib/demoTemplate";
import { SHOWCASE, showcaseEntry } from "../../templates/showcase";

/* ──────────────────────────────────────────────────────────────
 * Aperçu d'une maquette avec un prospect fictif.
 *
 * Aucune base de données : c'est ce qui permet de la charger 15 fois dans la
 * galerie sans requête Supabase, et de montrer une maquette à quelqu'un sans
 * avoir un vrai prospect sous la main.
 *
 * `nmfCredit` est actif : le bloc d'offre (300 / 500 € HT) fait partie de ce
 * qu'on veut voir en revue — c'est lui qui doit suivre ce que la page montre.
 * ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return SHOWCASE.map((e) => ({ template: e.key }));
}

export default async function ApercuPage({
  params,
}: {
  params: Promise<{ template: string }>;
}) {
  const { template } = await params;
  const entry = showcaseEntry(template);
  if (!entry) notFound();

  const Template = TEMPLATES[entry.key];
  return <Template {...entry.demo} nmfCredit />;
}
