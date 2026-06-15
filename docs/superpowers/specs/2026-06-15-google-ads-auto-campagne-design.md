# Spec — Création automatique de campagne Google Ads depuis le funnel d'éligibilité

**Date** : 2026-06-15
**Statut** : design validé, prêt pour plan d'implémentation
**Skill de référence** : `google-ads-artisans` (modes API/automation + création)

## 1. Contexte & objectif

Le funnel d'éligibilité (`eligibilite_leads`) collecte tout le nécessaire pour
monter une campagne Google Ads : `metier`, `ville`, `lat/lon`, `radius_km`,
`site_url`, `service_cible`, `budget_daily`, `phone`. Aujourd'hui le clic
« Lancer ma campagne » (`POST /api/eligibilite/launch`) se contente de passer le
lead en `status=launched` + email + Telegram. **Aucune campagne n'est créée.**

**Objectif** : à l'activation, créer **automatiquement** (via l'API Google Ads)
un compte client sous le MCC NMF et une campagne Search complète, **en PAUSE**,
prête à être validée. Commencer par un **dry-run** qui logge tout le payload sans
rien créer.

**Modèle commercial (important)** : la « semaine test » est **gratuite côté services
NMF** (gestion offerte), mais **le client finance lui-même sa campagne** : c'est **sa
carte** qui paie Google pour les clics. NMF n'avance pas la dépense pub.

**Conséquence — billing client (non automatisable)** : le compte est géré sous le MCC 671,
mais le **moyen de paiement est celui du client**. L'API Google Ads **ne permet pas
d'ajouter une carte** (action manuelle de l'utilisateur dans l'UI Google, par sécurité).

**On part de l'email** (déjà collecté dans le funnel) — **aucune question en plus**.
Limite API à connaître : **il n'existe aucun moyen de chercher un compte Google Ads par
email** (`listAccessibleCustomers` ne liste que nos comptes accessibles). On ne peut donc
**pas détecter** programmatiquement si le prospect a déjà un compte — et ce n'est pas
nécessaire.

**Flux unique (par défaut)** :
1. **Auto** : on **crée un sous-compte** sous le MCC 671 (`createCustomerClient`, auto-linké)
   + campagne en **PAUSE**.
