# Migration DA Atelier NMF — spécification et relevé

**Date** : 2026-08-10
**Skill** : `apply-atelier-nmf-design` (références : `design-system.md`, `migration-playbook.md`)
**Portée** : le cockpit interne de scrapProsp. **Hors portée assumée** : les pages vues par les
prospects (voir « Écarts assumés »).

## Invariant fondamental

La DA est une couche. Le produit garde son cerveau. Aucune route, aucun contrat d'API, aucune
permission, aucune transition d'état, aucun raccourci clavier n'a été modifié. Les 240 tests
existants sont restés verts d'un bout à l'autre, sans qu'aucun ait été adapté à la nouvelle
apparence — c'est le meilleur contrôle qu'on ait de cette promesse.

## Ce qui a changé, écran par écran

| Espace | Routes | Ce qui change visuellement | Ce qui ne change pas |
|---|---|---|---|
| Prospects | `/`, `/carte`, `/ajout`, `/vues`, `/sms` | Tokens, typographie, barre de liens remplacée par le rail, boutons sans dégradé | Filtres, focus mode, import/export, appels, SMS |
| Instagram | `/instagram`, `/instagram/kpi`, `/instagram/prospection`, `/instagram/stats` | Tokens, typographie, rail contextuel | File d'envoi, trames, quotas, KPI |
| Clients | `/crm`, `/crm/[id]` | Tokens, typographie, rail | Tableau, glisser-déposer, supervision, pièces |
| Agenda | `/agenda` | Tokens, typographie, rail — le thème rouge/bleu propre à l'agenda est CONSERVÉ | Événements, vues jour/semaine/mois |
| Funnel (console) | `/admin/funnel` | Tokens, typographie, rail | Campagnes, miroir live, emails |

## Fondations

- **Tokens** : rôles de la DA posés sur les noms historiques (`--color-surface`, `--color-accent`…).
  Renommer aurait voulu dire toucher vingt-cinq écrans le même soir, donc casser du fonctionnel pour
  une couche de peinture.
- **Familles Tailwind remappées** (`violet`, `emerald`, `amber`, `rose`) : des centaines de
  `bg-violet-600` s'alignent sans qu'une classe bouge. Mécanique déjà éprouvée par `.agenda-theme`.
- **Une seule famille** : Helvetica Neue + repli métriquement compatible. Aucune police distante.
  **Aucun italique** (12 occurrences retirées).
- **Thème** : `système | sombre | clair`, résolu dans le `<head>` avant le premier pixel, `système`
  suivant l'OS en direct. `data-theme` ET la classe `.dark` sont posés — le variant `dark:` de
  Tailwind dépend de la seconde dans toute l'app.
- **Shell** : rail 64 px (desktop), rail contextuel 192 px (≥ 1200 px), barre basse (< 900 px).

## Écarts assumés

1. **Le thème clair s'écarte des valeurs de la référence.** `#647181` et `#84909E` donnent 4,15:1 et
   **2,71:1** sur le canvas clair, sous le seuil AA que la même DA exige « pour tout texte utile ».
   Les teintes sont conservées, la clarté descend juste assez : toutes les paires passent AA.
   Entre deux invariants qui se contredisent, la lisibilité gagne.
2. **Les pages vues par les prospects ne sont pas repeintes** : `/eligibilite` (funnel, DA Lokads),
   `/di/*` et `/maquette/*` (maquettes clients, une DA par métier), `/demo/*`, `/d/*`. Ce sont des
   outils de vente qui doivent ressembler au FUTUR SITE DU CLIENT, pas à NMF. Les repeindre aux
   couleurs de l'agence détruirait leur fonction.
3. **Le thème propre à l'agenda est conservé** (bleu en clair, rouge en sombre) : il encode des
   états d'événement, pas une décoration.

## Vérifications réellement faites

- **Deux thèmes inspectés à l'écran** sur `/`, `/crm`, `/agenda`, `/login` — captures examinées, pas
  seulement des tests automatiques.
- **Débordement horizontal** : mesuré nul (`scrollWidth == clientWidth`) sur `/`, `/crm`,
  `/instagram`, `/agenda`, `/vues`, `/sms`, `/carte`, `/instagram/kpi` à la largeur de travail.
- **Contraste** : calculé pour les 18 paires de la palette, sur les trois fonds clairs et le canvas
  sombre. Tout passe AA après correction.
- **240 tests, `tsc --noEmit`, `next build`** verts après chaque palier.

## Ce qui N'A PAS été vérifié

- **Les largeurs 390, 768 et 1600 px.** La fenêtre du navigateur piloté refuse de rétrécir, la
  popup est bloquée sans geste utilisateur, et l'iframe de secours charge les pages **sans leurs
  feuilles de style** en mode dev — ses mesures ne voulaient donc rien dire et ont été jetées. Le
  CSS mobile est écrit conformément à la DA (barre basse, réserve de 96 px, cibles ≥ 40 px) mais
  **n'a pas été inspecté visuellement**. À faire sur un vrai téléphone ou avec l'émulation de
  périphérique.
- Les parcours E2E : le projet n'en a pas.
