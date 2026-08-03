// app/lib/igProofread.ts
// Correction orthographique d'un DM — logique PURE (prompt + nettoyage).
// Corriger n'est pas réécrire : le message doit rester CELUI de Nicolas, avec
// son ton, ses tournures et ses éventuels emojis. Seules les fautes partent.

import { skillForProofreading } from "./igSkill";

/**
 * Plafond de sécurité, pas une limite d'usage : un DM Instagram n'atteint
 * jamais cette taille. Aucune phrase réelle n'est refusée à cause de sa
 * longueur — ni à l'entrée, ni à la sortie.
 */
export const MAX_PROOFREAD = 20000;

export const buildProofreadSystem = (): string => `Tu corriges l'orthographe de messages courts écrits en français, envoyés en DM Instagram par Nicolas à des prospects.

${skillForProofreading()}

Corrige : fautes d'orthographe, accords, conjugaison, accents manquants, doublons de mots, espaces en trop.

PONCTUATION — sois exigeant, c'est souvent ce qui manque le plus :
- ajoute les points en fin de phrase, les points d'interrogation aux questions, les virgules qui manquent pour la respiration ;
- majuscule en début de chaque phrase, y compris la première, même si le message n'en a aucune ;
- apostrophes correctes ;
- espaces insécables avant ? ! : ; comme le veut le français ;
- découpe en phrases distinctes ce qui est écrit d'un seul trait sans ponctuation.

Ne touche à RIEN d'autre :
- ne reformule pas, ne réorganise pas, ne "professionnalise" pas ;
- garde le tutoiement ou le vouvoiement tel qu'il est écrit ;
- garde le ton parlé, les phrases courtes, les abréviations volontaires ;
- garde les emojis, les retours à la ligne et les liens à l'identique ;
- n'ajoute aucune formule de politesse, aucune signature, aucune coordonnée, aucun lien ;
- n'ajoute ni ne supprime aucune information.

Le message est en FRANÇAIS et doit le rester : ne traduis jamais, ne passe jamais à une autre langue, même si le message contient des mots étrangers (garde-les tels quels).

Si le message est déjà correct, renvoie-le mot pour mot.

Réponds UNIQUEMENT avec le texte corrigé. Pas de guillemets autour, pas d'explication, pas de commentaire, pas de bloc de code.`;

/**
 * Nettoie la sortie du modèle et refuse une "correction" qui n'en est pas une.
 *
 * Un modèle bavard renvoie parfois « Voici le texte corrigé : "…" » : le
 * préambule et les guillemets englobants partent ici.
 *
 * Aucun garde-fou de LONGUEUR : un message long est un message long, et une
 * correction qui ajoute la ponctuation manquante rallonge légitimement le
 * texte. Seule une réponse vide fait retomber sur l'original — le champ ne
 * doit jamais être vidé.
 */
export function cleanProofread(raw: string, original: string): string {
  let t = (raw ?? "").trim();
  if (!t) return original;

  // Bloc de code éventuel.
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  // Préambule bavard (« Voici le texte corrigé : »).
  t = t.replace(/^(voici|voilà)\b[^:\n]{0,60}:\s*/i, "").trim();
  // Guillemets englobants.
  const pairs: [string, string][] = [['"', '"'], ["«", "»"], ["“", "”"], ["'", "'"]];
  for (const [a, b] of pairs) {
    // >= et non > : une réponse réduite à des guillemets vides doit se vider
    // ici pour retomber sur l'original, pas rester telle quelle.
    if (t.length >= a.length + b.length && t.startsWith(a) && t.endsWith(b)) {
      t = t.slice(a.length, t.length - b.length).trim();
      break;
    }
  }

  return t || original;
}
