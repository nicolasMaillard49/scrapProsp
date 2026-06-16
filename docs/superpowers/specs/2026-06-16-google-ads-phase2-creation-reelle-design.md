# Spec — Google Ads Phase 2 (testable) : création réelle de compte + invitation + campagne PAUSED

**Date :** 2026-06-16
**Statut :** validé (brainstorm), à planifier
**Contexte :** suite de `2026-06-15-google-ads-auto-campagne-design.md` (Phase 1 dry-run livrée).

## Objectif

Permettre de **tester le vrai parcours** d'éligibilité de bout en bout jusqu'à la
réception de **l'email d'invitation envoyé par Google**, sans risque pour les vrais
prospects et sans aucune dépense publicitaire.

Au clic sur « Lancer ma campagne » (pour un lead autorisé) :

1. un **sous-compte Google Ads réel** est créé sous le MCC 671 ;
2. l'email du lead est **invité** sur ce compte → **Google envoie son email d'invitation** ;
3. la **campagne est créée en état PAUSED** (budget, ciblage, mots-clés, RSA, négatifs, call asset) ;
4. la **page d'activation** affiche le vrai ID de compte + « invitation envoyée à <email> ».

La campagne PAUSED **ne peut pas diffuser tant qu'aucune carte n'est ajoutée** → dépense nulle.

## Hors scope (non fait dans cette itération)

- Onboarding billing / détection automatique de la carte.
- Polling « on vérifie toutes les 10 s » + auto-dépause de la campagne.
- Activation/diffusion réelle de la campagne (reste PAUSED).
- Cron de surveillance budget (Phase 3).

## Décisions (issues du brainstorm)

| Sujet | Décision |
|---|---|
| Périmètre | Compte **+ invitation + campagne en PAUSE** (pas seulement l'invitation). |
| Déclenchement | **Bouton du funnel, gaté par allow-list** d'emails (`GOOGLE_ADS_REAL_EMAILS`). |
| Page activation | **Dynamique** : affiche le vrai ID + email d'invitation (façon Lokads). Pas de polling. |
| Invitation | Rôle **ADMIN** (à confirmer en plan — STANDARD possible). |

## Architecture

### Composants touchés / ajoutés

| Fichier | Rôle |
|---|---|
| `app/api/eligibilite/launch/route.ts` | **Modifié** : calcule `dryRun` depuis l'allow-list au lieu du défaut `true`. |
| `app/lib/googleAds/create.ts` | **Nouveau** : toutes les écritures Google Ads réelles (compte, invitation, campagne PAUSED). |
| `app/lib/googleAds/campaign.ts` | **Modifié** : la branche réelle délègue à `create.ts` (retire le `throw` Phase 2). |
| `app/lib/googleAds/client.ts` | **Inchangé** : `mccCustomer()` / `clientCustomer()` déjà disponibles. |
| `app/lib/googleAds/persistence.ts` | **Inchangé** : `recordAdsAccount` / `existingCustomerForLead` suffisent. |
| `app/eligibilite/activation/[id]/page.tsx` | **Modifié** : lit la ligne `google_ads_accounts` et affiche le vrai ID + email si présent. |

> Pas de nouvelle migration : l'email invité = `lead.email` (déjà en base), `status:'paused'`
> existe déjà dans l'enum `AdsStatus`, et `customer_id`/`campaign_id`/`budget_id` sont déjà des colonnes.

### Flux de déclenchement (`launch/route.ts`)

```
POST /api/eligibilite/launch { id }
  → lead = update status='launched'
  → allow = parseCsv(GOOGLE_ADS_REAL_EMAILS)   // emails en minuscules, trim
  → dryRun = !(lead.email && allow.includes(lead.email.toLowerCase()))
  → createCampaignForLead(lead, { dryRun })
```

- Allow-list **vide** ⇒ `dryRun=true` pour tout le monde (comportement actuel préservé).
- L'override `{ dryRun: false }` du body reste accepté (usage interne/script), mais le
  pilotage normal passe par l'allow-list.

### Création réelle (`create.ts::createReal(lead, plan)`)

Étapes, idempotentes autant que possible :

1. **Compte** — si `existingCustomerForLead(lead.id)` renvoie un `customer_id`, on le
   réutilise (pas de doublon). Sinon `mccCustomer().createCustomerClient({ customer_client:
   { descriptive_name: plan.params.accountName, currency_code: 'EUR', time_zone:
   'Europe/Paris' } })` → extrait le nouveau `customer_id` du `resource_name`.
2. **Invitation** — sur le compte enfant, mutate `customer_user_access_invitation`
   `{ email_address: lead.email, access_role: ADMIN }` → Google envoie l'email.
   (Si l'invitation existe déjà → on ignore l'erreur « déjà invité ».)
3. **Campagne PAUSED** sur le compte enfant (`clientCustomer(customer_id)`), via
   `mutateResources` (opérations liées par resource_name temporaires) :
   - `campaign_budget` (amount_micros = `plan.params.dailyBudgetMicros`, delivery STANDARD) ;
   - `campaign` (status **PAUSED**, advertising_channel_type SEARCH, `end_date`,
     `network_settings` Search seul, geo_target_type **PRESENCE**, bidding **MAXIMIZE_CLICKS**) ;
   - `campaign_criterion` : géo (proximité lat/lon+rayon **ou** ville) + langue FR (`languageConstants/1002`) ;
   - `ad_group` (status ENABLED) ;
   - `ad_group_criterion` : un keyword par `plan.keywords` ;
   - `ad_group_ad` : **RSA** depuis `plan.ad` (headlines + descriptions + `final_urls`) ;
   - négatifs : `campaign_criterion` negative keywords depuis `plan.negatives` ;
   - **call asset** (si `plan.callTracking.enabled`) : `asset` CallAsset (E.164) lié à la campagne.
4. **Persistance** : `recordAdsAccount({ lead_id, client_name, customer_id, campaign_id,
   budget_id, status:'paused', daily_budget, metier, ville, payload: plan })`.

`create.ts` n'est appelé que par `campaign.ts` (branche `dryRun=false`). Les warnings
bloquants du plan (pas de `finalUrl`, etc.) court-circuitent la création réelle avec un
message clair (la RSA exige une final URL).

### Page d'activation dynamique

`activation/[id]/page.tsx` lit la dernière ligne `google_ads_accounts` du lead :
- si `customer_id` non nul → encart en tête : **« Votre compte est créé · ID {customer formaté} »**
  + **« Google a envoyé une invitation à {lead.email} »** ; le tuto « ajouter votre carte »
  existant reste dessous.
- sinon → page statique actuelle inchangée (fallback dry-run / pré-lancement).

### Notifications & erreurs

- Succès réel → Telegram : `✅ Compte Google Ads créé — ID {id} — campagne PAUSED {nom}`.
- Échec → Telegram avec le message d'erreur ; **non bloquant** pour le lead (le lead reste
  `launched`, la page d'activation tombe sur le fallback statique). L'erreur est aussi
  persistée (`status:'error'`, `error`).

## Sûreté

- Allow-list par défaut vide → aucune création réelle non voulue.
- Campagne **PAUSED** + pas de carte → **dépense impossible**.
- ⚠️ Un sous-compte créé **ne se supprime pas via l'API** (fermeture manuelle dans l'UI
  Google Ads). L'invitation, elle, est annulable. À garder en tête pour le nettoyage des
  comptes de test.
