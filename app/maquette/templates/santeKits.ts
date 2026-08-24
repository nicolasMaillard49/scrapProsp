// Kits de CONTENU des professions libérales — santé, juridique, chiffre.
//
// ⚠️ Ces métiers ne se vendent PAS comme un commerce. Publicité et démarchage
// leur sont déontologiquement encadrés : Code de la santé publique et codes de
// déontologie pour les soignants, RIN pour les avocats, règles de l'Ordre pour
// les notaires et les experts-comptables. Trois conséquences, appliquées ici :
//
//   1. AUCUN témoignage de patient ou de client. C'est explicitement interdit
//      aux professions de santé, et déconseillé aux autres. Là où les maquettes
//      commerçantes montrent des avis, celles-ci montrent des informations
//      pratiques et des questions fréquentes.
//   2. Aucune promesse de résultat, aucun superlatif, aucun comparatif. On
//      informe : ce qui est pris en charge, comment ça se passe, ce que ça
//      coûte, ce qui est remboursé.
//   3. Les tarifs sont donnés avec leur base de remboursement quand elle
//      existe — c'est une obligation d'information, et c'est ce que les gens
//      cherchent réellement.
//
// Le reste suit la même logique que nicheKits/artisanKits : le kit porte le
// contenu et l'offre, le composant porte la direction artistique.
//
// Images : IDs Unsplash vérifiés (HTTP 200).

import type { OfferKind } from "./nicheKits";

export interface SanteService {
  name: string;
  desc: string;
  /** En euros. 0 = « Pris en charge » ou « Offert » selon le contexte. */
  price: number;
  from?: boolean;
  unit?: string;
  cat: string;
  /** Base de remboursement, telle qu'on doit pouvoir l'annoncer. */
  refund?: string;
  /** Remplace le prix quand il n'y en a pas un (tarif réglementé, acte pris en
   *  charge). Sans ça, un « 0 € » se lit comme une erreur de saisie. */
  priceLabel?: string;
}

/* ── Modules signature, un par métier ───────────────────────── */

export interface ProtocoleModule {
  kind: "protocole";
  phases: Array<{ titre: string; desc: string; duree: string }>;
  motifs: string[];
}
export interface ZonesModule {
  kind: "zones";
  zones: Array<{ name: string; motifs: string[] }>;
  seance: { duree: string; prix: string; note: string };
}
export interface AppuiModule {
  kind: "appui";
  etapes: Array<{ titre: string; desc: string }>;
  semelles: { delai: string; prix: string; note: string };
}
export interface AgesModule {
  kind: "ages";
  groupes: Array<{ age: string; troubles: string[] }>;
  attente: string;
}
export interface SuiviModule {
  kind: "suivi";
  jalons: Array<{ titre: string; moment: string; desc: string }>;
  note: string;
}
export interface DevisModule {
  kind: "devis";
  lignes: Array<{ acte: string; honoraires: number; secu: number; reste: string }>;
  note: string;
  urgence: string;
}
export interface CabinetModule {
  kind: "cabinet";
  pratiques: Array<{ k: string; v: string }>;
  urgence: string;
}
export interface AnimauxModule {
  kind: "animaux";
  especes: string[];
  vaccins: Array<{ nom: string; rythme: string }>;
  urgence: string;
}
export interface SeanceModule {
  kind: "seance";
  deroule: Array<{ titre: string; desc: string }>;
  cadre: Array<{ k: string; v: string }>;
}
export interface AccompagnementModule {
  kind: "accompagnement";
  etapes: Array<{ titre: string; desc: string; quand: string }>;
  nonCe: string[];
}
export interface RespirationModule {
  kind: "respiration";
  minutes: Array<{ t: string; quoi: string }>;
  indications: string[];
}
export interface DossierModule {
  kind: "dossier";
  domaines: Array<{ name: string; desc: string }>;
  honoraires: Array<{ type: string; desc: string }>;
}
export interface ActesModule {
  kind: "actes";
  actes: Array<{ nom: string; delai: string; pieces: string }>;
  note: string;
}
export interface CalendrierModule {
  kind: "calendrier";
  echeances: Array<{ mois: string; quoi: string }>;
  forfaits: Array<{ structure: string; prix: number }>;
}

export type SanteModule =
  | ProtocoleModule
  | ZonesModule
  | AppuiModule
  | AgesModule
  | SuiviModule
  | DevisModule
  | CabinetModule
  | AnimauxModule
  | SeanceModule
  | AccompagnementModule
  | RespirationModule
  | DossierModule
  | ActesModule
  | CalendrierModule;

export interface SanteKit {
  accent: string;
  accentDark: string;
  hero: string;
  about: string;
  /** Portrait du praticien — cf. templates/portrait.tsx. */
  portrait: string;
  services: SanteService[];
  aboutText: string;
  ticker: string[];
  /** `booking` pour les métiers dont la maquette montre un agenda. */
  offer: OfferKind;
  bookingWord: string;
  promise: { lead: string; strong: string; sub: string };
  facts: Array<{ k: string; v: string }>;
  /** Informations pratiques — ce que les gens cherchent vraiment. */
  infos: Array<{ k: string; v: string }>;
  /** Questions fréquentes, factuelles. Remplacent les avis. */
  faq: Array<{ q: string; a: string }>;
  /** Diplômes, numéro d'ordre, conventionnement. */
  garanties: string[];
  labels: {
    catalogue: string;
    catalogueSub: string;
    catalogueNote: string;
    cta: string;
  };
  module: SanteModule;
}

const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/* ══ SANTÉ ═════════════════════════════════════════════════════ */

const DENTISTE: SanteKit = {
  accent: "#2B7FBF",
  accentDark: "#1F5E8E",
  hero: u("photo-1629909613654-28e377c37b09"),
  about: u("photo-1643916800611-1302e8d27c38"),
  portrait: "/templates/dentiste-portrait.webp",
  services: [
    { name: "Consultation et bilan", desc: "Examen complet, radiographies si nécessaire, plan de traitement remis.", price: 23, cat: "Consultation", refund: "remboursé à 70 % par l'Assurance maladie" },
    { name: "Détartrage", desc: "Nettoyage complet, polissage, conseils d'hygiène.", price: 28.92, cat: "Soins", refund: "remboursé à 70 %" },
    { name: "Traitement d'une carie", desc: "Composite teinte assortie, une à trois faces.", price: 26.97, from: true, cat: "Soins", refund: "remboursé à 70 %" },
    { name: "Couronne céramo-métallique", desc: "Empreinte, provisoire puis pose définitive.", price: 500, from: true, cat: "Prothèse", refund: "panier 100 % santé disponible sans reste à charge" },
    { name: "Implant dentaire", desc: "Pose du pilier et de la couronne, après étude osseuse.", price: 1800, from: true, cat: "Prothèse", refund: "non remboursé par l'Assurance maladie" },
    { name: "Urgence dentaire", desc: "Douleur aiguë, dent cassée, abcès : créneaux réservés chaque jour.", price: 23, from: true, cat: "Urgence" },
  ],
  aboutText:
    "Le cabinet de {name} reçoit à {ville} pour les soins courants, la prothèse et l'urgence. Chaque traitement fait l'objet d'un devis écrit avant d'être engagé, avec la part remboursée et le reste à charge estimé.",
  ticker: ["Devis avant tout traitement", "100 % santé proposé", "Urgences le jour même", "Carte Vitale acceptée"],
  offer: "booking",
  bookingWord: "l'agenda du cabinet",
  promise: { lead: "Le devis", strong: "avant les soins.", sub: "Chaque plan de traitement est chiffré ligne par ligne, avec la part Sécurité sociale et le reste à charge." },
  facts: [
    { k: "48 h", v: "de délai moyen pour une consultation" },
    { k: "0 €", v: "de reste à charge sur le panier 100 % santé" },
    { k: "7j/7", v: "créneaux d'urgence réservés chaque jour" },
  ],
  infos: [
    { k: "Conventionnement", v: "Secteur 1 — tarifs de la Sécurité sociale" },
    { k: "Carte Vitale", v: "Acceptée, télétransmission directe" },
    { k: "Tiers payant", v: "Sur la part obligatoire" },
    { k: "Accessibilité", v: "Cabinet de plain-pied, accès fauteuil" },
  ],
  faq: [
    { q: "Faut-il une ordonnance pour consulter ?", a: "Non. Le chirurgien-dentiste est en accès direct, sans passer par le médecin traitant." },
    { q: "Combien de temps garde-t-on un devis ?", a: "Le devis reste valable et n'engage à rien. Vous pouvez le transmettre à votre mutuelle avant de décider." },
    { q: "Que faire en cas de douleur le week-end ?", a: "Le cabinet indique le service de garde du département sur son répondeur. En cas d'urgence vitale, appelez le 15." },
  ],
  garanties: ["Chirurgien-dentiste inscrit à l'Ordre", "Secteur 1", "Stérilisation tracée"],
  labels: {
    catalogue: "Les",
    catalogueSub: "soins",
    catalogueNote: "Tarifs conventionnés. Les actes prothétiques font l'objet d'un devis écrit obligatoire.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "devis",
    lignes: [
      { acte: "Consultation", honoraires: 23, secu: 16.1, reste: "6,90 € (souvent pris par la mutuelle)" },
      { acte: "Détartrage", honoraires: 28.92, secu: 20.24, reste: "8,68 €" },
      { acte: "Couronne céramo-métallique", honoraires: 500, secu: 84, reste: "selon contrat — 0 € en 100 % santé" },
      { acte: "Implant + couronne", honoraires: 1800, secu: 0, reste: "1 800 € hors mutuelle" },
    ],
    note: "Exemples à titre indicatif, tarifs 2024. Votre devis personnalisé reprend ces trois colonnes : honoraires, base de remboursement, reste à charge estimé.",
    urgence: "Douleur aiguë, dent cassée, abcès : appelez le matin, des créneaux sont gardés libres chaque jour.",
  },
};

