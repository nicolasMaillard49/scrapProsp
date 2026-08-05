import type { Metadata } from "next";
import { SHOWCASE } from "../templates/showcase";
import GalerieGrid from "./GalerieGrid";

/* Planche de contact interne : toutes les maquettes sur une page, avec l'offre
 * et le prix que chacune annonce. Page protégée par le middleware (cookie). */

export const metadata: Metadata = {
  title: "Maquettes — planche de contact",
  robots: { index: false, follow: false },
};

export default function GaleriePage() {
  return <GalerieGrid entries={SHOWCASE} />;
}
