# Funnel éligibilité — workflow manuel de provisioning + campagne semi-auto

**Date** : 2026-06-17
**Statut** : design validé, prêt pour plan d'implémentation

## Contexte & problème

La Phase 2 supposait que le funnel **crée automatiquement** un sous-compte Google Ads
sous le MCC 671 (`createCustomerClient`) au clic « Lancer ma campagne ». Le premier vrai
run (lead `testest`, 2026-06-17) a échoué côté Google :

> « This manager account can't create new accounts. You'll need to link a Google Ads
> account that has spent more than $1,000 and has a history of policy compliance. »

Ce n'est pas un bug : c'est une **garde anti-abus** de Google sur un MCC récent. Tant que
le MCC 671 n'a pas un compte lié ayant dépensé > 1 000 $, l'API ne peut **pas créer de
nouveaux comptes**.

**Distinction clé confirmée** : seul `createCustomerClient` (création de **compte**) est
bloqué. Créer une **campagne** (`mutateResources`) dans un compte **existant et lié au MCC**
n'est PAS concerné par cette restriction.

## Décision

On pivote vers un **workflow manuel de provisioning + campagne semi-automatique** :

1. **(Client)** remplit le formulaire → rapport → clic « Lancer ma campagne ».
2. **(Système)** marque `launched`, génère + persiste le **plan** de campagne, notifie
   Nicolas (Telegram) « compte à créer manuellement » + envoie l'email client.
3. **(Nicolas, manuel)** crée un compte Google Ads **autonome (hors MCC)**, invite l'email
   du client en **Admin**, le client **ajoute sa carte**, puis Nicolas **lie le compte au
   MCC 671**.
4. **(Nicolas, admin)** colle le **customer ID** du compte lié dans `/admin/funnel` → bouton
   « Créer la campagne » → l'API crée la **campagne PAUSED** via le plan déjà généré.
5. **(Client)** accepte l'invitation Google + ajoute sa carte (page d'activation).

Le code d'auto-création (`create.ts`, allow-list) **reste en dormance** dans le repo pour
le jour où le MCC sera débloqué (compte > 1 000 $ lié) ; il n'est simplement plus appelé.

## Périmètre

### 1. `POST /api/eligibilite/launch` — ne plus auto-créer
- **Retire** la création réelle et le gating allow-list pour ce déclenchement (force dry-run
  pour la génération + persistance du plan).
- Conserve : `status = launched`, génération `buildPlan`, persistance record `dry_run`
  (`google_ads_accounts.payload`), email client, marquage `launched`.
- **Notif Telegram** reformulée : « 🛠️ Compte Google Ads à créer manuellement — {métier}
  {ville} — {email} — {tél} · budget {X} €/j · {N} mots-clés ».

### 2. `app/lib/googleAds/campaign.ts` — campagne sur compte lié
- Nouvelle fonction `createCampaignOnLinkedAccount(lead, customerId)` :
  - normalise `customerId` (strip non-chiffres ; rejette si ≠ 10 chiffres → évite
    `CUSTOMER_NOT_FOUND`),
  - vérifie `googleAdsConfigured()` et `plan.params.finalUrl` (RSA exige une final URL),
  - `buildPlan(lead)` puis `createPausedCampaign(customerId, plan)` (déjà codé, réutilisé tel
    quel — **ne crée PAS** de compte),
  - persiste (`recordAdsAccount`, `status:"paused"`, `customer_id`, `campaign_id`, `payload`),
  - renvoie `CreateResult` (réutilise le type existant), gère l'erreur via `describeAdsError`.

### 3. `POST /api/eligibilite/create-campaign` (nouveau, admin)
- Body `{ leadId: string, customerId: string }`.
- Charge le lead (`supabaseAdmin`), 404 si absent.
- Appelle `createCampaignOnLinkedAccount(lead, customerId)`.
- Notif Telegram succès (« ✅ Campagne PAUSED créée — compte {id} — {campagne} ») / échec.
- Renvoie `{ ok, customerId, campaignId, error }`.

