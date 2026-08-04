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

## Deux trames — « Standard » et « Site »

Sous la partition, une bascule choisit la méthode déroulée sur ce prospect.

- **Standard** (`M1`-`M9`) : la méthode complète — présentation, connexion,
  puis la douleur au 7ᵉ message. Aucune ressource en DM.
- **Site** (`S1`-`S5`) : la variante pour les comptes **sans site web** — c'est
  toute l'audience, sélectionnée sur `has_website === false` (+30 au score).
  La question tombe au 2ᵉ message, **sa maquette au 3ᵉ**.

```
S1  Hello Laura ! J'ai vu que vous étiez esthéticienne, c'est toujours le cas ?
S2  Parfait ! Une question toute bête : aujourd'hui, quand quelqu'un cherche
    votre nom sur Google — ou juste « esthéticienne Angers » — il tombe sur quoi ?
S3  C'est exactement là que ça coince : on passe son temps à chercher des
    clients, pendant que ceux qui vous cherchent DÉJÀ ne vous trouvent pas.
    → https://prospects.nmf-agence.com/di/<code>
S4  Le plus simple c'est qu'on se cale 15-20 min…
S5  Questionnaire, puis on bloque le créneau.
```

La règle « aucune ressource avant M9 » n'est pas violée : la maquette **n'est
pas une ressource** (guide, étude de cas, lien d'agence) — c'est *son* site,
portant *son* nom, qui ne se comprend qu'en le voyant. C'est l'argument, pas
un support.

### Ce qui décide de la trame

1. La **bascule du panneau**, si tu l'as touchée pour ce prospect ;
2. sinon, la trame **déjà engagée** — déduite du dernier `S…`/`M…` réellement
   parti (`ig_dm_log`).

Le second point n'est pas un détail : le choix du panneau vit dans le
`storage` de Chrome. Vidé, ou consulté depuis un autre poste, une conversation
commencée en trame site repartirait en standard au message suivant, et le
prospect verrait deux méthodes s'entrechoquer. **Ce qui a été envoyé est la
seule source qui ne ment pas.**

Basculer en cours de conversation est permis (c'est parfois exactement ce
qu'on veut après une réponse) : l'étape à envoyer est recalculée sur le stade
atteint, jamais remise à zéro.

Les identifiants sont **distincts** (`S…` et non `M…`) pour une raison :
c'est ce qui rend les deux trames comparables dans le journal — quelle trame a
produit quelle réponse. Un identifiant partagé rendrait la mesure impossible.
Les relances `R1`-`R3` restent communes : elles relancent le silence, pas
l'étape.

## A-t-il déjà répondu ?

Sous le métier, une ligne dit l'essentiel avant tout geste :

- **Jamais répondu · accroche il y a 9 h** → sa prochaine réponse sera une
  **réponse à froid**, celle qui compte pour le taux d'accroche.
- **A répondu · il y a 2 j** + *3 réponses — conversation en cours* → on
  poursuit un échange. Une nouvelle réponse ici ne redevient jamais une
  réponse à froid : seule la première compte, et elle est déjà comptée.
- **Jamais contacté** → il n'y a rien à attendre.

L'état se lit à la **pastille** autant qu'au mot : la couleur double
l'information, elle ne la remplace pas (le panneau vit en clair comme en
sombre).

C'est la même règle que l'auto-journalisation : un fil déjà traité n'est
inscrit que si `reply_count === 0`.

## Mes liens

Les liens qu'on colle dix fois par jour — prise de RDV, simulateur, site.
Ils vivaient dans les marque-pages : aller les chercher coupait la
conversation en deux.

Par défaut : audit gratuit 20 min, entretien exceptionnel, simulateur ROI,
formulaire d'audit, site de l'agence. **Modifiables dans les options**, une
ligne `Libellé | https://…` (le libellé est facultatif, une ligne sans URL
`https://` valide est écartée et signalée — un lien tronqué ne se voit
qu'une fois collé dans un DM parti).

Le geste par défaut est **Copier**, pas ouvrir : ces liens finissent dans un
message écrit à la main. Rien n'est inséré d'office dans le champ — la trame
reste seule à décider de ce qui part, et quand.

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

> [!warning] Se limiter au dernier locuteur ne capte presque rien
> Relevé sur la vraie boîte : **14 conversations sur 15** commençaient par
> « Vous : ». Tu réponds dans la foulée — donc le fil se termine par TON
> message, et la réponse du prospect disparaît du radar. La détection porte
> sur le dernier message **entrant**, où qu'il soit dans le fil.
>
> Le fil ne porte aucune date. Quand tu as déjà répondu, on n'inscrit que les
> prospects **jamais journalisés** (`reply_count === 0`) : c'est la donnée
> manquante, et c'est sa 1ʳᵉ réponse qui compte (réponse à froid, comptée une
> fois). Pour un prospect déjà journalisé, on s'abstient plutôt que de dater à
> l'aveugle une réponse peut-être vieille de trois semaines.

Désormais, quand le prospect a répondu dans la conversation ouverte, le fil
part se faire qualifier tout seul (`auto: true`) :

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
