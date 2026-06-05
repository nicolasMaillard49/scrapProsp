# Design — Découverte de prospects Instagram (semi-auto)

> Date : 2026-06-05
> Statut : validé (brainstorming) → à planifier
> Canal : Instagram (nouvelle source de découverte, parallèle à Google Maps)

## 1. Objectif

Ajouter une page `/instagram` à l'app. L'utilisateur saisit une **niche** (hashtag,
ex. `#coiffeurbordeaux`) ; le bot découvre via **Apify** une centaine de comptes pros
**sans site web**, les stocke, et génère pour chacun un message DM personnalisé
(tutoiement, 2 variantes). **L'envoi reste 100 % manuel** (semi-automatique) :
l'utilisateur copie le message et l'envoie depuis Instagram.

Principe directeur du pipeline existant conservé : **« pas de site web = prospect »**.

## 2. Périmètre

**Dans le périmètre**
- Découverte à la demande par hashtag via Apify.
- Filtre obligatoire « pas de site web ».
- Stockage dans une table dédiée `instagram_prospects`.
- Déduction `metier` (→ template) + `ville` à la découverte.
- **Aperçu de site sur-mesure par lead** (réutilise les templates de démo existants).
- Générateur de message DM niche-adapté (2 variantes), avec lien d'aperçu personnalisé.
- UI de recherche + revue + suivi de statut.

**Hors périmètre (YAGNI pour le MVP)**
- Envoi automatique de DM (interdit/risqué — voir §8).
- Découverte par lieu, par voisinage concurrentiel (V2 possible).
- Enrichissement SIRENE/téléphone des comptes Insta.
- Cron / découverte programmée (usage à la demande uniquement).
- Réconciliation/dédup avec la table `prospects` (Google Maps) — tables séparées.

## 3. Découverte (à la demande)

### Entrées
- `hashtag` : chaîne (ex. `coiffeurbordeaux`, avec ou sans `#`).
- `target` : nombre de leads qualifiés visés. **Défaut : 100.**

### Pipeline Apify (2 actors en chaîne)
1. `apify/instagram-hashtag-scraper` — entrée : le hashtag → sortie : posts avec
   `ownerUsername`. On collecte les usernames uniques.
2. `apify/instagram-profile-scraper` — entrée : la liste de usernames → sortie par
   profil : `username`, `fullName`, `biography`, `externalUrl`, `followersCount`,
   `businessCategoryName` (ou équivalent).

Appel via REST (`run-sync-get-dataset-items`) ou SDK `apify-client`. Token dans
`APIFY_TOKEN` (`.env.local`, déjà enregistré).

### Déduction `metier` + `ville` (pour l'aperçu sur-mesure)
Pour rendre un aperçu de site cohérent, chaque lead retenu reçoit :
- **`metier`** : code mappé vers un template (`templateForMetier`). Déduit de
  `businessCategoryName` + mots-clés de la bio. Si inconnu → code générique
  (template `pro` par défaut, comme pour les prospects Maps non mappés).
- **`ville`** : extraite **du hashtag** (ex. `coiffeurbordeaux` → `Bordeaux`) en priorité,
  sinon d'un nom de ville détecté dans la bio. Si introuvable → vide (l'aperçu et le
  message basculent sur une formulation neutre « dans ta région »).
- **`name`** : `fullName` du compte, sinon `@username`.

La même déduction de niche sert à l'adaptation du message (§5) — une seule logique.

### Sur-récupération + plafond
Beaucoup de comptes ont un site → écartés. Le bot **sur-récupère** par lots jusqu'à
atteindre `target` leads qualifiés **OU** un **plafond dur** de profils scannés.
- Plafond par défaut : **600 profils scannés** par run (borne le coût Apify ≈ 1,5 $/run).
- Si le plafond est atteint avant la cible : on s'arrête et on signale « X/100 trouvés
  (plafond atteint) ».

### Filtre « pas de site web »
Un compte est retenu comme prospect si :
- `externalUrl` est **vide**, OU
- `externalUrl` pointe vers un **agrégateur** (domaine ∈ { linktr.ee, linktree,
  beacons.ai, taplink, instagram.com, facebook.com, fb.me, business.google.com,
  g.page, linktw.in, lnk.bio, … }).

