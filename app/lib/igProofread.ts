// app/lib/igProofread.ts
// Correction orthographique d'un DM — logique PURE (prompt + nettoyage).
// Corriger n'est pas réécrire : le message doit rester CELUI de Nicolas, avec
// son ton, ses tournures et ses éventuels emojis. Seules les fautes partent.

import { skillForProofreading } from "./igSkill";

export const MAX_PROOFREAD = 2000;

export const buildProofreadSystem = (): string => `Tu corriges l'orthographe de messages courts écrits en français, envoyés en DM Instagram par Nicolas à des prospects.

${skillForProofreading()}

Corrige : fautes d'orthographe, accords, conjugaison, accents manquants, ponctuation, majuscules en début de phrase, doublons de mots, espaces en trop.

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
 * Un modèle bavard renvoie parfois « Voici le texte corrigé : "…" ». Pire, il
 * peut réécrire le message au lieu de le corriger — d'où le garde-fou de
 * longueur : en cas de doute on rend l'original, jamais un texte que Nicolas
 * n'a pas écrit.
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

  if (!t) return original;
  // Une correction ne triple pas la longueur d'un message : c'est une
  // réécriture (ou une explication) — on garde l'original.
  if (t.length > original.length * 3 + 40) return original;
  return t;
}
