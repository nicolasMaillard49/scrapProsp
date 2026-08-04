# Mix métier de la prospection Instagram — design

**Date** : 2026-08-04
**Problème posé** : « le mix des prospects n'est pas bon, on n'a que des podologues, orthophonistes, kinés. Je veux un réel mix de tout à chaque fois, quitte à refaire du tri derrière. »

## Le constat, mesuré

| Mesure | Valeur |
|---|---|
| Backlog `todo` **sans verdict IA** | **4 358** — mix excellent : paysagiste 9 %, électricien 8 %, menuisier 7 %, maçon 7 %, carreleur, esthéticienne, couvreur, ferronnier, peintre, avocat, notaire, psychologue, vétérinaire… (21 métiers) |
| Stock qualifié servable | **33**, sur 5 métiers |
| Sélection 04/08 | podologue 33 %, sage-femme 24 %, dentiste 20 %, orthophoniste 16 %, ostéo 7 % |
| Sélection 03/08 | ostéo 57 %, menuisier 33 %, kiné 10 % |
| Sélection 01/08 | **menuisier 97 %** |

Le mix existe donc en base. Il ne franchit simplement pas l'étape du tri IA.

Second constat, qui aggrave le premier : les métiers qui monopolisent les journées sont les **moins rentables**. Taux de retenue IA — menuisier 48 %, paysagiste 49 %, ostéo 49 %, restaurant 38 % / **kiné 14 %**, orthophoniste 21 %, esthéticienne 21 %, sage-femme 24 %, dentiste 25 %.

## La cause

`refillStep` (`app/lib/igSelection.ts`) sert **une** cible de `ig_hunt_targets` par marche, choisie par dette croissante (`scans / poids`). Or `scans` n'était incrémenté que par la branche `collect`. Les marches `qualify` et `resolve` servaient une cible **sans faire avancer le tourniquet** : la cible en tête de dette y restait, et le refill la redrainait marche après marche, jusqu'à 400 profils du même métier par marche.

Le tourniquet lui-même était sain (dette 3.00 à 4.00 sur les 26 cibles actives) — il ne tournait tout simplement pas pendant le tri. Les libérales, à dette 3.00, passaient avant les artisans à 3.33 : d'où une journée 100 % médicale. Le 01/08, le même mécanisme avec menuisier en tête donnait 97 % menuisier.

`roundRobinByMetier` n'y pouvait rien : il étale ce qu'on lui donne, il ne crée pas de diversité. Avec un stock à 5 métiers pour 50 créneaux, il rend 10 prospects par métier — mécaniquement.

## Le design

### 1. Le tourniquet avance à chaque tour servi

`markTargetServed()` incrémente `scans` + `last_scan_at` dans les **trois** branches (`qualify`, `resolve`, `collect`). Un seul compteur, un seul sens : « nombre de tours servis ». La pondération `poids` continue de jouer à l'identique — un artisan à poids 3 prend trois tours quand une libérale en prend un. Aucune migration : la colonne existe (migration 023).

Une marche `qualify` stérile (le modèle n'a rendu aucun verdict exploitable) incrémente aussi : elle a coûté un appel Claude. Sans ça, une cible stérile revient en tête à chaque nouveau refill et y brûle un lot — le garde-fou `sterile` ne la protège que le temps d'un run.

### 2. Plafond dur de 5 par métier et par jour

`roundRobinByMetier(rows, n, { maxPerMetier = 5, already })`. Fonction pure, testée.

Le plafond est **volontairement dur, sans passe de rattrapage**. Une seconde passe non plafonnée rendrait exactement le résultat de l'ancien code — le round-robin ne fait déjà que ça. Ce sont les créneaux laissés vides qui maintiennent `shortfall > 0`, ce qui relance la boucle de refill sur d'**autres** métiers : c'est le manque qui répare le mix.

`already` reporte les métiers **déjà** posés dans la journée (reports de la veille compris, lignes écartées exclues). `ensureDailySelection` complétant la sélection à chaque appel, sans ce report dix appels successifs reposeraient cinq podologues chacun et le plafond ne vaudrait rien.

### 3. Le cockpit dit la vraie raison

Un `shortfall` avec `stockLeft > 0` ne veut pas dire « plus assez de comptes qualifiés » — le stock est plein, mais de métiers déjà servis. Le message distingue les deux cas. `maxPerMetier` transite par la donnée (`DailySelection`) et non par un import : `igSelection` embarque les 450 Ko de `communes-fr.json` et n'est pas importable côté client.

## Ce qui n'est PAS fait

Pas de script de rattrapage du backlog (décision : le refill quotidien rattrape). Les 4 358 profils non triés seront traités au fil des marches, un métier différent à chaque tour.

## Vérification

- `roundRobinByMetier` : plafond respecté sur un stock mono-métier, report de l'existant, plafond réglable, pas de boucle infinie sur stock saturé.
- Bout en bout : une passe de refill doit faire bouger `scans` sur la cible servie et faire varier le métier d'une marche à l'autre.
