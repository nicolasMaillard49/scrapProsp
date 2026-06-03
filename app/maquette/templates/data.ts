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
  image: string;
}

/* ── Images Unsplash par métier pour la section À propos ── */
export const ABOUT_IMAGES: Record<string, string> = {
  plombier: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&h=1000&fit=crop&q=80",
  chauffagiste: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&h=1000&fit=crop&q=80",
  electricien: "/templates/electricien-hero.jpg",
  paysagiste: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=1000&fit=crop&q=80",
  couvreur: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&h=1000&fit=crop&q=80",
  maçon: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=1000&fit=crop&q=80",
  serrurier: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=1000&fit=crop&q=80",
  menuisier: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=1000&fit=crop&q=80",
  carreleur: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=1000&fit=crop&q=80",
  peintre: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&h=1000&fit=crop&q=80",
};

const DEFAULT_ABOUT_IMAGE = "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&h=1000&fit=crop&q=80";

export function getAboutImage(metier: string): string {
  return ABOUT_IMAGES[metier] ?? DEFAULT_ABOUT_IMAGE;
}

export const SERVICES: Record<string, ServiceItem[]> = {
  plombier: [
    {
      title: "Dépannage urgence",
      desc: "Intervention rapide 7j/7 pour fuites, canalisations bouchées et pannes de chauffe-eau.",
      icon: "🔧",
      image: "/templates/plombier-depannage.jpg",
    },
    {
      title: "Installation sanitaire",
      desc: "Pose de salles de bain, WC, douches et raccordements aux normes en vigueur.",
      icon: "🚿",
      image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Entretien chaudière",
      desc: "Contrat d'entretien annuel, détartrage et mise en conformité de vos installations.",
      icon: "🔥",
      image: "/templates/plombier-entretien-chaudiere.webp",
    },
    {
      title: "Rénovation",
      desc: "Réfection complète de salle de bain et cuisine, du plan à la livraison clé en main.",
      icon: "🏠",
      image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600&h=400&fit=crop&q=80",
    },
  ],
  chauffagiste: [
    {
      title: "Installation chauffage",
      desc: "Pose de chaudière gaz, pompe à chaleur et plancher chauffant.",
      icon: "🔥",
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Dépannage urgence",
      desc: "Intervention rapide pour panne de chauffage et fuite de gaz.",
      icon: "🔧",
      image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Entretien annuel",
      desc: "Contrat d'entretien, ramonage et mise en conformité.",
      icon: "📋",
      image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Énergies renouvelables",
      desc: "Solutions solaires, PAC et chauffe-eau thermodynamique.",
      icon: "☀️",
      image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop&q=80",
    },
  ],
  electricien: [
    {
      title: "Installation électrique",
      desc: "Câblage, tableaux et prises pour neuf et rénovation, conforme NF C 15-100.",
      icon: "⚡",
      image: "/templates/electricien-hero.jpg",
    },
    {
      title: "Mise aux normes",
      desc: "Diagnostic et mise en conformité de votre installation électrique.",
      icon: "✅",
      image: "/templates/electricien-mise-aux-normes.jpg",
    },
    {
      title: "Dépannage",
      desc: "Intervention rapide sur pannes, courts-circuits et coupures de courant.",
      icon: "🔧",
      image: "/templates/electricien-depannage.jpg",
    },
    {
      title: "Domotique",
      desc: "Automatisation de votre habitat : éclairage, volets, alarme et pilotage à distance.",
      icon: "🏠",
      image: "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&h=400&fit=crop&q=80",
    },
  ],
  paysagiste: [
    {
      title: "Création de jardins",
      desc: "Conception et réalisation d'espaces verts sur mesure, du plan au plantage.",
      icon: "🌿",
      image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Entretien espaces verts",
      desc: "Tonte, taille de haies, désherbage et entretien saisonnier régulier.",
      icon: "✂️",
      image: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Élagage",
      desc: "Taille et abattage d'arbres en toute sécurité par des professionnels certifiés.",
      icon: "🌳",
      image: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&h=400&fit=crop&q=80",
    },
    {
      title: "Aménagement extérieur",
      desc: "Terrasses, clôtures, allées et murets pour sublimer votre extérieur.",
      icon: "🏡",
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop&q=80",
    },
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