### 4. `app/admin/funnel/page.tsx` — doc workflow + fiche par lead
- **Section statique « Workflow création compte Google Ads »** : checklist des étapes
  manuelles (créer compte hors MCC → inviter le client en Admin → il ajoute sa carte →
  lier au MCC 671 → créer la campagne via le bouton) + rappel de la restriction MCC.
- **Par lead « lancé »** (composant client `LeadAdsPanel`) :
  - **plan en copiable** (nom de compte, budget €/j, géo, mots-clés, titres/descriptions
    RSA, négatifs, tél) — lu depuis le dernier record `google_ads_accounts.payload` du lead,
  - **champ customer ID + bouton « Créer la campagne »** → appelle l'endpoint §3,
  - affiche le statut (campagne créée · ID campagne, ou erreur lisible).

### 5. `app/eligibilite/activation/[id]/page.tsx` — page client générique
- Retire le bandeau « ✅ Votre compte est créé · ID » et le polling billing
  (`ActivationStatus`) — plus d'auto-création, donc plus de `customer_id` à afficher.
- Reformule l'intro : « Votre conseiller prépare votre compte, vous recevrez sous peu une
  invitation Google par email. »
- Conserve à l'identique : étapes 1-4 (ouvrir l'email Google → accepter → ajouter la carte
  via `PaymentMockup` → c'est lancé), encart rassurance, CTA, mentions légales.

### 6. Correctif best-practice (skill `google-ads-artisans`)
- `create.ts` : `network_settings.target_search_network` passe de `true` à **`false`**
  (réseau Partenaires de recherche OFF — règle artisan local). Display déjà OFF, PRESENCE
  déjà OK, négatifs déjà présents.

## Hors périmètre (suivi documenté)

- **Action de conversion « appel » non créée** par `createPausedCampaign` (le `callTracking`
  est dans le plan mais pas appliqué). Le skill artisan l'exige avant diffusion — à régler
  **avant la dé-pause**, dans un lot ultérieur. Sans danger ici car la campagne est PAUSED.
- **Ad groups segmentés par intention** (urgence/installation/dépannage/devis) : optimisation
  future, on garde un seul ad group pour l'instant.
- **Dé-pause de la campagne** : reste 100 % manuelle (aucune automatisation de mise en ligne).
- **Garde budget minimum** (≥ 5 €/j) : à considérer si le formulaire autorise des budgets
  trop bas ; non traité ici.

## Tests

- **Unitaire** `createCampaignOnLinkedAccount` : normalisation du customer ID (tirets/espaces
  → 10 chiffres ; rejet si invalide), refus si `finalUrl` absente, refus si credentials
  incomplets. Le `mutateResources` réel reste testé manuellement (script).
- **Script** `scripts/test-google-ads-real.mjs` étendu / variante pour cibler un customerId
  fourni (test réel `createCampaignOnLinkedAccount` une fois un compte lié dispo).
- **tsc** `--noEmit` vert sur l'ensemble.
- **Manuel** : `/admin/funnel` affiche le plan + le formulaire customer ID ; la page
  d'activation s'affiche sans bandeau ID.

## Fichiers touchés

| Fichier | Action |
|---|---|
| `app/api/eligibilite/launch/route.ts` | retire auto-création, notif reformulée |
| `app/lib/googleAds/campaign.ts` | + `createCampaignOnLinkedAccount` |
| `app/api/eligibilite/create-campaign/route.ts` | **nouveau** endpoint admin |
| `app/admin/funnel/page.tsx` | section workflow + fiche par lead |
| `app/admin/funnel/LeadAdsPanel.tsx` | **nouveau** composant client (plan + customer ID) |
| `app/eligibilite/activation/[id]/page.tsx` | page client générique (retire ID + polling) |
| `app/lib/googleAds/create.ts` | `target_search_network: false` |
| `app/lib/googleAds/campaign.test.ts` | **nouveau** tests unitaires |