const KINE: SanteKit = {
  accent: "#1F7A6B",
  accentDark: "#155A4F",
  hero: u("photo-1649751361457-01d3a696c7e6"),
  about: u("photo-1770012905139-713758ded6ec"),
  portrait: "/templates/kine-portrait.webp",
  services: [
    { name: "Bilan initial", desc: "Examen, tests fonctionnels et objectifs de rééducation définis avec vous.", price: 16.13, cat: "Bilan", refund: "remboursé à 60 %, prescription requise" },
    { name: "Séance de rééducation", desc: "30 minutes en individuel, thérapie manuelle et exercices actifs.", price: 16.13, cat: "Séance", refund: "remboursé à 60 %" },
    { name: "Rééducation post-opératoire", desc: "Protocole suivi avec le chirurgien, du retrait d'attelle à la reprise.", price: 16.13, cat: "Séance", refund: "remboursé à 60 %" },
    { name: "Kinésithérapie respiratoire", desc: "Nourrissons et adultes, désencombrement bronchique.", price: 16.13, cat: "Séance", refund: "remboursé à 60 %" },
    { name: "Rééducation du sportif", desc: "Reprise progressive, tests de réathlétisation avant retour au terrain.", price: 35, from: true, cat: "Hors nomenclature", refund: "non remboursé" },
    { name: "Séance à domicile", desc: "Pour les patients qui ne peuvent pas se déplacer, sur prescription.", price: 16.13, cat: "Domicile", refund: "indemnité de déplacement en sus" },
  ],
  aboutText:
    "Le cabinet de {name} reçoit à {ville} sur prescription médicale. Chaque prise en charge commence par un bilan, se poursuit en séances individuelles de trente minutes, et se termine par un programme d'entretien que vous emportez.",
  ticker: ["Conventionné secteur 1", "Séances individuelles", "Bilan à chaque prise en charge", "Sur prescription"],
  offer: "booking",
  bookingWord: "le planning du cabinet",
  promise: { lead: "Un protocole,", strong: "pas une série de séances.", sub: "Bilan, phases de rééducation, critères de sortie : ce qui est prévu est écrit dès le premier rendez-vous." },
  facts: [
    { k: "30 min", v: "de séance individuelle, sans plateau partagé" },
    { k: "60 %", v: "remboursés par l'Assurance maladie" },
    { k: "4 phases", v: "du bilan à l'autonomie" },
  ],
  infos: [
    { k: "Conventionnement", v: "Secteur 1 — tarifs conventionnés" },
    { k: "Prescription", v: "Requise pour une prise en charge remboursée" },
    { k: "Carte Vitale", v: "Acceptée, télétransmission directe" },
    { k: "Accessibilité", v: "Cabinet accessible aux personnes à mobilité réduite" },
  ],
  faq: [
    { q: "Faut-il une ordonnance ?", a: "Oui pour un remboursement. L'accès direct existe dans certains cas, mais la prise en charge par l'Assurance maladie suppose une prescription." },
    { q: "Combien de séances sont nécessaires ?", a: "Le nombre est fixé au bilan et réévalué en cours de prise en charge. Il figure sur le compte rendu adressé au médecin." },
    { q: "Les séances sont-elles individuelles ?", a: "Oui, trente minutes en individuel. Certains exercices d'autonomie se font ensuite en salle, sous surveillance." },
  ],
  garanties: ["Diplôme d'État", "Numéro ADELI", "Conventionné secteur 1"],
  labels: {
    catalogue: "Les",
    catalogueSub: "prises en charge",
    catalogueNote: "Tarifs conventionnés. Les actes hors nomenclature sont annoncés avant la séance.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "protocole",
    phases: [
      { titre: "Le bilan", desc: "Tests articulaires et musculaires, douleur cotée, objectifs écrits.", duree: "45 min" },
      { titre: "La phase antalgique", desc: "Réduire la douleur et récupérer les amplitudes. Thérapie manuelle.", duree: "2 à 4 semaines" },
      { titre: "Le renforcement", desc: "Retour de la force et du contrôle, exercices progressifs.", duree: "4 à 8 semaines" },
      { titre: "L'autonomie", desc: "Programme d'entretien à faire seul, critères de sortie vérifiés.", duree: "dernière séance" },
    ],
    motifs: [
      "Lombalgie et cervicalgie",
      "Entorse de cheville ou de genou",
      "Suites de prothèse de hanche ou de genou",
      "Tendinopathie de l'épaule",
      "Rééducation respiratoire",
      "Troubles de l'équilibre de la personne âgée",
    ],
  },
};

const OSTEOPATHE: SanteKit = {
  accent: "#C97B4A",
  accentDark: "#9C5B31",
  hero: u("photo-1723804685588-b8e95b2044f3"),
  about: u("photo-1763279934323-edb3735f6a6e"),
  portrait: "/templates/osteopathe-portrait.webp",
  services: [
    { name: "Consultation adulte", desc: "Anamnèse, tests, traitement manuel et conseils. Une heure.", price: 60, cat: "Consultation", refund: "non remboursé par la Sécurité sociale, souvent pris en charge par les mutuelles" },
    { name: "Consultation nourrisson", desc: "Après examen médical préalable. Techniques douces adaptées.", price: 60, cat: "Consultation", refund: "prise en charge mutuelle possible" },
    { name: "Consultation femme enceinte", desc: "Suivi du bassin et du dos pendant et après la grossesse.", price: 60, cat: "Consultation", refund: "prise en charge mutuelle possible" },
    { name: "Consultation sportif", desc: "Préparation, récupération, suivi de saison.", price: 60, cat: "Consultation", refund: "prise en charge mutuelle possible" },
    { name: "Consultation à domicile", desc: "Pour les personnes qui ne peuvent pas se déplacer.", price: 80, cat: "Domicile" },
  ],
  aboutText:
    "{name} reçoit à {ville} en consultation d'ostéopathie. Chaque séance commence par un interrogatoire et des tests, et l'ostéopathie ne remplace ni un avis médical ni un traitement en cours : en cas de signe d'alerte, la consultation est réorientée vers un médecin.",
  ticker: ["Ostéopathe D.O.", "Séance d'une heure", "Sur rendez-vous", "Prise en charge mutuelle"],
  offer: "booking",
  bookingWord: "l'agenda",
  promise: { lead: "Une heure,", strong: "et tout le corps.", sub: "Le motif est un point d'entrée, pas une frontière : les tests explorent l'ensemble, pas seulement l'endroit qui fait mal." },
  facts: [
    { k: "60 min", v: "de consultation, tests compris" },
    { k: "D.O.", v: "diplôme d'ostéopathie, formation en 5 ans" },
    { k: "0 €", v: "de dépassement — tarif unique annoncé" },
  ],
  infos: [
    { k: "Remboursement", v: "Non pris en charge par l'Assurance maladie" },
    { k: "Mutuelle", v: "Facture remise, la plupart des contrats remboursent" },
    { k: "Paiement", v: "Carte, chèque et espèces" },
    { k: "Accessibilité", v: "Cabinet en rez-de-chaussée" },
  ],
  faq: [
    { q: "Faut-il une ordonnance ?", a: "Non, l'ostéopathie est en accès direct. Certains motifs supposent toutefois un examen médical préalable, notamment chez le nourrisson." },
    { q: "L'ostéopathie remplace-t-elle un traitement ?", a: "Non. Elle ne se substitue ni à un avis médical, ni à un traitement en cours. Aucun traitement prescrit ne doit être arrêté sans l'avis du médecin." },
    { q: "Combien de séances ?", a: "Le plus souvent une à trois, réévaluées à chaque fois. Une amélioration doit être perceptible ; sans elle, la prise en charge est réorientée." },
  ],
  garanties: ["Ostéopathe D.O.", "Numéro ADELI", "Formation 5 ans"],
  labels: {
    catalogue: "Les",
    catalogueSub: "consultations",
    catalogueNote: "Tarif unique quel que soit le motif. Facture remise pour votre mutuelle.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "zones",
    zones: [
      { name: "Dos et bassin", motifs: ["Lombalgie", "Sciatalgie", "Blocage après un faux mouvement", "Douleur du coccyx"] },
      { name: "Nuque et tête", motifs: ["Cervicalgie", "Céphalées de tension", "Suites de coup du lapin", "Troubles de la mâchoire"] },
      { name: "Membres", motifs: ["Épaule douloureuse", "Genou du coureur", "Entorse ancienne mal récupérée", "Douleur du poignet"] },
      { name: "Viscéral et périnatal", motifs: ["Troubles digestifs fonctionnels", "Suivi de grossesse", "Nourrisson : plagiocéphalie, régurgitations", "Suites de césarienne"] },
    ],
    seance: {
      duree: "60 minutes",
      prix: "60 €",
      note: "Interrogatoire, tests, traitement puis conseils. Le motif de consultation ne limite pas l'examen : la douleur et sa cause ne sont pas toujours au même endroit.",
    },
  },
};

