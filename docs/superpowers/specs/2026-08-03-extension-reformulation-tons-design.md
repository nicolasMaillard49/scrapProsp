# Extension — reformulation d'une phrase en trois tons — Design

> Date : 2026-08-03 · Statut : validé (Nicolas) → plan d'implémentation
> Principe inchangé : **le modèle propose, Nicolas choisit et envoie.** Aucune
> variante ne part toute seule, aucune n'est journalisée d'office.

## 1. Problème

Le panneau sait corriger l'orthographe d'un message (« Corriger ») et proposer une
réponse quand le prospect sort de la trame (« Réponse assistée »). Entre les deux il
manque le geste le plus courant : la phrase est écrite, elle dit la bonne chose, mais
elle ne sonne pas juste — trop molle sur un prospect qui traîne, trop sèche sur un
premier contact. Aujourd'hui la seule issue est de la réécrire à la main, plusieurs
fois, dans le champ Instagram.

## 2. Périmètre décidé

| Décision | Choix |
|---|---|
| Source de la phrase | **Champ Instagram par défaut**, zone de saisie du panneau en repli si le champ est vide ou introuvable. |
| Tons | Exactement trois : **calme · neutre · cash**. Pas de ton libre, pas de curseur. |
| Ton « cash » | Provocateur : tape sur la douleur (manque à gagner, concurrence, profil qui ne convertit pas). Assume de piquer. |
| Contexte donné au modèle | **Prospect + fil de la conversation.** |
| Appels modèle | **Un seul**, trois variantes en JSON. |
| Journalisation | **Aucune.** Insérer une variante désarme (§ 6). |
| Raccourci clavier | Non — les trois slots `chrome.commands` sont pris, et ce geste demande de lire avant de choisir. |

Le ton « cash » ne lève **aucune** des règles absolues de la méthode (§ 4). Il porte sur
la charge du message, pas sur la licence d'inventer un chiffre ou de sortir un lien trop
tôt.

## 3. Architecture

Trois couches, calquées sur `igProofread` / `igReplyPrompt` :

```
extension/sidepanel.js  ──ig:retone──▶  extension/background.js
                                              │
                                              ▼
                              POST /api/instagram/retone
                                              │
                                              ▼
                                    app/lib/igRetone.ts  (pur)
```

Rien de neuf dans le pont vers la page : la lecture du champ passe par
`ig:composer-text`, l'écriture par `ig:insert`, tous deux déjà en place.

## 4. `app/lib/igRetone.ts` — logique pure

Aucun réseau, aucun accès base : prompt + parsing, testable seule.

### Les tons, déclarés une fois

```ts
export const TONES = [
  { id: "calme",  label: "Calme"  },
  { id: "neutre", label: "Neutre" },
  { id: "cash",   label: "Cash"   },
] as const;
```

Le panneau, le prompt et le parsing lisent tous cette liste. Ajouter un ton un jour = une
ligne, à un seul endroit.

### Garde-fous de longueur

- `MAX_RETONE = 2000` — une phrase de DM ne les atteint jamais ; c'est un plafond de
  coût, pas une limite d'usage.
- Le fil réutilise `MAX_HISTORY` (4000) déjà exporté par `igReplyPrompt.ts`.

### `buildRetoneSystem(ctx)`

`ctx = { prospect: ReplyProspect | null, history?: string }`.

Le prompt système reprend, dans cet ordre :

1. `skillForWriting()` — la méthode de prospection, source unique déjà partagée par
   `reply-ai`.
2. **Le prospect** : pseudo, prénom, métier, ville, stade. Prospect absent de la base →
   la phrase explicite « reste générique, n'invente aucun détail sur son activité »,
   reprise telle quelle de `buildReplySystemPrompt`.
3. **Lire le fil** : mêmes conventions `moi:` / `lui:` / `?:`, même consigne de ne pas
   se fier à `?:` pour affirmer qui a dit quoi.
4. **La consigne centrale** : on réécrit la phrase de Nicolas. On ne répond pas à sa
   place, on n'ajoute aucune information qu'elle ne contient pas, on ne change pas ce
   qu'elle demande. Seul le ton bouge.
5. **Les trois tons**, définis explicitement :
   - `calme` — posé, sans pression, laisse une porte ouverte ; la relation avant la
     vente.
   - `neutre` — factuel, court, ni chaleureux ni piquant ; la phrase nettoyée de ses
     hésitations.
   - `cash` — provocateur : nomme la douleur (ce qu'il perd, ce que font ses
     concurrents, ce que son profil ne fait pas). Piquer, jamais insulter, jamais
     mépriser le métier.
