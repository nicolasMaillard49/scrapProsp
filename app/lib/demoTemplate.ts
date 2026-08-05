import SalonTemplate from "@/app/maquette/templates/SalonTemplate";
import UrgenceTemplate from "@/app/maquette/templates/artisans/UrgenceTemplate";
import ConformiteTemplate from "@/app/maquette/templates/artisans/ConformiteTemplate";
import ChantierTemplate from "@/app/maquette/templates/artisans/ChantierTemplate";
import ThermiqueTemplate from "@/app/maquette/templates/artisans/ThermiqueTemplate";
import EtabliTemplate from "@/app/maquette/templates/artisans/EtabliTemplate";
import SurfaceTemplate from "@/app/maquette/templates/artisans/SurfaceTemplate";
import JardinTemplate from "@/app/maquette/templates/artisans/JardinTemplate";
import DentisteTemplate from "@/app/maquette/templates/santes/DentisteTemplate";
import KineTemplate from "@/app/maquette/templates/santes/KineTemplate";
import CabinetTemplate from "@/app/maquette/templates/santes/CabinetTemplate";
import CorpsTemplate from "@/app/maquette/templates/santes/CorpsTemplate";
import AppuiTemplate from "@/app/maquette/templates/santes/AppuiTemplate";
import BulleTemplate from "@/app/maquette/templates/santes/BulleTemplate";
import FriseTemplate from "@/app/maquette/templates/santes/FriseTemplate";
import CarnetTemplate from "@/app/maquette/templates/santes/CarnetTemplate";
import CadreTemplate from "@/app/maquette/templates/santes/CadreTemplate";
import AssietteTemplate from "@/app/maquette/templates/santes/AssietteTemplate";
import SouffleTemplate from "@/app/maquette/templates/santes/SouffleTemplate";
import DossierTemplate from "@/app/maquette/templates/santes/DossierTemplate";
import ActeTemplate from "@/app/maquette/templates/santes/ActeTemplate";
import GrandLivreTemplate from "@/app/maquette/templates/santes/GrandLivreTemplate";
import CoiffeurTemplate from "@/app/maquette/templates/niches/CoiffeurTemplate";
import BarbierTemplate from "@/app/maquette/templates/niches/BarbierTemplate";
import InstitutTemplate from "@/app/maquette/templates/niches/InstitutTemplate";
import OnglerieTemplate from "@/app/maquette/templates/niches/OnglerieTemplate";
import RestaurantTemplate from "@/app/maquette/templates/niches/RestaurantTemplate";
import FleuristeTemplate from "@/app/maquette/templates/niches/FleuristeTemplate";
import TatoueurTemplate from "@/app/maquette/templates/niches/TatoueurTemplate";
import { matchNiche, type NicheKey } from "@/app/maquette/templates/nicheKits";
import { matchSante, type SanteKey } from "@/app/maquette/templates/santeKits";
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
  // Artisans — une DA par métier, bâtie sur ce qu'il vend réellement.
  plombier: UrgenceTemplate,
  serrurier: UrgenceTemplate,
  electricien: ConformiteTemplate,
  chauffagiste: ThermiqueTemplate,
  couvreur: ChantierTemplate,
  macon: ChantierTemplate,
  menuisier: EtabliTemplate,
  carreleur: SurfaceTemplate,
  peintre: SurfaceTemplate,
  paysagiste: JardinTemplate,
  // Professions libérales — aucune ne montre d'avis : la publicité y est
  // déontologiquement encadrée et les témoignages de patients interdits.
  dentiste: DentisteTemplate,
  kine: KineTemplate,
  medecin: CabinetTemplate,
  osteopathe: CorpsTemplate,
  podologue: AppuiTemplate,
  orthophoniste: BulleTemplate,
  sagefemme: FriseTemplate,
  veterinaire: CarnetTemplate,
  psychologue: CadreTemplate,
  dieteticien: AssietteTemplate,
  sophrologue: SouffleTemplate,
  avocat: DossierTemplate,
  notaire: ActeTemplate,
  expertcomptable: GrandLivreTemplate,
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
  plombier: "Plombier",
  serrurier: "Serrurier",
  electricien: "Électricien",
  chauffagiste: "Chauffagiste",
  couvreur: "Couvreur",
  macon: "Maçon",
  menuisier: "Menuisier",
  carreleur: "Carreleur",
  peintre: "Peintre",
  paysagiste: "Paysagiste",
  dentiste: "Dentiste",
  kine: "Kiné",
  medecin: "Médecin",
  osteopathe: "Ostéopathe",
  podologue: "Podologue",
  orthophoniste: "Orthophoniste",
  sagefemme: "Sage-femme",
  veterinaire: "Vétérinaire",
  psychologue: "Psychologue",
  dieteticien: "Diététicien",
  sophrologue: "Sophrologue",
  avocat: "Avocat",
  notaire: "Notaire",
  expertcomptable: "Expert-comptable",
  salon: "Éditorial",
};