const PODOLOGUE: SanteKit = {
  accent: "#E4572E",
  accentDark: "#B33F1D",
  hero: u("photo-1545463913-5083aa7359a6"),
  about: u("photo-1770012905139-713758ded6ec"),
  portrait: "/templates/podologue-portrait.webp",
  services: [
    { name: "Soin de pédicurie", desc: "Cors, durillons, ongles incarnés, hyperkératose.", price: 35, from: true, cat: "Pédicurie", refund: "non remboursé, sauf patients diabétiques" },
    { name: "Bilan podologique", desc: "Examen statique et dynamique, analyse de la marche.", price: 55, cat: "Bilan", refund: "prise en charge mutuelle fréquente" },
    { name: "Semelles orthopédiques", desc: "Conception sur moulage, réalisation et essayage.", price: 160, from: true, cat: "Orthèse", refund: "remboursé sur prescription, part mutuelle variable" },
    { name: "Suivi du pied diabétique", desc: "Gradation du risque, soins et prévention des plaies.", price: 27, cat: "Prévention", refund: "pris en charge selon le grade" },
    { name: "Orthoplastie", desc: "Petit appareillage en silicone pour orteil déformé.", price: 60, from: true, cat: "Orthèse" },
    { name: "Consultation enfant", desc: "Marche, croissance, pieds plats : suivi jusqu'à la fin de croissance.", price: 55, cat: "Bilan" },
  ],
  aboutText:
    "{name} reçoit à {ville} pour les soins de pédicurie et la podologie. Les semelles sont conçues après un examen de la marche, moulées au cabinet, et réajustées à l'essayage puis au contrôle.",
  ticker: ["Diplôme d'État", "Semelles sur mesure", "Suivi du pied diabétique", "Sur rendez-vous"],
  offer: "booking",
  bookingWord: "l'agenda",
  promise: { lead: "L'appui d'abord,", strong: "la semelle ensuite.", sub: "Une semelle qui ne repose sur aucun examen de la marche ne corrige rien. Voici les quatre étapes." },
  facts: [
    { k: "4 étapes", v: "de l'examen au contrôle à un mois" },
    { k: "15 jours", v: "de délai de fabrication des semelles" },
    { k: "D.E.", v: "pédicure-podologue diplômé d'État" },
  ],
  infos: [
    { k: "Prescription", v: "Utile pour le remboursement des orthèses" },
    { k: "Remboursement", v: "Semelles prises en charge sur prescription" },
    { k: "Patients diabétiques", v: "Séances de prévention prises en charge selon le grade" },
    { k: "Accessibilité", v: "Cabinet de plain-pied" },
  ],
  faq: [
    { q: "Faut-il une ordonnance ?", a: "L'accès est direct, mais une prescription est nécessaire pour le remboursement des semelles orthopédiques." },
    { q: "Combien de temps se garde une paire de semelles ?", a: "Environ un an chez l'adulte, moins chez l'enfant en croissance. Un contrôle est prévu à un mois puis à un an." },
    { q: "Les semelles font-elles mal au début ?", a: "Une adaptation de quelques jours est normale. Une douleur qui persiste justifie un réajustement, prévu sans frais." },
  ],
  garanties: ["Diplôme d'État", "Numéro ADELI", "Fabrication au cabinet"],
  labels: {
    catalogue: "Les",
    catalogueSub: "prestations",
    catalogueNote: "Tarifs indicatifs. Les orthèses font l'objet d'un devis avant fabrication.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "appui",
    etapes: [
      { titre: "L'examen", desc: "Pieds, genoux, bassin. Recherche des appuis excessifs et des zones de conflit." },
      { titre: "L'analyse de la marche", desc: "Marche et course observées, plateforme de pression si nécessaire." },
      { titre: "Le moulage", desc: "Empreinte prise au cabinet, éléments de correction posés élément par élément." },
      { titre: "L'essayage et le contrôle", desc: "Ajustement à la remise, puis contrôle à un mois. Retouches comprises." },
    ],
    semelles: {
      delai: "15 jours",
      prix: "dès 160 €",
      note: "Sur prescription, les semelles sont remboursées par l'Assurance maladie sur une base forfaitaire ; la mutuelle complète selon le contrat.",
    },
  },
};

const ORTHOPHONISTE: SanteKit = {
  accent: "#D2694E",
  accentDark: "#A94F38",
  hero: u("photo-1762625570087-6d98fca29531"),
  about: u("photo-1680773525486-3313809b1a14"),
  portrait: "/templates/orthophoniste-portrait.webp",
  services: [
    { name: "Bilan orthophonique", desc: "Évaluation complète, compte rendu écrit adressé au prescripteur.", price: 75, from: true, cat: "Bilan", refund: "remboursé à 60 % sur prescription" },
    { name: "Séance de rééducation", desc: "30 minutes en individuel, rythme défini au bilan.", price: 30, cat: "Séance", refund: "remboursé à 60 %" },
    { name: "Rééducation du langage écrit", desc: "Dyslexie, dysorthographie : travail en lien avec l'école.", price: 30, cat: "Séance", refund: "remboursé à 60 %" },
    { name: "Troubles de la déglutition", desc: "Adulte, après AVC ou maladie neurologique.", price: 30, cat: "Séance", refund: "remboursé à 60 %" },
    { name: "Rééducation de la voix", desc: "Voix professionnelle, suites de chirurgie des cordes vocales.", price: 30, cat: "Séance", refund: "remboursé à 60 %" },
  ],
  aboutText:
    "{name} reçoit à {ville} sur prescription médicale. Chaque prise en charge commence par un bilan dont le compte rendu est adressé au médecin, et se poursuit en séances individuelles, en lien avec la famille et l'école quand il s'agit d'un enfant.",
  ticker: ["Sur prescription", "Bilan avant toute rééducation", "Conventionné", "Lien avec l'école"],
  offer: "booking",
  bookingWord: "le planning",
  promise: { lead: "Ce qui se travaille,", strong: "et à quel âge.", sub: "Les troubles pris en charge ne sont pas les mêmes à 5 ans, à 12 ans et à 70 ans. Voici la répartition." },
  facts: [
    { k: "30 min", v: "de séance individuelle" },
    { k: "60 %", v: "remboursés sur prescription" },
    { k: "Bilan", v: "systématique avant toute rééducation" },
  ],
  infos: [
    { k: "Prescription", v: "Obligatoire — bilan puis rééducation" },
    { k: "Conventionnement", v: "Secteur 1, tarifs conventionnés" },
    { k: "Délai d'attente", v: "Communiqué honnêtement au premier appel" },
    { k: "Accessibilité", v: "Cabinet accessible, salle d'attente calme" },
  ],
  faq: [
    { q: "Faut-il une ordonnance ?", a: "Oui, pour le bilan comme pour la rééducation. Le médecin traitant, le pédiatre ou un spécialiste peut la rédiger." },
    { q: "Quel est le délai pour un premier rendez-vous ?", a: "Il varie selon la période et le motif ; il vous est annoncé au téléphone, sans attente sur liste fantôme." },
    { q: "Les parents assistent-ils aux séances ?", a: "Selon l'âge et l'objectif. Un temps d'échange est prévu régulièrement pour transmettre ce qui se travaille à la maison." },
  ],
  garanties: ["Certificat de capacité d'orthophoniste", "Numéro ADELI", "Conventionné"],
  labels: {
    catalogue: "Les",
    catalogueSub: "prises en charge",
    catalogueNote: "Tarifs conventionnés. Le bilan conditionne le nombre et le rythme des séances.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "ages",
    groupes: [
      { age: "Enfant — avant 6 ans", troubles: ["Retard de parole et de langage", "Trouble d'articulation", "Bégaiement débutant", "Suivi des troubles du neurodéveloppement"] },
      { age: "Enfant — âge scolaire", troubles: ["Dyslexie et dysorthographie", "Dyscalculie", "Trouble de la compréhension écrite", "Difficultés d'attention au langage"] },
      { age: "Adolescent et adulte", troubles: ["Bégaiement", "Voix professionnelle", "Suites de chirurgie ORL", "Trouble de la déglutition"] },
      { age: "Après un accident neurologique", troubles: ["Aphasie après AVC", "Maladie neurodégénérative", "Troubles de la déglutition", "Maintien de la communication"] },
    ],
    attente:
      "Le délai pour un premier bilan varie selon la période. Il vous est annoncé au téléphone, et vous êtes rappelé en cas de désistement.",
  },
};

