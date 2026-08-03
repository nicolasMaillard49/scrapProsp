# Extension Chrome — la trame DM sur Instagram — Design

> Date : 2026-08-03 · Statut : validé (Nicolas) → plan d'implémentation
> Principe inchangé : **l'outil n'envoie JAMAIS**. Il affiche la trame, pré-remplit
> le champ, et trace ce que l'humain a réellement envoyé. Aucun clic sur « Envoyer ».

## 1. Problème

La trame vit dans l'app (`/instagram`), le travail se fait sur `instagram.com`. Chaque
message impose un aller-retour entre deux onglets : relire l'étape, copier, revenir,
coller, repartir journaliser. À 50 DM/jour, c'est le principal frottement de la session.

## 2. Périmètre décidé

| Décision | Choix |
|---|---|
| Portée | Affiche · copie · **insère dans le champ** · journalise. **Pas** d'envoi automatique. |
| Journalisation | **Un geste** : l'insertion arme un détecteur, l'envoi détecté journalise. |
| Emplacement | **Side panel Chrome natif** (`chrome.sidePanel`) — le DOM d'Instagram n'est pas modifié. |
| Architecture | **Extension mince** : l'app garde toute la logique métier. |
| Distribution | Chargée non empaquetée (usage perso). Pas de Chrome Web Store. |

Risque accepté explicitement : l'insertion dépend de sélecteurs obfusqués qui casseront
aux refontes d'Instagram. Contenu par l'isolation du § 6.

## 3. Authentification — pourquoi un token dédié

Le cookie `prospects-auth` est posé en `sameSite: "lax"` (`app/login/page.tsx:15`). Une
requête émise depuis l'origine `chrome-extension://…` est cross-site : Chrome ne joint pas
le cookie, la route rendrait 401. Le passer en `SameSite=None` ouvrirait la surface CSRF de
toute l'app — écarté.

On reprend le motif déjà en place pour les crons (`x-cron-secret`) : un en-tête secret. Un
site tiers ne peut pas forger un en-tête custom, donc aucune brèche CSRF.

**`middleware.ts`** — avant le contrôle du cookie, et **restreint à `/api/instagram/`**
pour borner la portée :

```ts
const extToken = process.env.EXT_TOKEN;
if (
  extToken &&
  pathname.startsWith("/api/instagram/") &&
  req.headers.get("x-ext-token") === extToken
) {
  return NextResponse.next();
}
```

`EXT_TOKEN` : nouvelle variable `.env.local` + Vercel. Sans elle, la branche est morte et
l'extension reçoit 401 — pas de dégradation silencieuse.

Le token est saisi une fois dans la page d'options de l'extension et rangé dans
`chrome.storage.local`.

## 4. Route `GET /api/instagram/trame?username=<u>`

Nouvelle route, unique source de données de l'extension.

**Réponse 200**
```jsonc
{
  "prospect": {                 // null si le compte n'est pas en base
    "id": "uuid", "username": "laura_x", "full_name": "…",
    "stage": "presentation", "status": "contacted",
    "metier": "menuisier", "ville": "Angers", "followers": 1240,
    "reply_count": 1, "next_followup_at": "2026-08-03T16:00:00Z",
    "score_tier": "hot"
  },
  "steps": [{ "step": "M1", "title": "…", "text": "…" }, …],  // 12 entrées
  "nextStep": "M5",             // null si séquence close (questionnaire/booké/perdu)
  "accounts": [{ "id": "uuid", "username": "nmf.agence", "canSend": true,
                 "sentDay": 12, "daily": 50 }]
}
```

Construction — aucune logique nouvelle, on réutilise l'existant :
- lookup `instagram_prospects` par `username` (insensible à la casse) ;
- `instagramDmSequence()` (`app/lib/instagram.ts:601`) avec le même calcul de `metierEff`
  que `PipelineCard` (`detectMetier(profession_ia)` → `detectMetier(category, bio)` → `metier`) ;
- lien de démo `${origin}/di/${shortCode(prospect.id)}` (`app/lib/links.ts`) ;
- `nextStep` = `nextStepFor(prospect.stage)` (`app/lib/igPipeline.ts`) ;
- `accounts` : mêmes compteurs que `GET /api/instagram/accounts`.

**Prospect inconnu** : `prospect: null` + `steps` de la trame générique
(`instagramDmSequence({ metier: "", ville: "" }, "")`), `nextStep: "M1"`. Le panneau
propose alors « ajouter aux prospects ».

`POST /api/instagram/dm` est réutilisée telle quelle pour journaliser — quota, stade,
`next_followup_at` et alertes Telegram restent au même endroit.

## 5. Structure de l'extension (Manifest V3)

```
extension/
  manifest.json          host_permissions: instagram.com + le domaine de l'app
  background.js          service worker — TOUT le réseau passe par ici
  content.js             injecté sur instagram.com — DOM uniquement, zéro fetch
  detect.js              ← le seul module couplé au DOM d'Instagram (§ 6)
  sidepanel.html/.js     l'UI de la trame
  options.html/.js       saisie de EXT_TOKEN + URL de l'app
```

**Règle d'architecture, pas un détail de style :** les content scripts sont soumis au CORS
de la page depuis Chrome 73 ; un `fetch` vers l'app depuis `content.js` échouerait. Émis
depuis le service worker, couvert par `host_permissions`, il n'y a **pas de préflight ni de
CORS à gérer**. D'où : `content.js` observe et manipule, `background.js` parle au réseau,
les deux communiquent par `chrome.runtime.sendMessage`.

### Portabilité navigateurs — par structure, pas par abstraction

