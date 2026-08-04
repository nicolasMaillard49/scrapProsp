import ProTemplate from "@/app/maquette/templates/ProTemplate";
import CorporateTemplate from "@/app/maquette/templates/CorporateTemplate";
import MinimalTemplate from "@/app/maquette/templates/MinimalTemplate";
import ElectricTemplate from "@/app/maquette/templates/ElectricTemplate";
import ForestTemplate from "@/app/maquette/templates/ForestTemplate";
import LuxeTemplate from "@/app/maquette/templates/LuxeTemplate";
import TerraTemplate from "@/app/maquette/templates/TerraTemplate";
import SalonTemplate from "@/app/maquette/templates/SalonTemplate";
import CoiffeurTemplate from "@/app/maquette/templates/niches/CoiffeurTemplate";
import BarbierTemplate from "@/app/maquette/templates/niches/BarbierTemplate";
import InstitutTemplate from "@/app/maquette/templates/niches/InstitutTemplate";
import OnglerieTemplate from "@/app/maquette/templates/niches/OnglerieTemplate";
import RestaurantTemplate from "@/app/maquette/templates/niches/RestaurantTemplate";
import FleuristeTemplate from "@/app/maquette/templates/niches/FleuristeTemplate";
import TatoueurTemplate from "@/app/maquette/templates/niches/TatoueurTemplate";
import { matchNiche, type NicheKey } from "@/app/maquette/templates/nicheKits";
import type { TemplateProps } from "@/app/maquette/templates/data";
import type { ComponentType } from "react";

export const TEMPLATES = {
  // Niches Instagram — une direction artistique par métier.
  coiffeur: CoiffeurTemplate,
  barbier: BarbierTemplate,
  institut: InstitutTemplate,
  onglerie: OnglerieTemplate,
  restaurant: RestaurantTemplate,
  fleuriste: FleuristeTemplate,
  tatoueur: TatoueurTemplate,
  // Artisans (BaseTemplate décliné par thème).
  pro: ProTemplate,
  corporate: CorporateTemplate,
  minimal: MinimalTemplate,
  electric: ElectricTemplate,
  forest: ForestTemplate,
  luxe: LuxeTemplate,
  terra: TerraTemplate,
  // Éditorial générique — reste sélectionnable en direct pendant un appel.
  salon: SalonTemplate,
} as const satisfies Record<string, ComponentType<TemplateProps & { nmfCredit?: boolean }>>;

export type TemplateKey = keyof typeof TEMPLATES;

/** Libellés du sélecteur (CRM + barre d'outils /maquette). Source unique. */
export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  coiffeur: "Coiffeur",
  barbier: "Barbier",
  institut: "Institut",
  onglerie: "Onglerie",
  restaurant: "Restaurant",
  fleuriste: "Fleuriste",
  tatoueur: "Tatoueur",
  pro: "Pro",
  corporate: "Corporate",
  minimal: "Minimal",
  electric: "Electric",
  forest: "Forest",
  luxe: "Luxe",
  terra: "Terra",
  salon: "Éditorial",
};

/** Une niche Instagram → sa maquette dédiée. */
const NICHE_TEMPLATE: Record<NicheKey, TemplateKey> = {
  coiffure: "coiffeur",
  barbier: "barbier",
  esthetique: "institut",
  onglerie: "onglerie",
  restaurant: "restaurant",
  fleuriste: "fleuriste",
  tatoueur: "tatoueur",
};

/**
 * Métiers artisans → thème du BaseTemplate. Ils ne passent pas par les niches :
 * un couvreur et un plombier vendent la même chose (une intervention), leur
 * maquette peut légitimement partager une structure.
 */
const ARTISAN_TEMPLATE: Record<string, TemplateKey> = {
  electricien: "electric",
  plombier: "pro",
  chauffagiste: "corporate",
  paysagiste: "forest",
  couvreur: "terra",
  maçon: "terra",
  carreleur: "minimal",
  serrurier: "minimal",
  menuisier: "luxe",
  peintre: "luxe",
};

/**
 * Sélectionne la maquette selon le métier du prospect.
 *
 * Ordre : artisan connu → niche Instagram → « pro » par défaut. Les niches
 * passent par `matchNiche`, qui rend `null` hors de son périmètre : sans ça,
 * tout métier inconnu atterrirait sur une page de salon de coiffure.
 */
export function templateForMetier(metier: string | null | undefined): TemplateKey {
  if (!metier) return "pro";
  const m = metier.toLowerCase().trim();
  const artisan = ARTISAN_TEMPLATE[m];
  if (artisan) return artisan;
  const niche = matchNiche(m);
  return niche ? NICHE_TEMPLATE[niche] : "pro";
}
