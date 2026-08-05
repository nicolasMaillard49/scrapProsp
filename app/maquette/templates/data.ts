export interface TemplateProps {
  name: string;
  metier: string;
  ville: string;
  phone: string;
  rating: number | null;
  reviews: number | null;
  address: string | null;
}

export const METIER_LABELS: Record<string, string> = {
  plombier: "Plombier",
  chauffagiste: "Chauffagiste",
  electricien: "Électricien",
  paysagiste: "Paysagiste",
  couvreur: "Couvreur",
  maçon: "Maçon",
  serrurier: "Serrurier",
  menuisier: "Menuisier",
  carreleur: "Carreleur",
  peintre: "Peintre",
  // Variante sans cédille : le scraping rend les deux, elles doivent porter le
  // même libellé sous peine d'afficher deux métiers là où il n'y en a qu'un.
  macon: "Maçon",
  charpentier: "Charpentier",
  ferronnier: "Ferronnier",
  plaquiste: "Plaquiste",
  cuisiniste: "Cuisiniste",
};

export function metierLabel(m: string): string {
  return METIER_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);
}