Écarté si `externalUrl` est un **vrai domaine** (tout le reste).

> Justification : un agrégateur de liens (Linktree…) n'est **pas** un vrai site — c'est
> même un argument de vente. On le traite comme « pas de site ».

La liste des domaines-agrégateurs est centralisée dans une constante pour évoluer.

### Dédup
Clé unique : `username`. Un compte déjà présent en base (quel que soit son statut)
n'est ni réinséré ni réécrasé ; il ne compte pas dans la cible du run en cours.

## 4. Stockage — table `instagram_prospects`

| Colonne          | Type        | Notes                                                        |
|------------------|-------------|--------------------------------------------------------------|
| `id`             | uuid PK     | `gen_random_uuid()`                                          |
| `username`       | text UNIQUE | handle Instagram (sans `@`) — clé de dédup                   |
| `full_name`      | text NULL   | nom affiché du compte                                        |
| `bio`            | text NULL   | biographie (→ déduction niche + perso message)              |
| `external_url`   | text NULL   | lien du profil (sert au filtre ; conservé pour audit)        |
| `followers`      | int NULL    | nombre d'abonnés                                             |
| `category`       | text NULL   | catégorie business Instagram si dispo                       |
| `metier`         | text NULL   | code métier déduit (→ template d'aperçu)                     |
| `ville`          | text NULL   | ville déduite (hashtag/bio) — pour l'aperçu + le message     |
| `hashtag_source` | text        | hashtag qui a remonté le compte (traçabilité)               |
| `status`         | text        | `todo` \| `contacted` \| `positive` \| `negative` (défaut `todo`) |
| `notes`          | text        | annotations libres (défaut `''`)                            |
| `discovered_at`  | timestamptz | date du run de découverte (défaut `now()`)                  |
| `created_at`     | timestamptz | défaut `now()`                                              |
| `updated_at`     | timestamptz | trigger de mise à jour                                      |

Migration SQL dédiée : `supabase/migration-006-instagram-prospects.sql` (même style que
les migrations existantes). Index sur `status` et `hashtag_source`.

## 5. Générateur de message DM

Fonction `instagramDmMsg(prospect, link)` (façon `salesSmsMsg`), retournant **2 variantes** :
- `withLink` : accroche + valeur + **lien démo** direct.
- `tease` : accroche + valeur + « je te l'envoie ? » **sans lien** (meilleure délivrabilité
  pour un 1er DM à un non-abonné).

**Ton** : tutoiement, décontracté, emojis légers, signé « Nicolas, NMF ».

**Adaptation niche** — table accroche + angle de valeur, niche déduite de
`category`/`bio` (mots-clés), fallback générique :

| Niche          | Accroche (compliment)        | Angle de valeur                       |
|----------------|------------------------------|---------------------------------------|
| Coiffure/beauté| « ton feed donne envie »     | prise de RDV en ligne                 |
| Restauration   | « ça donne faim »            | menu + réservations en ligne          |
| Artisanat/BTP  | « beau travail »             | galerie de réalisations + devis       |
| *(défaut)*     | « j'ai bien aimé ton compte »| présence pro + contact facile         |

**Lien d'aperçu (V2 — sur-mesure par lead).** Chaque lead a son propre aperçu de site,
rendu par les templates existants à partir de `name`/`metier`/`ville` (route §7). Le lien
injecté dans les messages est l'URL courte de cet aperçu (`/di/<code>`). Comportement
identique à la démo Maps (`/d/<code>`), mais alimenté par `instagram_prospects`.

### Exemple (coiffeur)
**withLink**
> Salut 👋 Je suis tombé sur ton salon en cherchant des coiffeurs sur Bordeaux, ton feed
> donne envie ! J'ai vu que t'avais pas encore de site — du coup je t'ai préparé un aperçu
> gratuit (rien à payer, juste pour voir) : [lien] Dis-moi ce que t'en penses ! — Nicolas, NMF