2. **Auto** : on **invite l'email du client** comme utilisateur sur ce compte.
3. **Client** : il se connecte **avec son email**, **ajoute sa carte** (obligatoire, non
   automatisable par l'API), accepte.
4. **Activation** : CB validée → dé-pause de la campagne.

Que l'email gère déjà d'autres comptes Ads ou non n'a aucune importance : il accède au
compte qu'on a créé. La campagne ne diffuse pas tant que la CB n'est pas réglée.

**Cas manuel exceptionnel** (hors automatisation) : un client qui *insiste* pour réutiliser
son compte existant nous fournit son **customer ID** → liaison manager (`CustomerManagerLink`)
gérée à la main. Non couvert par le flux auto (l'email seul ne suffit pas à l'API).

**Hors scope (volontairement)** :
- Saisie de la CB (action **client**, dans l'UI Google — non automatisable par l'API).
- Call tracking « appels depuis le site » (nécessite du JS sur le site du prospect).
- Structure multi-ad-groups (on part sur **1 seul ad group** ciblé `service_cible`).
- Stratégie d'enchères avancée (Maximize Conversions / CPA) — voir §9, décidé plus tard.

## 2. Compte & authentification

- **Modèle** : sous-comptes clients créés sous le **MCC 671 `6711813801`**
  (« NMF Agence », manager EUR/Europe-Paris). Un client = un compte = une campagne.
- **Dev token** porté par le MCC 781, mais on **opère via le 671** :
  `login_customer_id = 6711813801`. Combinaison vérifiée OK via API **v22** le 2026-06-15.
- **Lib** : `google-ads-api` (npm). Variables déjà dans `.env.local` :
  `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
  `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_MCC_ID=6711813801`.
- À pousser sur **Vercel (prod)** avant le go live réel.

## 3. Architecture des modules

Tout sous `app/lib/googleAds/` (unités focalisées, testables isolément) :

| Fichier | Rôle | Dépend de |
|---|---|---|
| `client.ts` | Construit le client `GoogleAdsApi` + factory `customer(customerId)` (login_customer_id = MCC). Lit l'env. | env |
| `mapping.ts` | `leadToCampaignParams(lead)` : lead → params normalisés (nom campagne, budget micros, géo, téléphone E.164, end_date J+7). **Pur, sans I/O** → cœur du dry-run. | — |
| `copy.ts` | `generateKeywords()` + `generateRsa()` via Claude (même pattern que `eligibilite.ts`), avec fallback rule-based. | Anthropic |
| `negatives.ts` | Listes de mots-clés négatifs (universelle artisan + par métier). Constantes statiques. | — |
| `campaign.ts` | Orchestration `createCampaignForLead(lead, { dryRun })` : enchaîne les étapes §5. | tous les autres |
| `persistence.ts` | Lecture/écriture table `google_ads_accounts` (suivi customer_id/campaign_id/statut). | supabaseAdmin |

Point d'entrée : `POST /api/eligibilite/launch` appelle `createCampaignForLead`.

## 4. Mapping lead → campagne (cœur testable)

`leadToCampaignParams(lead)` produit un objet **inspectable** (c'est ce que le
dry-run loggue) :

| Champ campagne | Source lead | Transformation |
|---|---|---|
| `accountName` | `metier` + `ville` (+ `first_name`/`last_name`) | `"{Métier} {Ville} — {Prénom Nom}"` |
| `campaignName` | `metier` + `ville` | `"{Métier} {Ville} — test {date}"` |
| `dailyBudgetMicros` | `budget_daily` | `budget_daily × 1_000_000` (fallback `estimate()` si null) |
| `endDate` | `now` | J+7 (`YYYYMMDD`) → coupe auto |
| `geoPoint + radius` | `lat`, `lon`, `radius_km` | proximité : lat/lon ×1e6 (micro-degrés), rayon en KM (fallback : ciblage ville par nom si lat/lon manquants) |
| `language` | — | Français (constante criteria `1002`) |
| `finalUrl` | `site_url` | normalisé (https://, fallback : pas de campagne si absent → erreur explicite) |
| `callPhone` | `phone` | E.164 FR (`+33…`) |
| `serviceCible` | `service_cible` | alimente keywords + RSA |

## 5. Étapes de création (orchestration `campaign.ts`)

Toutes en mode réel ; en dry-run chaque étape **loggue le payload** et n'appelle pas l'API.

1. **Compte client** — `mutateCustomers` sous le MCC 671 → `customerId`.
   *(Idempotence : si le lead a déjà un `customer_id` en base, on le réutilise.)*
2. **Call tracking (compte)** — activer le call reporting
   (`conversion_tracking_setting`) + créer une **ConversionAction** type appel
   (`AD_CALL`), durée mini **30 s**, valeur par défaut paramétrable.
3. **Budget** — `campaignBudgets.create` : `amount_micros = dailyBudgetMicros`, `STANDARD`.
4. **Campagne** — `campaigns.create` :
   - `status: PAUSED`, `advertising_channel_type: SEARCH`
   - `network_settings` : search ON, partenaires OFF, **Display OFF**
   - `geo_target_type_setting.positive_geo_target_type: PRESENCE`
   - `end_date` = J+7
   - enchères provisoires : **Maximize Clicks** avec plafond CPC (voir §9)
5. **Ciblage géo** — `campaignCriteria` : proximité (geo point + rayon) **ou** localisation ville ; + langue FR.
6. **Ad group** — un seul, nommé d'après `service_cible`.
7. **Mots-clés** — `generateKeywords()` (Claude → variations `service_cible` + `ville`),
   en match **phrase** + **exact** (jamais broad sans négatifs solides).
8. **Négatifs J1** — liste universelle artisan + spécifique métier (`negatives.ts`).
9. **RSA** — `generateRsa()` (Claude → ~12-15 titres / ~4 descriptions) + chemins d'URL.
10. **Call asset** — `CallAsset` (téléphone E.164) attaché à la campagne, conversion tracking activé.
11. **Persistance** — upsert `google_ads_accounts` (customer_id, campaign_id, statut, budget, métier, ville) + `customer_id`/`campaign_id` mémorisés sur le lead.

## 6. Garde-fous budget (« ne jamais dépasser »)

Le budget Google est **journalier** : jusqu'à **2× le jour**, mais ≤ `daily × 30,4`
le mois. Pas de plafond total natif sur une campagne Search standard. **3 garde-fous** :

1. **Budget journalier** = `budget_daily` (cohérent par construction).
2. **`end_date` = J+7** sur la campagne → extinction automatique.
3. **Cron de surveillance** (réutilise l'infra cron existante Vercel/VPS) : interroge
   le **coût cumulé** de la campagne via l'API ; dès que `cost ≥ cap` (= `budget_daily × 7`),
   passe la campagne en **PAUSED**. Seule vraie garantie de cap strict.

Le cron de surveillance peut être livré en **phase 2** (la campagne naît en PAUSE de
toute façon ; le cap dur n'est requis qu'une fois activée).

## 7. Données & persistance

Nouvelle table (migration `supabase/migration-012-google-ads.sql`) — calquée sur le
modèle du skill :

```sql
CREATE TABLE google_ads_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid REFERENCES eligibilite_leads(id) ON DELETE SET NULL,
  client_name  text NOT NULL,
  customer_id  text,            -- compte client créé sous le MCC 671
  mcc_id       text NOT NULL DEFAULT '6711813801',
  campaign_id  text,
  budget_id    text,
  status       text DEFAULT 'pending', -- pending | dry_run | paused | active | capped | error
  daily_budget integer,         -- €/jour
  metier       text,
  ville        text,
  payload      jsonb,           -- dump du dry-run (mapping + keywords + RSA)
  error        text,
  created_at   timestamptz DEFAULT now(),
  activated_at timestamptz
);
```

En dry-run : on écrit une ligne `status='dry_run'` avec `payload` complet, sans
`customer_id`/`campaign_id`.

## 8. Gestion d'erreurs

- **Dry-run** : aucune écriture côté Google ; ne peut pas casser un compte.
- **Mode réel** : chaque étape try/catch ; en cas d'échec → `status='error'` + `error`
  en base + alerte **Telegram** (`sendTelegram`) ; ce qui a été créé reste mémorisé
  (idempotence sur `customer_id`) pour reprise.
- Erreurs API connues mappées (cf. skill) : `CUSTOMER_NOT_FOUND` (tirets),
  `USER_PERMISSION_DENIED` (accès MCC), `AUTHORIZATION_ERROR` (refresh token),
  `QUOTA_ERROR` (>15k ops/j Basic).
- **Garde-fous d'entrée** : si `site_url` absent → pas de campagne (erreur explicite,
  final URL obligatoire). Si `lat/lon` absents → fallback ciblage ville par nom.

## 9. Stratégie d'enchères (provisoire)

Décision finale reportée. Pour qu'une campagne soit **valide**, on pose un défaut :
**Maximize Clicks avec CPC max plafonné** (recommandé par le skill quand il n'y a pas
encore d'historique de conversion). Passage à Maximize Conversions une fois le call
tracking alimenté (≥ 30 conversions). Le choix est **isolé dans `mapping.ts`** pour
être changé sans toucher au reste.

## 10. Tests & validation

- **Test de mapping** (pur, sans réseau) : `leadToCampaignParams` sur le **lead de
  test** (`token testqp4mac`, plombier Tours, débouchage urgence, 25 €/j) → snapshot
  du payload attendu (nom, budget micros = 25_000_000, end_date, géo, E.164).
- **Dry-run e2e** : `createCampaignForLead(lead, { dryRun: true })` → loggue le payload
  complet (compte, budget, campagne, géo, ad group, keywords, négatifs, RSA, call asset)
  + écrit la ligne `dry_run`. Vérifié manuellement avant toute création réelle.
- **1ère création réelle** : sur un compte de test, campagne en PAUSE, inspection dans
  l'UI Google Ads avant d'ouvrir au vrai trafic.

## 11. Séquencement proposé

1. **Phase 1 (dry-run)** : `client.ts`, `mapping.ts`, `negatives.ts`, `copy.ts`,
   migration table, `campaign.ts` en dry-run, branchement `launch` derrière un flag,
   test de mapping. → **Livrable testable sans risque.**
2. **Phase 2 (création réelle)** : activer les appels API étape par étape sur un compte
   de test (compte → budget → campagne → ciblage → ad group → keywords → négatifs → RSA
   → call tracking → call asset).
3. **Phase 3 (cap & exploitation)** : cron de surveillance budget + écran admin leads.