const SAGEFEMME: SanteKit = {
  accent: "#B26A80",
  accentDark: "#8C4D61",
  hero: u("photo-1779281887548-f676406dea2f"),
  about: u("photo-1634712282287-14ed57b9cc89"),
  portrait: "/templates/sagefemme-portrait.webp",
  services: [
    { name: "Suivi de grossesse", desc: "Consultations mensuelles, examens et prescriptions.", price: 25, from: true, cat: "Grossesse", refund: "remboursé à 100 % à partir du 6e mois" },
    { name: "Préparation à la naissance", desc: "Huit séances prises en charge, en groupe ou en individuel.", price: 0, priceLabel: "Pris en charge", cat: "Grossesse", refund: "8 séances prises en charge à 100 %" },
    { name: "Consultation post-natale", desc: "Contrôle à six semaines, contraception, cicatrisation.", price: 25, from: true, cat: "Après", refund: "remboursé à 100 %" },
    { name: "Rééducation du périnée", desc: "Bilan puis séances, à partir de six semaines après l'accouchement.", price: 25, from: true, cat: "Après", refund: "10 séances prises en charge" },
    { name: "Suivi gynécologique de prévention", desc: "Frottis, contraception, dépistages. Sans être enceinte.", price: 25, from: true, cat: "Prévention", refund: "remboursé à 70 %" },
    { name: "Visite à domicile", desc: "Retour de maternité, allaitement, pesée du nouveau-né.", price: 25, from: true, cat: "Domicile", refund: "prise en charge, indemnité de déplacement en sus" },
  ],
  aboutText:
    "{name} exerce à {ville} auprès des femmes, enceintes ou non : suivi de grossesse, préparation, retour à la maison, rééducation et suivi gynécologique de prévention. Les consultations durent le temps qu'il faut et l'orientation vers le médecin ou la maternité se fait dès qu'elle s'impose.",
  ticker: ["Sage-femme diplômée d'État", "Suivi à 100 % dès le 6e mois", "Visites à domicile", "Sur rendez-vous"],
  offer: "booking",
  bookingWord: "l'agenda",
  promise: { lead: "Du premier mois", strong: "au retour à la maison.", sub: "Ce qui est prévu, quand, et ce qui est pris en charge — la frise complète du suivi." },
  facts: [
    { k: "100 %", v: "de prise en charge à partir du 6e mois" },
    { k: "8 séances", v: "de préparation prises en charge" },
    { k: "7j/7", v: "visites à domicile au retour de maternité" },
  ],
  infos: [
    { k: "Conventionnement", v: "Secteur 1 — tarifs conventionnés" },
    { k: "Carte Vitale", v: "Acceptée, télétransmission directe" },
    { k: "Domicile", v: "Visites possibles après l'accouchement" },
    { k: "Accessibilité", v: "Cabinet accessible, table d'examen adaptée" },
  ],
  faq: [
    { q: "Faut-il être enceinte pour consulter ?", a: "Non. La sage-femme assure aussi le suivi gynécologique de prévention et la contraception des femmes en bonne santé." },
    { q: "À partir de quand le suivi est-il remboursé à 100 % ?", a: "À partir du sixième mois de grossesse, tous les actes liés à la grossesse sont pris en charge intégralement." },
    { q: "Que se passe-t-il en cas de complication ?", a: "Le suivi est immédiatement réorienté vers le gynécologue ou la maternité. La sage-femme suit les grossesses à bas risque." },
  ],
  garanties: ["Diplôme d'État", "Numéro RPPS", "Conventionnée secteur 1"],
  labels: {
    catalogue: "Les",
    catalogueSub: "consultations",
    catalogueNote: "Tarifs conventionnés. La prise en charge varie selon le terme de la grossesse.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "suivi",
    jalons: [
      { titre: "Déclaration et premier trimestre", moment: "1er — 3e mois", desc: "Déclaration de grossesse, prescriptions, échographie datée." },
      { titre: "Suivi mensuel", moment: "4e — 5e mois", desc: "Consultation par mois, examens, réponses aux questions du quotidien." },
      { titre: "Préparation à la naissance", moment: "6e — 8e mois", desc: "Huit séances prises en charge, respiration, positions, projet de naissance." },
      { titre: "Dernier mois", moment: "9e mois", desc: "Surveillance rapprochée, signes qui doivent faire partir à la maternité." },
      { titre: "Retour à la maison", moment: "jours suivants", desc: "Visites à domicile : pesée, allaitement, cicatrisation, sommeil." },
      { titre: "Rééducation et suivi", moment: "à 6 semaines", desc: "Consultation post-natale, contraception, puis rééducation du périnée." },
    ],
    note: "Le suivi est prévu pour une grossesse à bas risque. Toute complication est réorientée vers la maternité ou le gynécologue — c'est le cadre légal de l'exercice.",
  },
};

const MEDECIN: SanteKit = {
  accent: "#2F6DB5",
  accentDark: "#224E82",
  hero: u("photo-1771574204208-b47e2d863bc5"),
  about: u("photo-1576085898384-b3cdb88736e9"),
  portrait: "/templates/medecin-portrait.webp",
  services: [
    { name: "Consultation au cabinet", desc: "Consultation de médecine générale, adulte et enfant.", price: 26.5, cat: "Consultation", refund: "remboursé à 70 % dans le parcours de soins" },
    { name: "Visite à domicile", desc: "Réservée aux patients qui ne peuvent pas se déplacer.", price: 36.5, from: true, cat: "Domicile", refund: "remboursé à 70 %, majorations incluses" },
    { name: "Consultation de suivi ALD", desc: "Affection de longue durée, renouvellement et coordination.", price: 26.5, cat: "Suivi", refund: "pris en charge à 100 % pour l'ALD" },
    { name: "Certificat médical", desc: "Sport, crèche, aptitude. Établi après examen.", price: 26.5, from: true, cat: "Administratif", refund: "non remboursé" },
    { name: "Vaccination", desc: "Calendrier vaccinal, rappels, vaccination grippe.", price: 26.5, cat: "Prévention", refund: "remboursé à 70 %" },
    { name: "Téléconsultation", desc: "Pour les patients suivis au cabinet, sur créneaux dédiés.", price: 26.5, cat: "Consultation", refund: "remboursé à 70 %" },
  ],
  aboutText:
    "Le cabinet de {name} reçoit à {ville} sur rendez-vous. Ces pages réunissent les informations pratiques dont on a besoin avant d'appeler : horaires, conventionnement, moyens de paiement, conduite à tenir en cas d'urgence et organisation pendant les absences.",
  ticker: ["Secteur 1", "Carte Vitale", "Sur rendez-vous", "Médecin traitant"],
  offer: "booking",
  bookingWord: "l'agenda du cabinet",
  promise: { lead: "Les informations", strong: "pratiques du cabinet.", sub: "Horaires, conventionnement, urgences, absences : ce qu'il faut savoir avant d'appeler." },
  facts: [
    { k: "Secteur 1", v: "aucun dépassement d'honoraires" },
    { k: "26,50 €", v: "tarif d'une consultation" },
    { k: "15", v: "le numéro à composer en cas d'urgence vitale" },
  ],
  infos: [
    { k: "Conventionnement", v: "Secteur 1 — pas de dépassement" },
    { k: "Carte Vitale", v: "Acceptée, télétransmission directe" },
    { k: "Tiers payant", v: "Sur la part obligatoire, et intégral pour les ALD et la CSS" },
    { k: "Accessibilité", v: "Cabinet accessible aux personnes à mobilité réduite" },
  ],
  faq: [
    { q: "Comment obtenir un rendez-vous rapidement ?", a: "Des créneaux de consultation non programmée sont ouverts chaque matin pour les patients du cabinet." },
    { q: "Que faire la nuit ou le week-end ?", a: "Contactez la permanence de soins au 116 117. En cas d'urgence vitale, appelez le 15." },
    { q: "Le cabinet prend-il de nouveaux patients comme médecin traitant ?", a: "La réponse dépend de la file active du moment ; elle est donnée au téléphone, sans faire attendre." },
  ],
  garanties: ["Docteur en médecine", "Numéro RPPS", "Conventionné secteur 1"],
  labels: {
    catalogue: "Les",
    catalogueSub: "consultations",
    catalogueNote: "Tarifs conventionnés secteur 1. Le remboursement suppose de respecter le parcours de soins.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "cabinet",
    pratiques: [
      { k: "Horaires de consultation", v: "Lundi au vendredi, 8 h 30 – 19 h. Samedi matin sur rendez-vous." },
      { k: "Rendez-vous", v: "En ligne à toute heure, ou par téléphone aux heures d'ouverture." },
      { k: "Consultation non programmée", v: "Créneaux ouverts chaque matin pour les patients du cabinet." },
      { k: "Moyens de paiement", v: "Carte, chèque, espèces. Tiers payant sur la part obligatoire." },
      { k: "Pendant les absences", v: "Le répondeur indique le confrère qui assure la continuité des soins." },
      { k: "Résultats et ordonnances", v: "Transmis via la messagerie sécurisée de santé, jamais par courriel simple." },
    ],
    urgence:
      "En cas d'urgence vitale, appelez le 15. La nuit, le week-end et les jours fériés, la permanence de soins répond au 116 117.",
  },
};

