# Redesign Agenda — Liquid Glass, 3 vues, instantané

> Design validé en brainstorming (compagnon visuel) le 2026-06-17.
> Skills front appliqués : `impeccable` (register **product**) du vault Obsidian.

## Objectif

Refondre la page `/agenda` (calendrier Google Calendar) pour :
1. **Esthétique liquid glass** moderne, soignée — sombre **et** clair.
2. **Trois vues** : Semaine (principale), Mois, Liste.
3. **Instantané** : plus d'écran de chargement bloquant ; affichage immédiat (cache) + revalidation en arrière-plan.

Périmètre : refonte visuelle + perf perçue + ajout vues Mois/Liste. On **conserve** toute la logique existante (sync Google Calendar, lien fiche prospect via `CallModal`, création/suppression de RDV, gestion des chevauchements, ligne « maintenant »).

## Conformité aux règles `impeccable` (register product)

- **Pas de side-stripe border** (banni) : les RDV sont des pastilles de verre teinté (fond translucide + bordure complète + reflet spéculaire), l'accent est porté par la teinte du verre, jamais par une barre latérale.
- **Accent = états uniquement** (pas de déco) : aujourd'hui = violet, RDV en cours = fuchsia (+ libellé « en cours »), RDV passé = verre neutre désaturé, sélection = anneau accent.
- **Glass assumé et localisé** au calendrier (effet délibéré, performant) — pas de glassmorphism décoratif par défaut ailleurs.
- **Contraste ≥ 4.5:1** vérifié pour le texte des RDV en clair comme en sombre (violet/fuchsia foncés sur verre clair).
- **Typo** : une seule famille (sans système de l'app), échelle rem fixe, pas de clamp fluide pour l'UI.
- **Motion** : 150–250 ms, exprime un état (transition vue, hover, sélection), pas d'animation de chargement orchestrée ; `prefers-reduced-motion` → transition instantanée/crossfade.
- **Loading** : skeleton (jamais un spinner centré dans le contenu) et uniquement au démarrage à froid.
- **Modale** : on garde la modale de création (affordance standard) ; le détail d'un RDV passe en **popover ancré** à l'événement (plus natif qu'une modale plein écran).

## Architecture

### 1. Couche données — `app/lib/useCalendarEvents.ts` (nouveau hook)

Responsabilité unique : fournir les events d'une plage, **instantanément depuis le cache** puis revalider.

- **Cache localStorage** (`pt.agenda.events.v1`) : map `rangeKey → { events, fetchedAt }`. `rangeKey` = `from|to` arrondi à la journée.
- `useCalendarEvents(from, to)` :
  - retourne immédiatement les events en cache couvrant la plage (même partiellement) → **0 ms perçu** au retour sur la page / changement de semaine déjà visité.
  - lance un `fetch` en arrière-plan (`/api/calendar/events?from&to`), met à jour le state + le cache au retour, **sans masquer** l'affichage courant (`revalidating` au lieu de `loading`).
  - `loading` vrai uniquement si **aucune** donnée en cache pour la plage (cold start) → skeleton.
  - garde l'anti-race `fetchSeq` existant.
- **Prefetch** : à l'arrivée sur une période, précharger ±1 (semaine précédente/suivante ; mois adjacents) en tâche de fond.
- **Mutations optimistes** : `addEvent` / `removeEvent` mettent à jour state + cache immédiatement (création/suppression sans attendre un refetch complet).
- États réseau : si le fetch échoue, on garde le cache affiché + un indicateur discret « mise à jour impossible » (pas d'écran d'erreur qui masque les données). 401 → `/login`, 501 → `SetupPanel`.

### 2. Vues — `app/agenda/views/`

- **`WeekView.tsx`** : la grille horaire actuelle restylée (réutilise `layoutDay` pour les chevauchements, la ligne « maintenant », double-clic pour créer). Pastilles de verre.
- **`MonthView.tsx`** (nouveau) : grille 6×7 du mois. Chaque jour : numéro + jusqu'à 3 pastilles de RDV compactes + « +N » si dépassement. Clic sur un jour → bascule en vue Semaine centrée sur la semaine de ce jour. Aujourd'hui surligné.
- **`ListView.tsx`** (nouveau) : liste chronologique des RDV à venir (≈ sidebar actuelle en plein écran), groupés par jour, idéale mobile. Réutilise le rendu « ligne RDV ».
- Helpers dates purs dans `app/lib/calendarDates.ts` (extraits de la page : `startOfWeek`, `addDays`, `monthGrid(date) → Date[42]`, `rangeForView(view, ref)`), **testables unitairement**.

### 3. Coquille — `app/agenda/page.tsx` (refonte)

- **Segmented control** Semaine / Mois / Liste (vue persistée en localStorage, `pt.agenda.view`, comme les filtres prospects).
- Navigation période (‹ / Aujourd'hui / ›) dont le pas dépend de la vue (semaine / mois).
- En-tête en panneau verre, fond ambiant subtil (dégradé violet/fuchsia très diffus derrière le verre, atténué pour rester lisible).
- Conserve : intégration `CallModal` (fiche prospect depuis un RDV), `CreateEventModal`, suppression optimiste, `matchProspect`.
- Détail RDV → **popover** ancré (remplace la modale centrée actuelle) ; conserve lien fiche + Google Calendar + supprimer.

### 4. Style verre — tokens CSS

- Classes utilitaires (`.glass-panel`, `.glass-event`, variantes d'état) basées sur les **variables de thème existantes** (`var(--color-*)`) + `dark:`, pour basculer clair/sombre automatiquement via le `ThemeToggle`.
- Matériaux : `backdrop-filter: blur() saturate()`, bordure claire, reflet (`inset 0 1px 0`), ombre portée. Fallback si `backdrop-filter` non supporté (fond opaque équivalent).
- Échelle z-index sémantique (grille < ligne-now < popover < modale < toast).

## Data flow

```
vue + période → rangeForView() → useCalendarEvents(from,to)
  ├─ cache hit  → events affichés instantanément (revalidate en fond)
  └─ cache miss → skeleton → fetch → events + écriture cache
création/suppression → mutation optimiste (state+cache) → POST/DELETE → réconciliation
prefetch ±1 période en fond
```

## Gestion d'erreurs / edge cases

- Réseau KO : cache conservé + badge discret « màj impossible ».
- 401 → redirection login ; 501 → `SetupPanel` (inchangé).
- RDV hors plage horaire (avant 7h / après 21h) en vue Semaine : bornés au bord (comportement actuel conservé).
- Vide : empty state qui explique (créer un RDV / double-clic), pas « rien ».
- `prefers-reduced-motion` : transitions de vue instantanées.

## Tests

- **Unitaires** (purs) : `calendarDates.ts` (`monthGrid`, `rangeForView`, `startOfWeek`), `layoutDay` (chevauchements — déjà présent, à couvrir), `matchProspect`.
- **Manuel e2e** : basculer les 3 vues ; vérifier instantanéité au retour (cache) ; créer/supprimer un RDV (optimiste) ; clair/sombre ; mobile (vue Liste) ; ouverture fiche prospect depuis un RDV.

## Hors périmètre (YAGNI)

- Drag-and-drop pour déplacer/redimensionner un RDV.
- Édition d'événements récurrents.
- Multi-agendas / sélection de calendriers.
- Vue Jour dédiée (la vue Semaine + clic jour couvre le besoin).
```
