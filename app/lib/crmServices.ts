// LE CATALOGUE des prestations de l'agence.
//
// En code et pas en base, pour la même raison que les modèles de mission : ce
// sont les OFFRES de NMF, elles changent au rythme d'un commit. La base ne
// garde que ce qui a été vendu à qui, avec le libellé et le montant du jour —
// un tarif de catalogue qui bouge ne doit jamais réécrire l'histoire d'un
// dossier déjà facturé.
//
// Les montants viennent d'`Agence.md` (300 € vitrine, 500 € réservation et
// e-commerce). `null` = pas de prix catalogue : ça se chiffre au cas par cas,
// et le champ reste à remplir plutôt que d'afficher un prix faux.

import { DOC_KINDS, type DocKind } from "./crm";

export interface ServiceDef {
  code: string;
  label: string;
  /** Prix catalogue HT, `null` quand c'est sur devis. */
  montant: number | null;
  /** Facturé tous les mois — ne se totalise jamais avec le reste. */
  mensuel?: boolean;
  groupe: "Site" | "Acquisition" | "Suivi";
  /**
   * Les étapes que CETTE prestation impose, dans l'ordre, `[phase, libellé]`.
   *
   * Vendre un site vitrine et une campagne Ads au même client, c'est deux
   * chantiers avec deux checklists : les composer à la main à chaque dossier,
   * c'est en oublier une à chaque fois. Elles s'AJOUTENT (jamais de
   * remplacement), et le dédoublonnage se fait sur le libellé exact.
   */
  etapes?: [string, string, DocKind?][];
}