6. **Les règles absolues**, valables pour les trois tons :
   - 1 à 3 phrases, comme un DM tapé au pouce ;
   - aucune signature, aucune coordonnée ;
   - aucun lien avant M9, aucun prix, aucune promesse de résultat chiffrée ;
   - aucun fait inventé sur son activité ;
   - une seule question par message ;
   - **le tutoiement/vouvoiement de la phrase d'origine est conservé** — c'est le seul
     trait que le ton ne touche pas ;
   - emojis, retours à la ligne et liens déjà présents : gardés à l'identique ;
   - français, toujours.
7. **Format de sortie** :
   `{"variants":[{"tone":"calme","text":"…"},{"tone":"neutre","text":"…"},{"tone":"cash","text":"…"}]}`
   — objet JSON seul, sans texte autour, sans bloc de code.

### `buildRetoneUser(ctx)`

Fil (si fourni, tronqué à `MAX_HISTORY`) puis la phrase à reformuler, tronquée à
`MAX_RETONE`, sous un intitulé sans ambiguïté (« Phrase de Nicolas à reformuler »).

### `parseVariants(raw): RetoneVariant[]`

Tolérant par conception — une sortie mal formée ne doit jamais rendre la fonctionnalité
inutilisable. Réutilise `stripFence` et `balancedObjects` de `jsonSalvage.ts`.

Ordre de récupération :

1. JSON valide → on lit `variants` (ou un tableau nu).
2. JSON invalide, souvent parce que la réponse est **tronquée** → `balancedObjects`
   récupère les objets complets. Panne déjà rencontrée sur `reply-ai` : deux variantes
   valent mieux que zéro.
3. Rien d'exploitable → tableau vide. **Pas** de repli « texte brut » ici : contrairement
   à une suggestion de réponse, un fragment de JSON collé dans le champ Instagram serait
   nuisible.

Appariement des tons :

- `tone` reconnu (présent dans `TONES`) → la variante prend ce ton ;
- `tone` absent ou inconnu → appariement **par position** dans l'ordre de `TONES` ;
- doublon de ton → le premier gagne, le suivant retombe sur l'appariement par position ;
- variante au `text` vide → écartée.

Chaque variante sortante porte `{ tone, label, text }` : le panneau affiche `label` sans
avoir à connaître la table des tons.

## 5. `POST /api/instagram/retone`

Corps : `{ username?, text, history? }` → `200 { variants }`.

| Cas | Réponse |
|---|---|
| Pas de `ANTHROPIC_API_KEY` | 503 — « Clé Anthropic absente : reformulation indisponible. » |
| `text` vide | 400 — « Rien à reformuler — le champ est vide. » |
| JSON de requête illisible | 400 |
| Modèle sans sortie exploitable | 502 + `debug` (`model`, `stopReason`, `blocks`, `rawLength`, `outputTokens`) |
| Erreur inattendue | 500 |

**Le prospect est optionnel et jamais bloquant.** Si `username` est vide, si Supabase
n'est pas configuré, ou si le pseudo est hors base : `prospect = null` et on reformule en
restant générique. Le panneau sait déjà travailler hors base — refuser de reformuler
serait un blocage gratuit. C'est l'écart assumé avec `reply-ai`, qui exige Supabase.

La trame n'est **pas** construite (`buildTrame` n'est pas appelé) : elle sert à `reply-ai`
à ramener vers `nextStep`, alors qu'ici on ne ramène nulle part. La ligne prospect suffit,
et c'est elle qui alimente le bloc « Le prospect » du § 4 — pseudo, prénom, métier, ville
et `stage`. Ce dernier dit au ton cash s'il parle à un premier contact ou à un fantôme.

Modèle : `ANTHROPIC_RETONE_MODEL || "claude-sonnet-5"`, repli sur `claude-sonnet-4-6` aux
seuls statuts 404/400, exactement comme `proofread` et `reply-ai`. `max_tokens: 3000` —
la troncature d'un JSON à trois entrées est le bug connu.

Lecture seule : n'écrit rien en base, ne journalise rien, n'envoie rien.

## 6. Extension

### `background.js`

Un `case "ig:retone"` calqué sur `ig:proofread` : il complète `username` depuis
`storage.session.current` quand le panneau ne le fournit pas, et relaie `{ status, data }`.