const VETERINAIRE: SanteKit = {
  accent: "#C4762B",
  accentDark: "#96581D",
  hero: u("photo-1644675443401-ea4c14bad0e6"),
  about: u("photo-1770836037793-95bdbf190f71"),
  portrait: "/templates/veterinaire-portrait.webp",
  services: [
    { name: "Consultation", desc: "Examen complet, poids, dents, vaccination à jour vérifiée.", price: 45, from: true, cat: "Consultation" },
    { name: "Vaccination annuelle", desc: "Rappel selon le protocole de l'animal, consultation comprise.", price: 65, from: true, cat: "Prévention" },
    { name: "Stérilisation", desc: "Chirurgie, anesthésie et suivi post-opératoire compris.", price: 180, from: true, cat: "Chirurgie" },
    { name: "Détartrage", desc: "Sous anesthésie, avec bilan pré-anesthésique.", price: 190, from: true, cat: "Chirurgie" },
    { name: "Identification par puce", desc: "Pose et enregistrement au fichier national I-CAD.", price: 70, from: true, cat: "Prévention" },
    { name: "Urgence", desc: "Sans rendez-vous aux heures d'ouverture, astreinte la nuit.", price: 90, from: true, cat: "Urgence" },
  ],
  aboutText:
    "La clinique de {name} reçoit à {ville} pour la médecine courante, la chirurgie et les urgences. Chaque acte chirurgical fait l'objet d'un devis avant l'intervention, et vous êtes rappelé le soir même pour savoir comment votre animal se réveille.",
  ticker: ["Urgences 24h/24", "Devis avant chirurgie", "Identification I-CAD", "Hospitalisation sur place"],
  offer: "booking",
  bookingWord: "l'agenda de la clinique",
  promise: { lead: "Une urgence,", strong: "à n'importe quelle heure.", sub: "Astreinte la nuit et le week-end, devis avant toute chirurgie, rappel le soir de l'intervention." },
  facts: [
    { k: "24h/24", v: "astreinte pour les urgences" },
    { k: "Devis", v: "systématique avant toute chirurgie" },
    { k: "I-CAD", v: "identification enregistrée au fichier national" },
  ],
  infos: [
    { k: "Espèces reçues", v: "Chiens, chats et nouveaux animaux de compagnie" },
    { k: "Paiement", v: "Carte, chèque, espèces. Facilités possibles sur les gros actes." },
    { k: "Assurance santé animale", v: "Feuille de soins remplie sur place" },
    { k: "Parking", v: "Places devant la clinique" },
  ],
  faq: [
    { q: "Que faire en cas d'urgence la nuit ?", a: "Appelez le numéro de la clinique : il bascule sur le vétérinaire d'astreinte, qui vous dit quoi faire et vous reçoit si nécessaire." },
    { q: "À quel âge stériliser ?", a: "Cela dépend de l'espèce, de la race et du mode de vie. La question se discute en consultation, sans réponse unique." },
    { q: "L'identification est-elle obligatoire ?", a: "Oui pour les chiens, les chats et les furets. Elle conditionne aussi tout voyage à l'étranger." },
  ],
  garanties: ["Docteur vétérinaire", "Ordre des vétérinaires", "Matériel d'imagerie sur place"],
  labels: {
    catalogue: "Les",
    catalogueSub: "actes",
    catalogueNote: "Tarifs indicatifs TTC. Un devis est établi avant toute chirurgie.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "animaux",
    especes: ["Chien", "Chat", "Lapin", "Furet", "Rongeurs", "Oiseaux"],
    vaccins: [
      { nom: "Chien — CHPPiL", rythme: "primo-vaccination puis rappel annuel" },
      { nom: "Chat — typhus, coryza, leucose", rythme: "rappel annuel" },
      { nom: "Rage", rythme: "obligatoire pour voyager, rappel selon le vaccin" },
      { nom: "Lapin — myxomatose, VHD", rythme: "rappel annuel" },
    ],
    urgence:
      "Aux heures d'ouverture, les urgences passent sans rendez-vous. La nuit, le week-end et les jours fériés, le numéro de la clinique bascule sur le vétérinaire d'astreinte.",
  },
};

const PSYCHOLOGUE: SanteKit = {
  accent: "#56657A",
  accentDark: "#3E4A5B",
  hero: u("photo-1680773525486-3313809b1a14"),
  about: u("photo-1619992677751-cb736bd47e2e"),
  portrait: "/templates/psychologue-portrait.webp",
  services: [
    { name: "Première séance", desc: "Faire le point sur la demande, poser le cadre, décider de la suite.", price: 60, cat: "Consultation" },
    { name: "Séance de suivi", desc: "45 à 50 minutes, à un rythme défini ensemble.", price: 60, cat: "Consultation", refund: "remboursable via Mon soutien psy, sous conditions" },
    { name: "Séance en visio", desc: "Même durée, même tarif, pour les suivis à distance.", price: 60, cat: "À distance" },
    { name: "Consultation adolescent", desc: "Avec un temps parental au début, puis en individuel.", price: 60, cat: "Consultation" },
    { name: "Entretien de couple", desc: "Une heure, les deux personnes présentes.", price: 85, cat: "Consultation" },
  ],
  aboutText:
    "{name} reçoit à {ville} en consultation de psychologie. La première séance sert à comprendre la demande et à vérifier que le cadre proposé convient ; la suite n'est décidée qu'ensuite, sans engagement de durée.",
  ticker: ["Psychologue diplômé", "Numéro ADELI", "Secret professionnel", "Consultations en visio"],
  offer: "booking",
  bookingWord: "l'agenda",
  promise: { lead: "La première séance,", strong: "sans engagement.", sub: "Ce qui s'y passe, ce qu'elle coûte, ce qui est confidentiel : le cadre est posé avant de commencer." },
  facts: [
    { k: "50 min", v: "de séance" },
    { k: "60 €", v: "tarif unique, annoncé d'avance" },
    { k: "Secret", v: "professionnel, sans exception commerciale" },
  ],
  infos: [
    { k: "Remboursement", v: "Non pris en charge hors dispositif Mon soutien psy" },
    { k: "Mutuelle", v: "Certaines complémentaires remboursent quelques séances" },
    { k: "Visio", v: "Possible, même durée et même tarif" },
    { k: "Annulation", v: "Prévenir 24 h avant, sans frais" },
  ],
  faq: [
    { q: "Faut-il une ordonnance ?", a: "Non, la consultation est en accès direct. Une adresse par le médecin est nécessaire uniquement dans le cadre du dispositif Mon soutien psy." },
    { q: "Combien de temps dure un suivi ?", a: "Cela dépend de la demande. Le point est fait régulièrement, et l'arrêt se décide ensemble." },
    { q: "Ce qui est dit reste-t-il confidentiel ?", a: "Oui. Le psychologue est tenu au secret professionnel, y compris vis-à-vis de la famille et de l'employeur." },
  ],
  garanties: ["Titre de psychologue protégé", "Numéro ADELI", "Secret professionnel"],
  labels: {
    catalogue: "Les",
    catalogueSub: "consultations",
    catalogueNote: "Tarif annoncé avant la première séance. Aucun engagement de durée.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "seance",
    deroule: [
      { titre: "Ce qui vous amène", desc: "Vous racontez à votre rythme. Aucune question n'est obligatoire." },
      { titre: "Le point de départ", desc: "On repère ensemble ce qui pèse, depuis quand, et ce qui a déjà été tenté." },
      { titre: "Le cadre", desc: "Durée, rythme, tarif, confidentialité. Vous savez à quoi vous vous engagez." },
      { titre: "La suite", desc: "Poursuivre, réorienter vers un confrère ou un médecin : la décision se prend à la fin de la séance." },
    ],
    cadre: [
      { k: "Durée", v: "50 minutes" },
      { k: "Tarif", v: "60 € la séance, annoncé avant" },
      { k: "Rythme", v: "Hebdomadaire au début, espacé ensuite" },
      { k: "Confidentialité", v: "Secret professionnel, sans exception" },
    ],
  },
};