Décision analysée (Chrome pur / module d'abstraction du panneau / structure portable) :
un module d'abstraction n'aurait presque rien à envelopper — le side panel est
**déclaratif** (un chemin dans le manifest, un unique `setPanelBehavior` à l'install).
On obtient la même portabilité sans couche d'indirection :

- **Manifest à double déclaration** — chaque navigateur lit la clé qu'il connaît,
  l'autre est ignorée (motif documenté MDN) :

  ```jsonc
  "background": {
    "service_worker": "background.js",   // Chrome/Edge/Brave
    "scripts": ["background.js"]         // Firefox (event page)
  },
  "side_panel":     { "default_path":  "sidepanel.html" },   // Chrome
  "sidebar_action": { "default_panel": "sidepanel.html" }    // Firefox
  ```

- **Namespace `chrome.*` partout** : Firefox le supporte pour tout ce qu'on utilise
  (runtime, storage, tabs). Aucun polyfill.
- **Le seul appel spécifique Chrome** — `chrome.sidePanel.setPanelBehavior(…)` à
  l'installation — est gardé par `if (chrome.sidePanel)`.
- La page du panneau est du HTML/JS ordinaire alimenté par messages runtime :
  identique dans les deux navigateurs.

Chromium (Edge, Brave, Opera…) : le dossier se charge tel quel. Firefox : les clés
ci-dessus suffisent côté code ; reste la friction de **signature** (une extension non
signée n'y survit pas au redémarrage) — assumée hors périmètre tant que le besoin
n'existe pas.

## 6. `detect.js` — toute la fragilité dans un seul fichier

Seul module qui connaît le DOM d'Instagram. Quatre fonctions, une responsabilité chacune :

| Fonction | Rend | Repli si introuvable |
|---|---|---|
| `currentUsername()` | pseudo du profil ou de la conversation ouverte | `null` → panneau générique |
| `composerNode()` | le `contenteditable` du champ de message | insertion désactivée, « Copier » reste |
| `loggedInAccount()` | pseudo du compte Instagram connecté | choix manuel du compte dans le panneau |
| `watchSend(node, cb)` | appelle `cb()` quand le champ passe de rempli à vide | filet du § 7 |

Chaque fonction tente plusieurs stratégies, de la plus stable à la plus fragile : URL
(`/direct/t/…`, `/<username>/`) et attributs ARIA d'abord, arborescence ensuite, jamais de
classe obfusquée seule. Testables sur des extraits HTML figés en fixtures — c'est le seul
endroit à réparer quand Instagram change.

Instagram étant une SPA, `content.js` surveille `location.href` et redéclenche la détection
à chaque changement de conversation.

## 7. Flux d'un message

1. Tu ouvres une conversation. `content.js` détecte `@laura_bullededouceur`, l'annonce au
   service worker, qui appelle `/api/instagram/trame`.
2. Le side panel affiche : le prospect, son stade (« Présentation »), les 12 messages,
   **M5 surligné « à envoyer maintenant »** — même sémantique que `nextStepFor` dans l'app.
3. Clic sur **Insérer** → `content.js` écrit le texte dans le composer et arme `watchSend`.
4. Tu relis, tu corriges, **tu envoies toi-même**.
5. Le champ se vide → `watchSend` déclenche → `POST /api/instagram/dm` → quota, stade et
   relance à jour. Le panneau se rafraîchit : M5 devient envoyé, M7 devient l'étape courante.

**Le filet.** Si `watchSend` n'a rien vu au bout de 5 s, le panneau réaffiche un bouton
**« Envoyé »** manuel. Un faux négatif de détection ne doit jamais faire disparaître un M1
des compteurs de chauffe — c'est le risque assumé au § 2, il lui faut une porte de sortie.
Symétriquement, la journalisation est **idempotente par (prospect, step, jour)** côté
extension : une double détection ne consomme pas deux crédits.

## 8. Compte émetteur — détecté, jamais choisi par défaut

`loggedInAccount()` donne le compte Instagram connecté ; on l'apparie par `username` à
`ig_accounts`. Attribuer un DM au mauvais compte fausserait deux quotas de chauffe à la
fois, donc :
- correspondance trouvée → `account_id` imposé, affiché en tête du panneau ;
- aucune correspondance → **rien n'est journalisé**, le panneau demande de choisir
  explicitement dans la liste `accounts` ;
- compte au plafond (`canSend: false`) → l'insertion reste possible (tu peux vouloir
  répondre à une conversation en cours), le bouton de journalisation prévient que
  `POST /dm` rendra 429.

## 9. Garde-fous conservés

- Aucun clic programmatique sur « Envoyer ». L'extension écrit, l'humain envoie.
- Aucun envoi en masse, aucune boucle : un prospect à la fois, celui affiché à l'écran.
- Les plafonds de chauffe restent arbitrés par `POST /api/instagram/dm` (429 au plafond) —
  l'extension n'a aucun pouvoir de les contourner.
- Fenêtre 8 h-20 h et calcul de relance inchangés : ils vivent dans `igPipeline.ts`.

## 10. Tests

- **`app/lib/igTrame.test.ts`** — construction de la réponse de `/api/instagram/trame` à
  partir d'un prospect figé : `metierEff`, lien de démo, `nextStep`, cas prospect inconnu.
- **`extension/detect.test.js`** — les quatre fonctions de `detect.js` sur des fixtures HTML
  (conversation, profil, champ vide/rempli), plus le cas « rien ne matche » qui doit rendre
  `null` sans jeter.
- **Idempotence** : deux détections d'envoi rapprochées → un seul `POST /dm`.

## 11. Hors périmètre

Envoi automatique · réponses suggérées par IA · scraping depuis l'extension · publication
sur le Chrome Web Store · signature Mozilla et Safari (la structure du § 5 laisse Firefox
ouvert, on ne paie la signature que si le besoin arrive) · lecture des réponses entrantes
(elle reste dans `ReplyButton` côté app).
