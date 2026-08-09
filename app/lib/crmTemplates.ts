// Modèles de mission — les checklists réutilisables du CRM.
//
// Elles vivent EN CODE et non en base, pour une raison simple : ce sont les
// prestations de l'agence, pas des données. Elles changent quand l'offre
// change, c'est-à-dire au rythme d'un commit, et une checklist relue en revue
// de code vaut mieux qu'une checklist tapée à la va-vite dans un écran d'admin
// qu'on n'ouvre jamais.
//
// Un modèle ne FIGE rien : il pose des étapes ordinaires que l'on coche,
// renomme, supprime ou complète librement une fois dans le dossier. On peut
// aussi n'en appliquer aucun et coller sa propre liste (`parseChecklistPaste`).
//
// Source de l'offre : `Agence/Agence.md` (300 / 500 € HT) et le pivot Google
// Ads en escalier — rapport de demande → semaine test → pay-per-call.

export interface TemplateStep {
  label: string;
  phase: string;
  details?: string;
}

export interface MissionTemplate {
  id: string;
  nom: string;
  /** Ce que le modèle couvre, en une ligne — affiché avant d'appliquer. */
  resume: string;
  /** Tarif indicatif en € HT, quand la prestation en a un au catalogue. */
  tarifIndicatif?: number;
  steps: TemplateStep[];
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: "google-ads-semaine-test",
    nom: "Google Ads — semaine test",
    resume: "La marche d'essai : compte, tracking et campagne montés pour prouver la demande en 7 jours.",
    steps: [
      { phase: "Cadrage", label: "Récupérer la zone d'intervention exacte (communes, rayon km)" },
      { phase: "Cadrage", label: "Lister les services à pousser, du plus rentable au moins rentable" },
      { phase: "Cadrage", label: "Valider le budget quotidien Google avec le client", details: "Ce que le client paie à Google, hors gestion — le poste doit être dit avant, jamais découvert sur la facture." },
      { phase: "Cadrage", label: "Fixer le seuil « appel qualifié » (durée mini, horaires)" },
      { phase: "Accès", label: "Créer/récupérer le compte Google Ads et l'accès administrateur" },
      { phase: "Accès", label: "Vérifier la fiche Google Business Profile (revendiquée, à jour)" },
      { phase: "Accès", label: "Poser le numéro de suivi d'appel et le tester en vrai" },
      { phase: "Production", label: "Étude de mots-clés + volumes (Keyword Planner)", details: "Conserver la liste exacte, elle sert de preuve au client et de base aux négatifs." },
      { phase: "Production", label: "Liste de mots-clés négatifs (emploi, gratuit, formation, DIY)" },
      { phase: "Production", label: "Écrire les annonces : 15 titres, 4 descriptions" },
      { phase: "Production", label: "Extensions : lieu, appel, liens annexes, accroches" },
      { phase: "Production", label: "Ciblage géographique en « présence physique », pas « intérêt »" },
      { phase: "Production", label: "Conversions : appels ≥ 30 s + clics sur le numéro" },
      { phase: "Lancement", label: "Relire le compte avant diffusion (budget, zone, horaires)" },
      { phase: "Lancement", label: "Lancer et prévenir le client du jour J" },
      { phase: "Suivi", label: "J+2 : premier passage sur les termes de recherche" },
      { phase: "Suivi", label: "J+7 : bilan chiffré envoyé — appels, coût par appel, verdict" },
    ],
  },
  {
    id: "google-ads-pay-per-call",
    nom: "Google Ads — pay-per-call (mensuel)",
    resume: "Le régime de croisière : NMF avance le spend et facture à l'appel qualifié.",
    steps: [
      { phase: "Cadrage", label: "Contrat signé : prix par appel, plafond mensuel, préavis" },
      { phase: "Cadrage", label: "Moyen de paiement en place (prélèvement / lien Stripe)" },
      { phase: "Accès", label: "Numéro Twilio dédié + renvoi vers la ligne du client" },
      { phase: "Accès", label: "Enregistrement des appels : mention légale et consentement" },
      { phase: "Production", label: "Reprendre la campagne de la semaine test et l'étendre" },
      { phase: "Production", label: "Ajuster les enchères sur les services rentables" },
      { phase: "Suivi", label: "Écoute hebdomadaire des appels : requalifier ce qui ne compte pas" },
      { phase: "Suivi", label: "Rapport mensuel : appels qualifiés, coût, marge" },
      { phase: "Suivi", label: "Facture du mois émise (Abby)" },
    ],
  },
  {
    id: "landing-page",
    nom: "Landing page (mise en avant d'un service)",
    resume: "Une page unique, un service, un appel — la surface d'atterrissage des annonces.",
    tarifIndicatif: 300,
    steps: [
      { phase: "Cadrage", label: "Le service mis en avant et sa promesse en une phrase" },
      { phase: "Cadrage", label: "Récupérer photos de chantiers, avis clients, certifications (RGE, décennale)" },
      { phase: "Cadrage", label: "Zone couverte et délai d'intervention annoncés" },
      { phase: "Production", label: "Structure : accroche, preuve, offre, formulaire, réassurance" },
      { phase: "Production", label: "Écrire les textes (aucun lorem, aucun placeholder livré)" },
      { phase: "Production", label: "Intégrer la page" },
      { phase: "Production", label: "Formulaire relié — tester une vraie soumission de bout en bout" },
      { phase: "Production", label: "Numéro cliquable au pouce sur mobile" },
      { phase: "Recette", label: "Lighthouse ≥ 90 sur mobile" },
      { phase: "Recette", label: "Mentions légales et politique de confidentialité" },
      { phase: "Recette", label: "Relecture orthographe + cohérence des prix affichés" },
      { phase: "Livraison", label: "Nom de domaine / sous-domaine branché, HTTPS actif" },
      { phase: "Livraison", label: "Lien envoyé au client pour validation" },
      { phase: "Livraison", label: "Facture émise" },
    ],
  },
  {
    id: "site-vitrine",
    nom: "Site vitrine (300 € HT)",
    resume: "Le site de l'artisan : ce qu'il fait, où, et comment le joindre.",
    tarifIndicatif: 300,
    steps: [
      { phase: "Cadrage", label: "Contenus récupérés : logo, photos, textes, coordonnées" },
      { phase: "Cadrage", label: "Liste des services et des zones couvertes" },
      { phase: "Cadrage", label: "Choix du gabarit (niche) et de la direction visuelle" },
      { phase: "Production", label: "Page d'accueil" },
      { phase: "Production", label: "Page services" },
      { phase: "Production", label: "Page réalisations (photos avant/après)" },
      { phase: "Production", label: "Page contact + formulaire testé" },
      { phase: "Recette", label: "Responsive vérifié sur un vrai téléphone" },
      { phase: "Recette", label: "Lighthouse ≥ 90, images compressées" },
      { phase: "Recette", label: "Mentions légales, RGPD, cookies" },
      { phase: "Livraison", label: "Domaine + HTTPS" },
      { phase: "Livraison", label: "Fiche Google Business Profile mise à jour avec le site" },
      { phase: "Livraison", label: "Passation : comment demander une modification" },
      { phase: "Livraison", label: "Facture émise" },
    ],
  },
  {
    id: "audit-recommandation",
    nom: "Audit digital + recommandation",
    resume: "L'entrée en matière : ce que vaut sa présence aujourd'hui, et ce qu'il gagnerait.",
    steps: [
      { phase: "Analyse", label: "Site actuel : vitesse, mobile, conversion, mentions" },
      { phase: "Analyse", label: "SEO local : fiche Google, avis, cohérence NAP" },
      { phase: "Analyse", label: "Demande réelle : volumes de recherche sur la zone" },
      { phase: "Analyse", label: "Concurrents qui achètent déjà ces mots-clés" },
      { phase: "Analyse", label: "Projection de budget testée à plusieurs paliers" },
      { phase: "Restitution", label: "Rapport rédigé et relu (chiffres vérifiables, aucun chiffre inventé)" },
      { phase: "Restitution", label: "Rendez-vous de restitution fixé" },
      { phase: "Restitution", label: "Restitution faite" },
      { phase: "Suite", label: "Proposition envoyée" },
      { phase: "Suite", label: "Relance à J+3 si sans réponse" },
    ],
  },
];

/** Un modèle par son identifiant, ou `null` — la porte d'entrée des routes. */
export function templateById(id: unknown): MissionTemplate | null {
  const s = String(id ?? "").trim();
  return MISSION_TEMPLATES.find((t) => t.id === s) ?? null;
}