- Idempotence compte (réutilisation `customer_id`) pour ne pas multiplier les sous-comptes
  si on reclique « Lancer ».

## Tests

- **Pur (auto)** : parsing de l'allow-list (`GOOGLE_ADS_REAL_EMAILS` → set d'emails normalisés,
  insensible à la casse/espaces, vide = aucun). Le mapping lead→params est déjà couvert.
- **Écritures Google** : non unit-testables de façon fiable → **validation e2e manuelle** :
  1. `GOOGLE_ADS_REAL_EMAILS=<ton email>` (local + Vercel prod) ;
  2. lead de test avec **ton** email (form démo ou seed) ;
  3. parcours funnel → clic « Lancer ma campagne » ;
  4. vérifs : sous-compte visible sous **MCC 671**, **email d'invitation Google reçu**,
     **campagne PAUSED** présente avec budget/keywords/RSA, ligne `google_ads_accounts`
     remplie (`customer_id`/`campaign_id`/`status='paused'`), page d'activation affiche le vrai ID.

## Variables d'environnement

| Variable | Rôle | Où |
|---|---|---|
| `GOOGLE_ADS_REAL_EMAILS` | CSV d'emails autorisés à déclencher la création réelle | `.env.local` + Vercel (Production) |
| `GOOGLE_ADS_*` (existants) | Credentials API (dev token, client id/secret, refresh, MCC) | déjà en `.env.local`, **à pousser sur Vercel** |

## Risques / points à valider en implémentation

- Forme exacte des opérations `mutateResources` avec `google-ads-api` v22 (resource names
  temporaires, enums). À caler contre la doc de la lib.
- Champ/ressource exacte pour l'invitation (`CustomerUserAccessInvitationService`) et la
  remontée de l'erreur « déjà invité ».
- Construction du **call asset** (Asset CallAsset + AssetSet/CampaignAsset) — la partie la
  plus susceptible de varier ; prévoir de la rendre optionnelle (n'échoue pas la création
  si le call asset plante).