/** Une niche Instagram → sa maquette dédiée. */
export const NICHE_TEMPLATE: Record<NicheKey, TemplateKey> = {
  coiffure: "coiffeur",
  barbier: "barbier",
  esthetique: "institut",
  onglerie: "onglerie",
  restaurant: "restaurant",
  fleuriste: "fleuriste",
  tatoueur: "tatoueur",
};

/**
 * Professions libérales → leur maquette.
 *
 * Testées AVANT les niches : « podologue » tombe sinon dans la regex onglerie
 * (`podolog`), et un pédicure-podologue recevrait la page d'un bar à ongles.
 *
 * Les métiers dont la direction artistique n'existe pas encore ne sont pas
 * listés : mieux vaut le défaut générique qu'une page qui affiche le contenu
 * d'un autre praticien.
 */
export const SANTE_TEMPLATE: Partial<Record<SanteKey, TemplateKey>> = {
  dentiste: "dentiste",
  kine: "kine",
  medecin: "medecin",
  osteopathe: "osteopathe",
  podologue: "podologue",
  orthophoniste: "orthophoniste",
  sagefemme: "sagefemme",
  veterinaire: "veterinaire",
  psychologue: "psychologue",
  dieteticien: "dieteticien",
  sophrologue: "sophrologue",
  avocat: "avocat",
  notaire: "notaire",
  expertcomptable: "expertcomptable",
};

/**
 * Métiers du bâtiment → leur maquette. Ils ne passent pas par `matchNiche` :
 * un artisan ne vend pas un créneau mais une intervention et un devis, son
 * contenu vit dans `artisanKits` et sa direction artistique dans artisans/.
 *
 * Plusieurs métiers peuvent viser la même DA quand ils vendent de la même
 * façon (couvreur et charpentier, carreleur et peintre) : le contenu affiché,
 * lui, reste celui du métier — c'est le kit qui décide, pas le composant.
 */
export const ARTISAN_TEMPLATE: Record<string, TemplateKey> = {
  plombier: "plombier",
  serrurier: "serrurier",
  ferronnier: "serrurier",
  electricien: "electricien",
  chauffagiste: "chauffagiste",
  couvreur: "couvreur",
  charpentier: "couvreur",
  maçon: "macon",
  macon: "macon",
  plaquiste: "peintre",
  menuisier: "menuisier",
  cuisiniste: "menuisier",
  carreleur: "carreleur",
  peintre: "peintre",
  paysagiste: "paysagiste",
};

/**
 * Sélectionne la maquette selon le métier du prospect.
 *
 * Ordre : artisan connu → profession libérale → niche Instagram → défaut. Les niches
 * passent par `matchNiche`, qui rend `null` hors de son périmètre : sans ça,
 * tout métier inconnu atterrirait sur une page de salon de coiffure.
 */
export function templateForMetier(metier: string | null | undefined): TemplateKey {
  if (!metier) return "plombier";
  const m = metier.toLowerCase().trim();
  const artisan = ARTISAN_TEMPLATE[m];
  if (artisan) return artisan;
  const sante = matchSante(m);
  if (sante && SANTE_TEMPLATE[sante]) return SANTE_TEMPLATE[sante];
  const niche = matchNiche(m);
  return niche ? NICHE_TEMPLATE[niche] : "plombier";
}
