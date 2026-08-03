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