const DIETETICIEN: SanteKit = {
  accent: "#5B8F3E",
  accentDark: "#446C2D",
  hero: u("photo-1512621776951-a57141f2eefd"),
  about: u("photo-1568158879083-c42860933ed7"),
  portrait: "/templates/dieteticien-portrait.webp",
  services: [
    { name: "Bilan diététique", desc: "Habitudes, antécédents, objectifs. Une heure.", price: 60, cat: "Bilan", refund: "prise en charge mutuelle fréquente" },
    { name: "Consultation de suivi", desc: "30 minutes, ajustements et points de blocage.", price: 40, cat: "Suivi" },
    { name: "Accompagnement pathologie", desc: "Diabète, cholestérol, hypertension, en lien avec le médecin.", price: 60, from: true, cat: "Pathologie" },
    { name: "Troubles digestifs", desc: "Protocole d'éviction puis réintroduction, encadré.", price: 60, from: true, cat: "Pathologie" },
    { name: "Nutrition du sportif", desc: "Répartition, ravitaillement, récupération.", price: 60, cat: "Sport" },
    { name: "Consultation en visio", desc: "Même durée, pour les suivis à distance.", price: 50, cat: "À distance" },
  ],
  aboutText:
    "{name} reçoit à {ville} en consultation de diététique. L'accompagnement part de ce que vous mangez réellement, pas d'un modèle : l'objectif est de tenir dans six mois, pas de perdre vite puis de tout reprendre.",
  ticker: ["Diététicien diplômé", "Numéro ADELI", "Sans régime restrictif", "Suivi personnalisé"],
  offer: "booking",
  bookingWord: "l'agenda",
  promise: { lead: "Un accompagnement,", strong: "pas un régime.", sub: "Bilan, plan réaliste, suivi. Et ce que ce n'est pas — dit clairement dès le début." },
  facts: [
    { k: "3 étapes", v: "du bilan au suivi espacé" },
    { k: "60 min", v: "de bilan initial" },
    { k: "D.E.", v: "diététicien nutritionniste diplômé d'État" },
  ],
  infos: [
    { k: "Remboursement", v: "Non pris en charge par l'Assurance maladie" },
    { k: "Mutuelle", v: "Beaucoup de contrats remboursent quelques consultations" },
    { k: "Prescription", v: "Pas nécessaire, accès direct" },
    { k: "Visio", v: "Possible pour les consultations de suivi" },
  ],
  faq: [
    { q: "Faut-il une ordonnance ?", a: "Non. Une prescription est utile quand l'accompagnement s'inscrit dans le suivi d'une pathologie, pour la coordination avec le médecin." },
    { q: "Y a-t-il des aliments interdits ?", a: "Non. Les évictions ne sont proposées que dans des protocoles précis, encadrés et temporaires." },
    { q: "Combien de consultations faut-il prévoir ?", a: "Un bilan puis deux à quatre suivis sur quelques mois, espacés progressivement." },
  ],
  garanties: ["Diplôme d'État", "Numéro ADELI", "Sans complément alimentaire vendu"],
  labels: {
    catalogue: "Les",
    catalogueSub: "consultations",
    catalogueNote: "Tarifs annoncés avant la première consultation. Facture remise pour la mutuelle.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "accompagnement",
    etapes: [
      { titre: "Le bilan", desc: "Ce que vous mangez vraiment, votre rythme, vos contraintes, vos antécédents.", quand: "1re séance, 60 min" },
      { titre: "Le plan", desc: "Des changements réalistes, hiérarchisés, compatibles avec votre semaine.", quand: "à l'issue du bilan" },
      { titre: "Le suivi", desc: "Points d'étape, ajustements, gestion des périodes difficiles.", quand: "toutes les 3 à 6 semaines" },
    ],
    nonCe: [
      "Pas de régime à moins de 1 200 kcal",
      "Pas de compléments alimentaires vendus au cabinet",
      "Pas d'aliment interdit sans raison médicale",
      "Pas de promesse chiffrée de perte de poids",
    ],
  },
};

const SOPHROLOGUE: SanteKit = {
  accent: "#6E7FB0",
  accentDark: "#526091",
  hero: u("photo-1763279934323-edb3735f6a6e"),
  about: u("photo-1723804685588-b8e95b2044f3"),
  portrait: "/templates/sophrologue-portrait.webp",
  services: [
    { name: "Séance individuelle", desc: "Une heure, exercices adaptés à votre objectif.", price: 55, cat: "Séance" },
    { name: "Cycle de 8 séances", desc: "Le format le plus courant pour installer une pratique.", price: 400, cat: "Cycle" },
    { name: "Séance en groupe", desc: "Petit groupe, une fois par semaine.", price: 18, cat: "Groupe" },
    { name: "Préparation à un examen", desc: "Gestion du stress avant permis, concours ou compétition.", price: 55, cat: "Séance" },
    { name: "Séance en entreprise", desc: "Intervention sur site, gestion du stress au travail.", price: 350, from: true, cat: "Entreprise" },
  ],
  aboutText:
    "{name} reçoit à {ville} en séance de sophrologie. La pratique est un accompagnement : elle ne pose pas de diagnostic, ne remplace aucun traitement, et se travaille surtout entre les séances, avec des exercices courts à refaire chez soi.",
  ticker: ["Sophrologue certifié", "Séances individuelles et en groupe", "Exercices à emporter", "Sur rendez-vous"],
  offer: "booking",
  bookingWord: "l'agenda",
  promise: { lead: "Une séance,", strong: "minute par minute.", sub: "Personne ne sait à quoi ressemble une séance de sophrologie avant d'en avoir fait une. Voici le déroulé exact." },
  facts: [
    { k: "60 min", v: "de séance individuelle" },
    { k: "8 séances", v: "le cycle courant pour installer la pratique" },
    { k: "10 min", v: "d'exercices quotidiens à refaire chez soi" },
  ],
  infos: [
    { k: "Remboursement", v: "Non pris en charge par l'Assurance maladie" },
    { k: "Mutuelle", v: "Quelques contrats remboursent au titre du bien-être" },
    { k: "Cadre", v: "Accompagnement — ni diagnostic, ni traitement" },
    { k: "Tenue", v: "Venir en vêtements confortables" },
  ],
  faq: [
    { q: "La sophrologie remplace-t-elle un suivi médical ?", a: "Non. Elle accompagne, sans se substituer à un traitement ni à un suivi psychologique ou médical." },
    { q: "Faut-il savoir méditer ?", a: "Non. Les exercices sont simples, guidés à la voix, et se font assis ou debout." },
    { q: "Combien de séances ?", a: "Un cycle de huit séances est le format courant. Un premier effet est généralement perçu au bout de trois." },
  ],
  garanties: ["Sophrologue certifié RNCP", "Charte déontologique", "Sans diagnostic ni traitement"],
  labels: {
    catalogue: "Les",
    catalogueSub: "séances",
    catalogueNote: "Tarifs annoncés d'avance. Le cycle de huit séances est réglable en plusieurs fois.",
    cta: "Prendre rendez-vous",
  },
  module: {
    kind: "respiration",
    minutes: [
      { t: "0 – 10 min", quoi: "On fait le point : la semaine, ce qui a marché, ce qui a coincé." },
      { t: "10 – 20 min", quoi: "Relaxation dynamique : mouvements doux, debout, respiration associée." },
      { t: "20 – 45 min", quoi: "Sophronisation guidée à la voix, assis ou allongé, yeux fermés." },
      { t: "45 – 60 min", quoi: "Mise en mots de ce qui a été ressenti, puis exercice à emporter." },
    ],
    indications: [
      "Stress et tension au travail",
      "Troubles du sommeil",
      "Préparation d'un examen ou d'une compétition",
      "Accompagnement d'une maladie chronique",
      "Gestion des émotions et de l'anxiété",
    ],
  },
};

/* ══ JURIDIQUE ET CHIFFRE ══════════════════════════════════════ */