export const SERVICES: ServiceDef[] = [
  {
    code: "site-vitrine", label: "Site vitrine", montant: 300, groupe: "Site",
    etapes: [
      ["Cadrage", "Récupérer textes, photos et logo du client"],
      ["Cadrage", "Lister les services à mettre en avant, dans l'ordre"],
      ["Cadrage", "Récupérer SIRET, mentions légales et assurance"],
      ["Production", "Adapter le template au métier et à la DA"],
      ["Production", "Écrire les titres SEO (métier + ville)"],
      ["Production", "Formulaire de contact + destinataire testé en vrai"],
      ["Mise en ligne", "Acheter le domaine et brancher le DNS"],
      ["Mise en ligne", "Analytics + Search Console posés"],
      ["Mise en ligne", "Vérifier le rendu mobile et le score Lighthouse"],
      ["Livraison", "Relire avec le client, corriger, facturer", "facture"],
    ],
  },
  {
    code: "site-reservation", label: "Site avec réservation", montant: 500, groupe: "Site",
    etapes: [
      ["Cadrage", "Créneaux, durées, capacité : les règles exactes"],
      ["Cadrage", "Qui reçoit les réservations, et par quel canal"],
      ["Production", "Interface de réservation + admin"],
      ["Production", "Emails de confirmation et de rappel testés en vrai"],
      ["Production", "Fuseau horaire et jours de fermeture vérifiés"],
      ["Mise en ligne", "Domaine, DNS, analytics"],
      ["Livraison", "Prise en main de l'admin avec le client"],
    ],
  },
  {
    code: "site-ecommerce", label: "E-commerce", montant: 500, groupe: "Site",
    etapes: [
      ["Cadrage", "Catalogue, variantes et stocks"],
      ["Cadrage", "Livraison : zones, délais, tarifs"],
      ["Production", "Paiement en ligne testé avec une vraie carte"],
      ["Production", "Emails de commande et suivi"],
      ["Mise en ligne", "CGV, mentions légales, politique de retour"],
      ["Livraison", "Formation à la gestion des commandes"],
    ],
  },
  {
    code: "landing-page", label: "Landing page", montant: 300, groupe: "Site",
    etapes: [
      ["Cadrage", "UNE promesse, UNE action attendue"],
      ["Production", "Écrire l'accroche et les preuves"],
      ["Production", "Formulaire ou appel : le suivi de conversion posé"],
      ["Mise en ligne", "Publier et vérifier la vitesse mobile"],
    ],
  },
  {
    code: "refonte", label: "Refonte de site existant", montant: null, groupe: "Site",
    etapes: [
      ["Cadrage", "Inventaire des pages et des URL à conserver"],
      ["Cadrage", "Récupérer les accès de l'ancien site"],
      ["Production", "Reprendre les contenus qui performent"],
      ["Mise en ligne", "Redirections 301 de l'ancien vers le nouveau"],
      ["Mise en ligne", "Vérifier l'indexation après bascule"],
    ],
  },
  {
    code: "page-supplementaire", label: "Ajout / modification de page", montant: null, groupe: "Site",
    etapes: [
      ["Production", "Récupérer le contenu définitif du client"],
      ["Production", "Intégrer la page et la relier au menu"],
      ["Livraison", "Relire avec le client et publier"],
    ],
  },
  {
    code: "mise-a-niveau", label: "Mise à niveau / nouvelles fonctionnalités", montant: null, groupe: "Site",
    etapes: [
      ["Cadrage", "Lister précisément ce que la mise à niveau ajoute"],
      ["Production", "Développer et tester la nouvelle fonctionnalité"],
      ["Livraison", "Montrer au client, puis facturer", "facture"],
    ],
  },
  {
    code: "identite", label: "Logo & identité visuelle", montant: null, groupe: "Site",
    etapes: [
      ["Cadrage", "Références visuelles et ce qu'il refuse"],
      ["Production", "Deux pistes de logo, une seule retenue"],
      ["Livraison", "Fichiers sources + versions web livrés", "image"],
    ],
  },

  {
    code: "audit", label: "Audit digital + recommandation", montant: null, groupe: "Acquisition",
    etapes: [
      ["Analyse", "Mesurer le site : vitesse, mobile, conversion"],
      ["Analyse", "Étude de mots-clés + volumes (Keyword Planner)"],
      ["Analyse", "Fiche Google Business et concurrence locale"],
      ["Livraison", "Rédiger le rapport et la recommandation chiffrée", "audit"],
      ["Livraison", "Présenter en appel — jamais par écrit seul"],
    ],
  },
  {
    code: "ads-semaine-test", label: "Google Ads — semaine test", montant: null, groupe: "Acquisition",
    etapes: [
      ["Cadrage", "Zone d'intervention exacte (communes, rayon)"],
      ["Cadrage", "Valider le budget quotidien avec le client"],
      ["Accès", "Compte Google Ads + accès administrateur"],
      ["Accès", "Numéro de suivi d'appel posé et testé en vrai"],
      ["Production", "Mots-clés + liste de négatifs"],
      ["Production", "Annonces : titres, descriptions, extensions"],
      ["Production", "Conversions : appels ≥ 30 s + clics sur le numéro"],
      ["Lancement", "Relire le compte avant diffusion"],
      ["Suivi", "J+2 : passage sur les termes de recherche"],
      ["Suivi", "J+7 : bilan chiffré — appels, coût par appel, verdict", "bilan"],
    ],
  },
  {
    code: "ads-gestion", label: "Google Ads — gestion mensuelle", montant: null, mensuel: true, groupe: "Acquisition",
    etapes: [
      ["Suivi", "Passage hebdomadaire sur les termes de recherche"],
      ["Suivi", "Ajuster enchères et négatifs"],
      ["Suivi", "Bilan mensuel envoyé au client", "bilan"],
      ["Facturation", "Facturer la gestion du mois"],
    ],
  },
  {
    code: "pay-per-call", label: "Pay-per-call", montant: null, mensuel: true, groupe: "Acquisition",
    etapes: [
      ["Cadrage", "Définir l'appel QUALIFIÉ : durée mini, horaires"],
      ["Accès", "Numéro de suivi + enregistrement des appels"],
      ["Suivi", "Écouter les appels litigieux avant de facturer"],
      ["Facturation", "Facturer les appels qualifiés du mois"],
    ],
  },
  {
    code: "seo-local", label: "SEO local + fiche Google", montant: null, groupe: "Acquisition",
    etapes: [
      ["Cadrage", "Revendiquer et compléter la fiche Google"],
      ["Production", "Photos, horaires, zone de service, services"],
      ["Production", "Mettre en place la demande d'avis clients"],
      ["Suivi", "Relever la position locale à J+30"],
    ],
  },
  {
    code: "meta-ads", label: "Publicité Meta", montant: null, mensuel: true, groupe: "Acquisition",
    etapes: [
      ["Accès", "Page et compte publicitaire, rôle administrateur"],
      ["Production", "Visuels et accroches, deux variantes minimum"],
      ["Suivi", "Bilan mensuel : coût par contact", "bilan"],
    ],
  },

  {
    code: "maintenance", label: "Maintenance mensuelle", montant: null, mensuel: true, groupe: "Suivi",
    etapes: [
      ["Suivi", "Vérifier que le site répond et que les formulaires arrivent"],
      ["Suivi", "Mises à jour et sauvegardes"],
      ["Facturation", "Facturer la maintenance du mois"],
    ],
  },
  {
    code: "hebergement", label: "Hébergement & nom de domaine", montant: null, mensuel: true, groupe: "Suivi",
    etapes: [
      ["Suivi", "Surveiller l'expiration du domaine et du certificat"],
      ["Facturation", "Refacturer l'hébergement"],
    ],
  },
  {
    code: "emails-pro", label: "Emails professionnels", montant: null, groupe: "Suivi",
    etapes: [
      ["Production", "Créer les boîtes et configurer SPF/DKIM"],
      ["Livraison", "Tester l'envoi ET la réception avec le client"],
    ],
  },
  {
    code: "formation", label: "Prise en main / formation", montant: null, groupe: "Suivi",
    etapes: [
      ["Livraison", "Séance de prise en main"],
      ["Livraison", "Laisser un mode d'emploi écrit"],
    ],
  },
];

