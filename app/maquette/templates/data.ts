export interface TemplateProps {
  name: string;
  metier: string;
  ville: string;
  phone: string;
  rating: number | null;
  reviews: number | null;
  address: string | null;
}

export interface ServiceItem {
  title: string;
  desc: string;
  icon: string;
}

export const SERVICES: Record<string, ServiceItem[]> = {
  plombier: [
    { title: "Dépannage urgence", desc: "Intervention rapide 7j/7 pour fuites, canalisations bouchées et pannes de chauffe-eau.", icon: "🔧" },
    { title: "Installation sanitaire", desc: "Pose de salles de bain, WC, douches et raccordements aux normes en vigueur.", icon: "🚿" },
    { title: "Entretien chaudière", desc: "Contrat d'entretien annuel, détartrage et mise en conformité de vos installations.", icon: "🔥" },
    { title: "Rénovation", desc: "Réfection complète de salle de bain et cuisine, du plan à la livraison clé en main.", icon: "🏠" },
  ],
  chauffagiste: [
    { title: "Installation chauffage", desc: "Pose de chaudière gaz, pompe à chaleur et plancher chauffant.", icon: "🔥" },
    { title: "Dépannage urgence", desc: "Intervention rapide pour panne de chauffage et fuite de gaz.", icon: "🔧" },
    { title: "Entretien annuel", desc: "Contrat d'entretien, ramonage et mise en conformité.", icon: "📋" },
    { title: "Énergies renouvelables", desc: "Solutions solaires, PAC et chauffe-eau thermodynamique.", icon: "☀️" },
  ],
  electricien: [
    { title: "Installation électrique", desc: "Câblage, tableaux et prises pour neuf et rénovation, conforme NF C 15-100.", icon: "⚡" },
    { title: "Mise aux normes", desc: "Diagnostic et mise en conformité de votre installation électrique.", icon: "✅" },
    { title: "Dépannage", desc: "Intervention rapide sur pannes, courts-circuits et coupures de courant.", icon: "🔧" },
    { title: "Domotique", desc: "Automatisation de votre habitat : éclairage, volets, alarme et pilotage à distance.", icon: "🏠" },
  ],
  paysagiste: [
    { title: "Création de jardins", desc: "Conception et réalisation d'espaces verts sur mesure, du plan au plantage.", icon: "🌿" },
    { title: "Entretien espaces verts", desc: "Tonte, taille de haies, désherbage et entretien saisonnier régulier.", icon: "✂️" },
    { title: "Élagage", desc: "Taille et abattage d'arbres en toute sécurité par des professionnels certifiés.", icon: "🌳" },
    { title: "Aménagement extérieur", desc: "Terrasses, clôtures, allées et murets pour sublimer votre extérieur.", icon: "🏡" },
  ],
};

export function getServices(metier: string): ServiceItem[] {
  return SERVICES[metier] ?? SERVICES.plombier;
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
};

export function metierLabel(m: string): string {
  return METIER_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);
}