const AVOCAT: SanteKit = {
  accent: "#9B7B3F",
  accentDark: "#775D2C",
  hero: u("photo-1479142506502-19b3a3b7ff33"),
  about: u("photo-1603058817990-2b9a9abbce86"),
  portrait: "/templates/avocat-portrait.webp",
  services: [
    { name: "Premier rendez-vous", desc: "Analyse de la situation, options possibles, estimation des coûts.", price: 150, cat: "Conseil" },
    { name: "Consultation écrite", desc: "Réponse motivée à une question précise, sous huit jours.", price: 250, from: true, cat: "Conseil" },
    { name: "Rédaction d'acte", desc: "Contrat, bail, statuts, transaction. Relecture comprise.", price: 500, from: true, cat: "Rédaction" },
    { name: "Assistance en procédure", desc: "Constitution du dossier, audiences, suivi jusqu'à la décision.", price: 1500, from: true, cat: "Contentieux" },
    { name: "Négociation amiable", desc: "Mise en demeure, échanges avec la partie adverse, protocole.", price: 800, from: true, cat: "Amiable" },
  ],
  aboutText:
    "Le cabinet de {name}, avocat au barreau, intervient à {ville} en conseil et en contentieux. Chaque dossier commence par une convention d'honoraires écrite : le mode de calcul, le montant estimé et les frais prévisibles y figurent avant toute diligence.",
  ticker: ["Avocat au barreau", "Convention d'honoraires écrite", "Secret professionnel", "Aide juridictionnelle étudiée"],
  offer: "vitrine",
  bookingWord: "le carnet du cabinet",
  promise: { lead: "Le coût du dossier,", strong: "avant le dossier.", sub: "Convention d'honoraires écrite, modes de calcul expliqués, étapes de la procédure annoncées." },
  facts: [
    { k: "Écrite", v: "convention d'honoraires obligatoire avant toute diligence" },
    { k: "48 h", v: "de délai de réponse à une première demande" },
    { k: "Secret", v: "professionnel absolu sur les échanges" },
  ],
  infos: [
    { k: "Barreau", v: "Avocat inscrit, soumis au règlement intérieur national" },
    { k: "Honoraires", v: "Au temps passé, au forfait ou avec honoraire de résultat complémentaire" },
    { k: "Aide juridictionnelle", v: "Éligibilité vérifiée dès le premier rendez-vous" },
    { k: "Protection juridique", v: "Prise en charge par l'assurance étudiée avec vous" },
  ],
  faq: [
    { q: "Le premier rendez-vous est-il payant ?", a: "Oui, il correspond à une consultation. Son montant est annoncé lors de la prise de rendez-vous et s'impute sur les honoraires si le dossier est confié." },
    { q: "Combien coûte une procédure ?", a: "Cela dépend de la matière et de la durée. La convention d'honoraires fixe le mode de calcul et une estimation avant d'engager quoi que ce soit." },
    { q: "Mon assurance peut-elle payer ?", a: "Souvent, via la garantie protection juridique. Le contrat est examiné au premier rendez-vous, et vous gardez le libre choix de l'avocat." },
  ],
  garanties: ["Avocat au barreau", "Convention d'honoraires écrite", "Assurance responsabilité civile professionnelle"],
  labels: {
    catalogue: "Les",
    catalogueSub: "interventions",
    catalogueNote: "Montants indicatifs hors taxes. Le montant exact figure dans la convention d'honoraires.",
    cta: "Demander un rendez-vous",
  },
  module: {
    kind: "dossier",
    domaines: [
      { name: "Droit du travail", desc: "Licenciement, rupture conventionnelle, harcèlement, prud'hommes." },
      { name: "Droit de la famille", desc: "Divorce, garde d'enfants, pension alimentaire, succession." },
      { name: "Droit des contrats", desc: "Rédaction, exécution, rupture, recouvrement de créances." },
      { name: "Droit immobilier", desc: "Bail, vices cachés, copropriété, troubles de voisinage." },
      { name: "Droit des sociétés", desc: "Création, statuts, cession de parts, conflits entre associés." },
      { name: "Droit pénal", desc: "Plainte, garde à vue, audience correctionnelle, partie civile." },
    ],
    honoraires: [
      { type: "Au temps passé", desc: "Taux horaire annoncé, relevé de diligences détaillé à chaque facture." },
      { type: "Au forfait", desc: "Montant fixe pour une mission délimitée : un acte, une audience, un conseil." },
      { type: "Honoraire de résultat", desc: "Complément proportionnel au gain obtenu. Jamais seul : la loi l'interdit." },
    ],
  },
};

const NOTAIRE: SanteKit = {
  accent: "#8C3A45",
  accentDark: "#6B2B33",
  hero: u("photo-1505664063603-28e48ca204eb"),
  about: u("photo-1543664644-1658107bb4bb"),
  portrait: "/templates/notaire-portrait.webp",
  services: [
    { name: "Vente immobilière", desc: "Compromis, purge des droits de préemption, acte authentique.", price: 0, priceLabel: "Tarif réglementé", cat: "Immobilier", refund: "émoluments fixés par tarif national" },
    { name: "Succession", desc: "Acte de notoriété, déclaration fiscale, partage.", price: 0, priceLabel: "Tarif réglementé", cat: "Famille", refund: "émoluments tarifés" },
    { name: "Donation", desc: "Donation simple, donation-partage, présent d'usage.", price: 0, priceLabel: "Tarif réglementé", cat: "Famille", refund: "émoluments tarifés" },
    { name: "Contrat de mariage et PACS", desc: "Choix du régime, conséquences expliquées avant signature.", price: 0, priceLabel: "Tarif réglementé", cat: "Famille", refund: "émoluments tarifés" },
    { name: "Conseil patrimonial", desc: "Transmission, démembrement, société civile immobilière.", price: 0, priceLabel: "Sur devis", cat: "Conseil", refund: "honoraires libres, annoncés d'avance" },
  ],
  aboutText:
    "L'étude de {name} reçoit à {ville}. Le notaire est un officier public : ses émoluments sont fixés par un tarif national, identique d'une étude à l'autre. Ce qui se choisit, c'est l'accompagnement — le temps consacré à expliquer un acte avant de le signer.",
  ticker: ["Officier public", "Tarif national réglementé", "Actes authentiques", "Conseil avant signature"],
  offer: "vitrine",
  bookingWord: "l'agenda de l'étude",
  promise: { lead: "Chaque acte,", strong: "son délai et ses pièces.", sub: "Ce qu'il faut apporter, combien de temps ça prend, ce qui bloque le plus souvent." },
  facts: [
    { k: "Tarif", v: "national et réglementé, identique partout" },
    { k: "3 mois", v: "de délai courant entre compromis et acte de vente" },
    { k: "Officier", v: "public — l'acte a date certaine et force exécutoire" },
  ],
  infos: [
    { k: "Émoluments", v: "Fixés par décret, identiques dans toutes les études" },
    { k: "Frais de notaire", v: "Composés à 80 % de taxes reversées à l'État" },
    { k: "Rendez-vous", v: "Sur place, ou à distance par visioconférence sécurisée" },
    { k: "Pièces", v: "Liste transmise à l'ouverture du dossier" },
  ],
  faq: [
    { q: "Les frais de notaire vont-ils au notaire ?", a: "Non. L'essentiel est constitué de droits et taxes reversés à l'État et aux collectivités ; les émoluments de l'étude en représentent une petite part." },
    { q: "Peut-on choisir son notaire ?", a: "Oui, librement. Dans une vente, acheteur et vendeur peuvent chacun avoir le leur sans surcoût : les émoluments sont alors partagés." },
    { q: "Combien de temps pour une succession ?", a: "Six mois pour la déclaration fiscale, davantage lorsqu'il y a un bien immobilier ou un désaccord entre héritiers." },
  ],
  garanties: ["Officier public ministériel", "Tarif réglementé", "Archivage des actes 75 ans"],
  labels: {
    catalogue: "Les",
    catalogueSub: "actes",
    catalogueNote: "Les émoluments sont fixés par le tarif national. Le détail chiffré est remis à l'ouverture du dossier.",
    cta: "Demander un rendez-vous",
  },
  module: {
    kind: "actes",
    actes: [
      { nom: "Vente immobilière", delai: "2 à 3 mois", pieces: "Titre de propriété, diagnostics, dernier avis d'imposition, pièce d'identité" },
      { nom: "Succession", delai: "6 mois pour la déclaration", pieces: "Acte de décès, livret de famille, testament éventuel, relevés bancaires" },
      { nom: "Donation", delai: "3 à 6 semaines", pieces: "Pièces d'identité, titres de propriété, justificatif de l'origine des fonds" },
      { nom: "Contrat de mariage", delai: "2 à 4 semaines", pieces: "Pièces d'identité, justificatif de domicile, inventaire des biens propres" },
      { nom: "PACS", delai: "2 à 3 semaines", pieces: "Pièces d'identité, actes de naissance de moins de 3 mois" },
    ],
    note: "Les délais courent à compter de la réception de toutes les pièces. Ce qui allonge un dossier, c'est presque toujours une pièce manquante — la liste vous est remise dès l'ouverture.",
  },
};

