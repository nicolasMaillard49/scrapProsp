# Extension Chrome — Trame DM Instagram

Side panel qui affiche la trame DM du prospect ouvert sur instagram.com,
insère le message dans le champ (l'humain envoie), et journalise l'envoi
détecté dans l'app (quota, stade, relance).

## Installation (Chrome / Edge / Brave)

1. `chrome://extensions` → activer le **mode développeur**.
2. « Charger l'extension non empaquetée » → choisir ce dossier `extension/`.
3. Configurer, au choix :
   - **Auto** : créer `extension/local-config.json` (git-ignoré) —
     `{ "appUrl": "https://<ton-domaine-vercel>", "extToken": "<EXT_TOKEN>" }` —
     l'extension s'amorce toute seule au premier appel.
   - **Manuel** : clic droit sur l'icône → **Options** → URL de l'app +
     EXT_TOKEN (la valeur du `.env` de l'app, Vercel + `.env.local`).
     Les options priment sur le fichier.
4. Ouvrir instagram.com, cliquer l'icône → le panel s'ouvre.

## Le panneau pilote, Instagram est l'écran

- **Prospect suivant** (`Alt+N`) ouvre le profil du prochain prospect de la
  sélection du jour (`GET /api/instagram/queue`, lecture seule). Plus besoin
  de chercher qui contacter.
- **Radar** : les conversations où le prospect a parlé en dernier — donc
  celles qui attendent une réponse. Instagram n'offre aucune vue de ce genre.
  Le compte s'affiche en badge sur l'icône ; un clic ouvre la conversation.
- **Raccourcis** : `Alt+I` insère l'étape à envoyer, `Alt+O` corrige le champ,
  `Alt+N` passe au suivant. Ils fonctionnent même panneau fermé.

## Auto-journalisation

Tout ce qui part du champ est rattaché à une étape de la trame par
ressemblance (`NMFUtil.matchStep`), même écrit à la main sans passer par
« Insérer ». Le seuil est volontairement haut et un écart net avec le second
candidat est exigé : journaliser la MAUVAISE étape fausserait le stade et la
relance, alors que ne rien journaliser reste rattrapable à la main.

C'est ce qui empêche le stade de décrocher de la conversation.

### Le SORTANT ne suffisait pas

Une réponse reçue n'entrait au CRM que si tu cliquais « Qualifier la réponse »
puis « Enregistrer ». Une journée de réponses traitées à la main ne laissait
donc **aucune trace** : prospects maintenus dans la file de relance, taux de
réponse sous-compté.

Désormais, quand le prospect a parlé **en dernier** dans la conversation
ouverte, le fil part se faire qualifier tout seul (`auto: true`) :

- **confiance haute** → la réponse est inscrite, sans clic, et le prospect sort
  de la file de relance ;
- **doute** → rien n'est écrit, mais le verdict s'affiche dans le panneau avec
  son bouton. Le doute reste à toi — la différence, c'est que tu le vois.

Deux bornes distinctes, pour deux risques distincts :

| Borne | Portée | Où | Contre quoi |
|---|---|---|---|
| `NMFUtil.incomingKey` | ce message précis | `storage.session` | rappeler le modèle toutes les 4 s sur un fil resté à l'écran |
| `NMFUtil.replyKey` | prospect × jour Paris | `storage.local` **et serveur** | compter deux fois la même réponse |

L'idempotence est **aussi** côté serveur (`autoRecord`) : le `storage` d'un
profil Chrome ne protège de rien depuis un autre poste ou après un rechargement
de l'extension.

Un fil dont la dernière ligne est d'auteur indéterminé (`?:`) ne conclut rien,
et un fil sans aucun message de nous n'est pas une réponse — c'est une prise de
contact entrante, qui ne dit rien de l'accroche.

## Règles encodées

- L'extension **n'envoie jamais** : elle écrit dans le champ, tu envoies.
- Journalisation idempotente par (prospect, étape, jour Paris) : une double
  détection ne consomme pas deux crédits de chauffe.
- Compte émetteur : **un seul compte déclaré → il est retenu d'office** (rien à
  deviner). Plusieurs comptes → appariement par pseudo détecté, sinon choix
  explicite obligatoire avant toute journalisation.
- Le plafond jour **ne bloque plus la journalisation** : un DM parti de ta main
  est inscrit quoi qu'il arrive (`force: true` → `POST /api/instagram/dm`).
  Le plafond garde son rôle de frein pour la file automatique (`send-queue`),
  et une alerte Telegram part au premier dépassement.

## Réponse IA (hors trame)

Quand le prospect répond quelque chose que la trame ne prévoit pas : déplie
« Réponse IA ». Le **fil complet** est relu et mis en texte éditable, une ligne
par message — `moi:` les tiens, `lui:` les siens, `?:` quand l'auteur n'a pas pu
être déterminé (corrige-le, c'est un caractère). Puis « Générer 3 réponses »
→ `POST /api/instagram/reply-ai`, qui reçoit tout le fil comme contexte.

L'auteur de chaque message est déterminé par stratégies décroissantes :
nom accessible (« Vous avez envoyé… »), avatar du prospect dans la ligne,
alignement calculé, et enfin correspondance avec un message de la trame
(un texte qui EST une étape de la trame vient forcément de toi).

Le prompt (`app/lib/igReplyPrompt.ts`) impose la méthode : vouvoiement,
1-3 phrases, **aucune signature ni coordonnée**, aucun lien avant M9, aucun
prix, une seule question, et retour vers l'étape suivante de la trame.

Une réponse IA n'est **pas** une étape de la séquence : elle s'insère sans être
journalisée et ne fait pas avancer le stade.

## Correction orthographique

« Corriger l'orthographe du champ » relit ce que tu viens de taper dans
Instagram et le remplace corrigé, en place (`POST /api/instagram/proofread`).

Corriger n'est pas réécrire : le prompt (`app/lib/igProofread.ts`) interdit
toute reformulation, garde le ton parlé, le tutoiement/vouvoiement, les emojis
et les retours à la ligne, et **reste en français** (aucune traduction).
`cleanProofread` refuse une sortie qui triple la longueur — c'est une
réécriture ou une explication, pas une correction — et rend l'original.

L'armement de journalisation **survit** à la correction : c'est le même
message, donc la même étape de la trame.

## Après un rechargement de l'extension

Recharger l'extension **orpheline** les content scripts déjà injectés : la page
Instagram reste ouverte mais plus rien de l'extension n'y tourne — le champ,
le prospect et le fil deviennent tous introuvables en même temps, sans erreur
visible. Le service worker ping donc la page et **ré-injecte** `detect.js` +
`content.js` au besoin (permission `scripting`) : aucune page à recharger.

Symptôme d'une version antérieure à ce correctif : « Le champ est vide » alors
qu'il ne l'est pas, et « Aucune conversation détectée » sur une conversation
ouverte. Recharge la page Instagram une dernière fois.

## Quand Instagram casse la détection

**Filet immédiat** : si le prospect n'est pas détecté, le panneau affiche un
champ « saisis son pseudo ». Tape-le, tout redevient fonctionnel (trame,
journalisation, réponse IA) — pas besoin d'attendre un correctif.

Le pseudo de la conversation est cherché dans l'URL (page profil), puis dans
le `<header>`, puis par **vote sur les liens de profil** de la page : dans un
DM, l'interlocuteur revient plusieurs fois (en-tête, carte, « Voir profil »)
alors que la liste de gauche n'expose que des liens `/direct/t/…`. Égalité
entre candidats = aucune certitude = rien n'est détecté (jamais de pari :
un mauvais pseudo journaliserait sur le mauvais prospect).

Les textes alternatifs d'avatar ne servent jamais à extraire un pseudo :
« Photo de profil de <pseudo> » en français devient « <Nom Complet>'s profile
picture » en anglais — un nom complet n'est pas un identifiant.

Tout le couplage DOM vit dans `detect.js` (6 fonctions). Réparer là, puis :
`node --test extension/detect.test.mjs`

## Tests

`node --test extension/*.test.mjs`

## Firefox (préparé, non activé)

Le manifest déclare déjà `background.scripts` et `sidebar_action`. Reste la
signature Mozilla (une extension non signée ne survit pas au redémarrage) —
hors périmètre tant que le besoin n'existe pas.