**tease**
> Salut 👋 Je suis tombé sur ton salon en cherchant des coiffeurs sur Bordeaux, ton feed
> donne envie ! J'ai remarqué que t'avais pas de site, alors je t'ai fait un aperçu gratuit
> pour te montrer ce que ça pourrait donner. Je te l'envoie ? 🙂

## 6. UI — page `/instagram`

**Barre de recherche (haut)**
- Champ `hashtag` + champ `target` (défaut 100).
- Bouton **Lancer la recherche** → appelle l'API de découverte.
- Pendant le run : spinner + compteur « X/100 trouvés », message si plafond atteint.

**Liste des leads** (sous la barre, triable/filtrable par statut)
Pour chaque lead :
- Handle (lien `instagram.com/<username>`), `full_name`, followers, catégorie, extrait de bio.
- Les **2 variantes** de message avec bouton **Copier** chacune.
- Bouton **Ouvrir le DM** (ouvre le profil/DM Instagram dans un nouvel onglet).
- Boutons statut : **Contacté / Positif / Négatif** (met à jour `status`).

**Filtre** : par défaut afficher les `todo` ; bascules pour voir les autres statuts.

## 7. Architecture technique

- **API route** `POST /api/instagram/discover` — body `{ hashtag, target }`. Orchestre
  Apify (2 actors), filtre, dédup, upsert en base, renvoie le compte rendu du run.
  Lecture des secrets côté serveur uniquement.
- **API route** `PATCH /api/instagram/[id]` (ou route de statut) — met à jour `status`/`notes`.
- **Lib** `app/lib/apify.ts` — client/appels Apify (actors, run-sync, parsing).
- **Lib** `app/lib/instagram.ts` — filtre « pas de site » (+ liste agrégateurs),
  déduction niche/`metier`/`ville`, `instagramDmMsg`.
- **Route d'aperçu** `app/di/[code]/page.tsx` — aperçu sur-mesure d'un lead Insta.
  Réutilise `DemoView` / `TEMPLATES`. Un `getInstagramProspectByCode(code)` lit
  `instagram_prospects` (même technique de préfixe d'UUID que `getProspectByCode`) et
  mappe la ligne vers `TemplateProps` (`name`=`full_name`/`@username`, `metier`, `ville`,
  `phone`/`rating`/`reviews`/`address` = null). Métadonnées OG comme la démo Maps.
- **Lib** `app/lib/instagramLinks.ts` (ou extension de `links.ts`) — `instagramDemoUrl(id)`
  → `/di/<shortCode(id)>`.
- **Page** `app/instagram/page.tsx` + composants de liste/ligne.
- **Migration** `supabase/migration-006-instagram-prospects.sql`.

## 8. Risque / conformité

- **Lecture seule** via Apify (cloud) → **aucun compte Instagram grillé**, pas de proxy
  à gérer côté NMF.
- **Plafond de profils/run** → coût Apify borné et prévisible.
- **Envoi 100 % manuel** → pas de blast automatisé détectable, conforme à l'esprit
  « ton humain, pas commercial » du pipeline existant.
- **RGPD/CNIL** : contact à froid B2B encadré ; le scraping de données publiques reste
  à volume modéré. Le message offre une sortie implicite (pas de relance si pas de réponse)
  et reste personnel.

## 9. Coût estimé

- Apify Instagram scrapers : ~2-3 $ / 1000 profils → **≈ 1 à 1,5 $ par run** de ~500-600
  profils scannés (pour ~100 leads). Free tier Apify (~5 $/mois) couvre quelques runs.

## 10. Critères de succès (MVP)

1. Lancer une recherche par hashtag remonte ~100 comptes **tous sans site web** (ou
   « plafond atteint » si la niche est trop pourvue en sites).
2. Aucun doublon de `username` en base.
3. Chaque lead affiche 2 variantes de message cohérentes avec sa niche, copiables.
4. Le lien d'aperçu (`/di/<code>`) ouvre un site sur-mesure cohérent avec le métier/la ville du lead.
5. Le statut d'un lead se met à jour et persiste.
6. Coût d'un run borné par le plafond de profils.