const EXPERTCOMPTABLE: SanteKit = {
  accent: "#2E6E62",
  accentDark: "#215248",
  hero: u("photo-1707157284454-553ef0a4ed0d"),
  about: u("photo-1626266061368-46a8f578ddd6"),
  portrait: "/templates/expertcomptable-portrait.webp",
  services: [
    { name: "Tenue comptable", desc: "Saisie, lettrage, rapprochements bancaires, TVA.", price: 120, from: true, unit: "/mois", cat: "Comptabilité" },
    { name: "Bilan et liasse fiscale", desc: "Comptes annuels, liasse, dépôt au greffe.", price: 900, from: true, cat: "Comptabilité" },
    { name: "Paie", desc: "Bulletins, DSN, soldes de tout compte.", price: 22, from: true, unit: "/bulletin", cat: "Social" },
    { name: "Création d'entreprise", desc: "Choix de la forme, statuts, formalités, premiers arbitrages fiscaux.", price: 900, from: true, cat: "Création" },
    { name: "Prévisionnel financier", desc: "Plan à trois ans pour une banque ou un investisseur.", price: 700, from: true, cat: "Conseil" },
    { name: "Premier rendez-vous", desc: "Point de situation et proposition chiffrée.", price: 0, priceLabel: "Offert", cat: "Conseil" },
  ],
  aboutText:
    "Le cabinet de {name} accompagne à {ville} les indépendants, les commerçants et les PME. Forfait annoncé d'avance, échéances rappelées avant qu'elles ne tombent, et un interlocuteur qui répond dans la journée plutôt qu'un dossier qui circule.",
  ticker: ["Expert-comptable inscrit à l'Ordre", "Forfait annoncé d'avance", "Échéances rappelées", "Réponse sous 24 h"],
  offer: "vitrine",
  bookingWord: "l'agenda du cabinet",
  promise: { lead: "L'année fiscale,", strong: "sans mauvaise surprise.", sub: "Les échéances mois par mois, et le forfait qui correspond à votre structure." },
  facts: [
    { k: "24 h", v: "de délai de réponse en période courante" },
    { k: "Forfait", v: "annoncé d'avance, révisé une fois par an" },
    { k: "Ordre", v: "cabinet inscrit à l'Ordre des experts-comptables" },
  ],
  infos: [
    { k: "Lettre de mission", v: "Signée avant le démarrage, périmètre et honoraires détaillés" },
    { k: "Outils", v: "Portail en ligne, dépôt des pièces par photo" },
    { k: "Changement de cabinet", v: "Reprise du dossier gérée avec le confrère précédent" },
    { k: "Rendez-vous", v: "Au cabinet ou en visioconférence" },
  ],
  faq: [
    { q: "Peut-on changer d'expert-comptable en cours d'année ?", a: "Oui, à tout moment. Le transfert du dossier est organisé entre confrères, c'est une obligation déontologique." },
    { q: "Le forfait couvre-t-il les questions ponctuelles ?", a: "Oui pour les questions courantes. Les missions exceptionnelles font l'objet d'un devis séparé, annoncé avant." },
    { q: "Faut-il apporter des classeurs papier ?", a: "Non. Les pièces se déposent en photo sur le portail, et les relevés bancaires arrivent automatiquement." },
  ],
  garanties: ["Inscrit à l'Ordre des experts-comptables", "Lettre de mission", "Assurance responsabilité civile professionnelle"],
  labels: {
    catalogue: "Les",
    catalogueSub: "missions",
    catalogueNote: "Tarifs hors taxes indicatifs. Le forfait est arrêté après le premier rendez-vous.",
    cta: "Demander un rendez-vous",
  },
  module: {
    kind: "calendrier",
    echeances: [
      { mois: "Janvier", quoi: "DSN de décembre, TVA du 4e trimestre, préparation des inventaires" },
      { mois: "Mars", quoi: "Solde d'impôt sur les sociétés pour les clôtures au 31 décembre" },
      { mois: "Mai", quoi: "Liasse fiscale et déclaration de résultats" },
      { mois: "Juin", quoi: "Approbation des comptes, dépôt au greffe" },
      { mois: "Septembre", quoi: "Acompte d'IS, point de mi-exercice" },
      { mois: "Décembre", quoi: "Arbitrages de fin d'année, investissements, rémunération du dirigeant" },
    ],
    forfaits: [
      { structure: "Micro-entreprise", prix: 60 },
      { structure: "Indépendant (BNC/BIC)", prix: 120 },
      { structure: "SASU / EURL", prix: 190 },
      { structure: "PME avec salariés", prix: 320 },
    ],
  },
};

/* ── Registre ───────────────────────────────────────────────── */

export type SanteKey =
  | "dentiste"
  | "kine"
  | "osteopathe"
  | "podologue"
  | "orthophoniste"
  | "sagefemme"
  | "medecin"
  | "veterinaire"
  | "psychologue"
  | "dieteticien"
  | "sophrologue"
  | "avocat"
  | "notaire"
  | "expertcomptable";

export const SANTE_KITS: Record<SanteKey, SanteKit> = {
  dentiste: DENTISTE,
  kine: KINE,
  osteopathe: OSTEOPATHE,
  podologue: PODOLOGUE,
  orthophoniste: ORTHOPHONISTE,
  sagefemme: SAGEFEMME,
  medecin: MEDECIN,
  veterinaire: VETERINAIRE,
  psychologue: PSYCHOLOGUE,
  dieteticien: DIETETICIEN,
  sophrologue: SOPHROLOGUE,
  avocat: AVOCAT,
  notaire: NOTAIRE,
  expertcomptable: EXPERTCOMPTABLE,
};

/** Libellés affichables — ils n'existent pas dans METIER_LABELS (artisans). */
export const SANTE_LABELS: Record<SanteKey, string> = {
  dentiste: "Dentiste",
  kine: "Kinésithérapeute",
  osteopathe: "Ostéopathe",
  podologue: "Pédicure-podologue",
  orthophoniste: "Orthophoniste",
  sagefemme: "Sage-femme",
  medecin: "Médecin généraliste",
  veterinaire: "Vétérinaire",
  psychologue: "Psychologue",
  dieteticien: "Diététicien",
  sophrologue: "Sophrologue",
  avocat: "Avocat",
  notaire: "Notaire",
  expertcomptable: "Expert-comptable",
};

/**
 * Métier → kit libéral, ou `null` hors périmètre.
 *
 * L'ordre reprend celui de `NICHE_RULES` dans app/lib/instagram.ts, pour la même
 * raison : « rééducation » appartient aussi à l'orthophonie, « psy » ne doit pas
 * capter « physiothérapie », et « médecine esthétique » n'est pas un cabinet
 * médical. Le métier le plus spécifique est donc testé d'abord.
 */
const MATCHERS: Array<[RegExp, SanteKey]> = [
  [/(orthophonist|orthophonie|orthoptist)/, "orthophoniste"],
  [/(dentiste|dentaire|orthodontist|implantolog|stomatolog)/, "dentiste"],
  [/(kin[eé]sith|masseur[- ]?kin|\bkin[eé]\b|r[eé][eé]ducation)/, "kine"],
  [/(ost[eé]opath|\bost[eé]o\b)/, "osteopathe"],
  [/(podologue|p[eé]dicure[- ]?podolog|posturolog)/, "podologue"],
  [/(sage[- ]?femme|ma[iï]eutic|p[eé]rinatalit)/, "sagefemme"],
  [/(v[eé]t[eé]rinaire|clinique v[eé]t|\bv[eé]to\b)/, "veterinaire"],
  [/(psychologue|psychoth[eé]rapeut|psychopraticien|neuropsycholog|\bpsy\b)/, "psychologue"],
  [/(di[eé]t[eé]ticien|nutritionniste|micronutrition|di[eé]t[eé]tique)/, "dieteticien"],
  [/(sophrolog|hypnoth[eé]rapeut|naturopath)/, "sophrologue"],
  [/(m[eé]decin|cabinet m[eé]dical|g[eé]n[eé]raliste|maison de sant[eé]|docteur)/, "medecin"],
  [/(avocat|barreau)/, "avocat"],
  [/(notaire|notarial|[eé]tude notariale)/, "notaire"],
  [/(expert[- ]?comptable|cabinet comptable|comptabilit[eé]|commissaire aux comptes)/, "expertcomptable"],
];

export function matchSante(metier?: string | null): SanteKey | null {
  const m = (metier ?? "").toLowerCase().trim();
  if (!m) return null;
  if (m in SANTE_KITS) return m as SanteKey;
  for (const [re, key] of MATCHERS) if (re.test(m)) return key;
  return null;
}

export function santeKitFor(metier?: string | null): SanteKit {
  return SANTE_KITS[matchSante(metier) ?? "medecin"];
}

export function santeLabel(metier?: string | null): string {
  const key = matchSante(metier);
  return key ? SANTE_LABELS[key] : "Praticien";
}