/**
 * Les étapes qu'une prestation ajoute à une checklist EXISTANTE.
 *
 * Ce qui est déjà là gagne : appliquer une deuxième prestation n'efface jamais
 * ce qui est coché — c'est la même règle que les modèles de mission. Le
 * dédoublonnage se fait sur le libellé exact, insensible à la casse.
 */
export function etapesAAjouter(
  code: string,
  existantes: { label: string }[],
): { label: string; phase: string }[] {
  const def = serviceByCode(code);
  if (!def?.etapes) return [];
  const deja = new Set(existantes.map((t) => t.label.trim().toLowerCase()));
  return def.etapes
    .filter(([, label]) => !deja.has(label.trim().toLowerCase()))
    .map(([phase, label]) => ({ label, phase }));
}

/* ────────────────────────────────────────────────────────────
 * Les livrables : ce qu'une étape cochée devrait avoir produit
 * ──────────────────────────────────────────────────────────── */

/** Toutes les étapes du catalogue qui produisent une pièce, indexées par libellé. */
const LIVRABLE_PAR_ETAPE: Map<string, DocKind> = new Map(
  SERVICES.flatMap((s) => (s.etapes ?? []))
    .filter(([, , doc]) => !!doc)
    .map(([, label, doc]) => [label.trim().toLowerCase(), doc as DocKind]),
);

export interface LivrableManquant {
  /** L'étape cochée qui aurait dû produire la pièce. */
  etape: string;
  kind: DocKind;
}

/**
 * Les pièces qu'on devrait avoir, et qu'on n'a pas.
 *
 * Cocher « Rédiger le rapport » sans joindre le rapport, c'est perdre le
 * livrable : il finit dans un dossier local, il est refait six semaines plus
 * tard, ou une version périmée repart chez le client. L'app doit donc le
 * RÉCLAMER au moment où l'étape est cochée — pas attendre qu'on y pense.
 *
 * Seules les étapes FAITES comptent : réclamer un rapport avant de l'avoir écrit
 * serait du bruit, et le bruit finit par masquer les vraies alertes.
 */
export function livrablesManquants(
  tasks: { label: string; done: boolean }[],
  documents: { kind: string }[],
): LivrableManquant[] {
  const presents = new Set(documents.map((d) => String(d.kind).toLowerCase()));
  const vus = new Set<string>();
  const out: LivrableManquant[] = [];

  for (const t of tasks) {
    if (!t.done) continue;
    const kind = LIVRABLE_PAR_ETAPE.get(t.label.trim().toLowerCase());
    if (!kind || presents.has(kind) || vus.has(kind)) continue;
    vus.add(kind);
    out.push({ etape: t.label, kind });
  }
  return out;
}

/** Garde-fou : un genre marqué sur une étape doit exister dans `DOC_KINDS`. */
export const LIVRABLE_KINDS = [...new Set(LIVRABLE_PAR_ETAPE.values())].filter((k) =>
  (DOC_KINDS as readonly string[]).includes(k),
);

export const SERVICE_GROUPES = ["Site", "Acquisition", "Suivi"] as const;

export function serviceByCode(code: string): ServiceDef | null {
  return SERVICES.find((s) => s.code === code) ?? null;
}

/** Code déterministe d'une prestation libre, compatible avec l'index (client, code). */
export function customServiceCode(label: string): string | null {
  const slug = label
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug ? `custom-${slug}` : null;
}

/**
 * Total HT des prestations NON mensuelles.
 *
 * Les mensuelles en sont exclues, pour la raison qui vaut partout ici : un
 * abonnement additionné à un forfait produit un chiffre qui n'existe dans aucun
 * relevé bancaire.
 */
export function totalPrestations(lignes: { code: string; montant_ht?: number | string | null }[]): number {
  return lignes.reduce((n, l) => {
    if (serviceByCode(l.code)?.mensuel) return n;
    const v = typeof l.montant_ht === "number" ? l.montant_ht : Number(String(l.montant_ht ?? "").replace(",", "."));
    return Number.isFinite(v) ? n + v : n;
  }, 0);
}
