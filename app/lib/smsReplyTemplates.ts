/**
 * Modèles de réponse rapide pour les conversations SMS (texte libre).
 * Ton conversationnel, SANS mention STOP (on répond à un client qui nous a
 * déjà écrit — ce n'est pas de la prospection à froid). Pur frontend : un clic
 * insère le texte dans le champ, toujours éditable avant envoi.
 */
export interface ReplyTemplate {
  label: string;
  text: string;
}

/** Lien de prise de RDV (Koalendar). Centralisé ici pour être modifiable en un endroit. */
const KOALENDAR_URL = "https://koalendar.com/e/reunion-nicolas-maillard";

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  { label: "Je rappelle", text: "Bonjour, je vous rappelle dans la journée 👍" },
  { label: "Créneau ?", text: "Parfait ! Quel créneau vous convient pour un appel rapide ?" },
  { label: "Merci", text: "Merci pour votre retour 🙏" },
  { label: "J'envoie", text: "Très bien, je vous envoie ça tout de suite." },
  { label: "Avec plaisir", text: "Avec plaisir, je m'en occupe et je reviens vers vous." },
  {
    label: "Réserver un RDV",
    text: `Pour planifier votre campagne Google Ads ou la création de votre nouveau site web, réservez votre créneau ici : ${KOALENDAR_URL}`,
  },
];