### `sidepanel.html`

- Un bouton `#retone` dans `.tools`, entre « Corriger » et « Analyser ». Trois boutons à
  `flex: 1` dans la condensée du panneau : « Reformuler » tient sur une ligne.
- `<div id="retoneInput" hidden>` : le repli de saisie, un `<textarea>` court + un bouton
  de relance. Reste replié tant que le champ Instagram fournit la matière.
- `<div id="retoneOut">` : les variantes.

### `sidepanel.js`

Parcours :

1. Clic → `ig:composer-text`.
2. Champ lisible et non vide → c'est la matière.
3. Champ vide ou introuvable → `#retoneInput` se déplie, focus dans le `textarea`,
   **aucun message d'erreur** : le repli *est* la réponse. C'est ensuite le bouton du
   repli qui lance la reformulation sur ce qui y a été tapé — tant que `#retoneInput`
   est déplié, `#retone` relit d'abord le champ Instagram et ne retombe sur le
   `textarea` que si le champ est toujours vide.
4. Le fil accompagne la phrase : contenu de `#aiIncoming` s'il est rempli, sinon rien.
   On ne déclenche **pas** `grabThread()` en douce — c'est une action que Nicolas
   connaît et provoque lui-même.
5. Bouton désactivé + libellé « Reformulation… » pendant l'appel, restauré dans un
   `finally`.
6. Rendu : une `.card` par variante, `.tag` = le libellé du ton, `Copier` / `Insérer`.

Les variantes sont rendues dans l'ordre de `TONES`, y compris si le modèle les renvoie
mélangées : la place d'un ton à l'écran ne doit pas changer d'un appel à l'autre.

### L'armement — le point qui compte

« Corriger » réinsère le **même** message et conserve donc l'armement : s'il était armé
pour la journalisation, il doit le rester.

Reformuler **change** le texte. L'insertion d'une variante passe donc par `insertRaw`,
qui désarme. Sans ça, un envoi journaliserait M3 alors que ce qui est parti n'est plus
M3 — stade faussé, relance faussée.

Le filet reste entier : si la variante ressemble encore assez à l'étape, `matchStep` la
rattrape à l'envoi via `ig:sent-auto`, et c'est légitime — c'est bien cette étape,
reformulée. Aucune fausse écriture possible dans un cas comme dans l'autre.

### Changement de conversation

Sur `ig:prospect-changed`, `#retoneOut` et le `textarea` du repli sont vidés et
`#retoneInput` est replié, aux côtés de `#fixOut`, `#qualifyOut` et `#stageOut` : ce qui
restait à l'écran ne concerne pas le nouveau prospect.

### Erreurs

Les échecs du pont réutilisent `tabError()` tel quel. Les erreurs de l'app s'affichent
dans `#error` via `r?.data?.error`, comme partout ailleurs dans le panneau.

## 7. Tests

`app/lib/igRetone.test.ts`, lancé par `node --import tsx --test` :

- JSON propre à trois variantes → trois variantes, dans l'ordre de `TONES` ;
- réponse tronquée en cours de JSON → les objets complets survivent ;
- réponse entourée d'un bloc de code ou d'une phrase bavarde → parsée quand même ;
- `tone` inconnu ou absent → appariement par position ;
- doublon de ton → pas de variante perdue, pas de ton en double ;
- `text` vide → variante écartée ;
- rien d'exploitable → tableau vide (jamais de repli « texte brut ») ;
- `buildRetoneUser` tronque à `MAX_RETONE` / `MAX_HISTORY` ;
- `buildRetoneSystem` sans prospect → contient la consigne « n'invente aucun détail ».

Typecheck : `node node_modules/typescript/bin/tsc`.

## 8. Écarté volontairement

- **Un appel par ton** (trois requêtes parallèles) : tons plus tranchés, mais 3× le coût
  et la latence et trois occasions d'échouer, pour un geste censé être aussi immédiat que
  « Corriger ». À reprendre si les trois tons sortent trop proches à l'usage.
- **Un mode `retone` greffé sur `reply-ai`** : la route exige `incoming` et construit tout
  son prompt autour du retour vers `nextStep`. Deux intentions opposées dans un fichier.
- **Ton libre / quatrième ton / curseur d'intensité** : trois tons nommés couvrent la
  demande. YAGNI.
- **Raccourci clavier** : slots pris, et le geste demande de lire avant de choisir.
