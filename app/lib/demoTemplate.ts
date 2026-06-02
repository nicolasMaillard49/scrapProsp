import ProTemplate from "@/app/maquette/templates/ProTemplate";
import CorporateTemplate from "@/app/maquette/templates/CorporateTemplate";
import MinimalTemplate from "@/app/maquette/templates/MinimalTemplate";
import ElectricTemplate from "@/app/maquette/templates/ElectricTemplate";
import ForestTemplate from "@/app/maquette/templates/ForestTemplate";
import LuxeTemplate from "@/app/maquette/templates/LuxeTemplate";
import TerraTemplate from "@/app/maquette/templates/TerraTemplate";
import type { TemplateProps } from "@/app/maquette/templates/data";
import type { ComponentType } from "react";

export const TEMPLATES = {
  pro: ProTemplate,
  corporate: CorporateTemplate,
  minimal: MinimalTemplate,
  electric: ElectricTemplate,
  forest: ForestTemplate,
  luxe: LuxeTemplate,
  terra: TerraTemplate,
} as const satisfies Record<string, ComponentType<TemplateProps & { nmfCredit?: boolean }>>;

export type TemplateKey = keyof typeof TEMPLATES;

/**
 * Sélectionne automatiquement un template selon le métier du prospect.
 * Permet d'avoir une démo cohérente sans choix manuel (cf. roadmap quick win #1).
 */
const METIER_TEMPLATE: Record<string, TemplateKey> = {
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

export function templateForMetier(metier: string | null | undefined): TemplateKey {
  if (!metier) return "pro";
  return METIER_TEMPLATE[metier.toLowerCase().trim()] ?? "pro";
}
