# Funnel — Campagnes en cours + chatbot Claude — Design

> Date : 2026-06-19
> Objectif : afficher dans la console funnel les campagnes Google Ads en cours
> avec leurs vrais détails (simplifiés), et permettre de poser des questions à
> Claude sur une campagne directement depuis le funnel (chatbot).

## Décisions validées

- **Source de données** : live API Google Ads (GAQL, read-only) avec fallback DB.
- **Chatbot** : snapshot en contexte (pas de tool-use), 1 appel, snapshot construit côté serveur.
- **Périmètre** : uniquement les campagnes tracées en base (`google_ads_accounts` avec `campaign_id`).
- **Fenêtre métriques** : 30 derniers jours + 7 derniers jours côte à côte.
- **Modèle chat** : `claude-sonnet-4-6` (configurable via `ANTHROPIC_CHAT_MODEL`). `haiku` reste pour la génération d'annonces.

## Composants

### 1. `app/lib/googleAds/report.ts` (nouveau, read-only)

Fonction principale :

```ts
export interface CampaignReport {
  live: boolean;                 // false = métriques live indisponibles, on a juste la config DB
  campaign: {
    id: string;
    name: string;
    status: string;              // ENABLED / PAUSED / REMOVED
    servingStatus: string;       // SERVING / NONE / PENDING / SUSPENDED…
    adApproval: string | null;   // résumé policy_summary de la RSA : APPROVED / UNDER_REVIEW / DISAPPROVED
    biddingStrategy: string;
    startDate: string | null;
    endDate: string | null;
  };
  budget: { dailyEur: number | null; spentEur30d: number };
  metrics30d: Metrics;
  metrics7d: Metrics;
  topKeywords: Array<{ text: string; matchType: string; qualityScore: number | null; clicks: number }>;
  warnings: string[];
}

interface Metrics {
  impressions: number; clicks: number; ctr: number; avgCpcEur: number;
  costEur: number; conversions: number; phoneCalls: number; costPerConvEur: number | null;
  searchBudgetLostIs: number | null;
}

export async function fetchCampaignReport(customerId: string, campaignId: string): Promise<CampaignReport>;
```

- Utilise `clientCustomer(customerId).query(gaql)` (login_customer_id = MCC déjà géré dans `client.ts`).
- Plusieurs requêtes GAQL :
  1. `FROM campaign` (identité, statut, serving_status, bidding, dates) — sans date pour l'état courant.
  2. `FROM campaign WHERE segments.date DURING LAST_30_DAYS` agrégé → metrics30d (et LAST_7_DAYS → metrics7d).
  3. `FROM campaign_budget` → budget journalier.
  4. `FROM ad_group_ad` (policy_summary.approval_status) → adApproval.
  5. `FROM keyword_view ... ORDER BY metrics.clicks DESC LIMIT 5` → topKeywords + quality_score.
- Conversion `micros / 1_000_000` pour euros. Helpers purs séparés et testables.
- En cas d'erreur API (creds, quota, campagne sans données) : `live: false`, warnings remplis, metrics à zéro — l'appelant complète avec la config DB.

### 2. Section « Campagnes en cours » — `app/admin/funnel/page.tsx`

- Nouvelle `<section>` après le workflow Google Ads.
- Source : requête Supabase `google_ads_accounts` où `campaign_id IS NOT NULL` (dernier record par lead), join sur `eligibilite_leads` pour le label.
- Chaque carte (composant `CampaignCard`) : nom client/métier/ville, badge statut diffusion, KPIs compacts (dépense 7j, clics, appels), bouton « Détails » → `/admin/funnel/campagne/[id]` (id = id du record `google_ads_accounts`).
- KPIs de la carte chargés via le report (Server Component) — fallback DB si `live:false`.

### 3. Page détail — `app/admin/funnel/campagne/[id]/page.tsx`

- Server Component : charge le record DB (customer_id, campaign_id, plan) + `fetchCampaignReport`.
- Layout 2 colonnes (responsive 1 colonne mobile) :
  - **Gauche** : blocs simplifiés — statut diffusion + approbation annonce, KPI cards (30j vs 7j), budget/dépense, top mots-clés + Quality Score, aperçu de l'annonce RSA (titres/descriptions du plan).
  - **Droite** : panneau chat (`CampaignChat`, client component).
- Bannière d'avertissement si `live:false` (« métriques live indisponibles — config affichée depuis la base »).

### 4. Chatbot — API + UI

**API** `app/api/funnel/campagne/[id]/chat/route.ts` (POST) :
- Body : `{ messages: {role, content}[] }`.
- Reconstruit le snapshot côté serveur : `fetchCampaignReport` + plan DB → `buildCampaignSystemPrompt(snapshot)` (pure, FR) qui résume toutes les données chiffrées.
- Appelle Anthropic (`ANTHROPIC_CHAT_MODEL` ?? `claude-sonnet-4-6`) en streaming, system = prompt snapshot, messages = historique.
- Réponse streamée (text/event-stream ou ReadableStream). Garde-fou : si pas de clé Anthropic → 503 message clair.
- Auth : même protection que le reste de `/admin` (le funnel est déjà derrière l'admin).

**UI** `CampaignChat.tsx` (client) :
- Liste de messages + textarea. Suggestions de questions par défaut (« Pourquoi peu d'appels ? », « Mon budget est-il bien dépensé ? », « Que changer pour avoir plus de clients ? »).
- Fetch streaming vers l'API, rendu incrémental.

## Flux de données

```
funnel page (RSC) ──select DB──> campagnes tracées
   └─ CampaignCard (RSC) ──fetchCampaignReport──> KPIs compacts
page détail (RSC) ──fetchCampaignReport + plan DB──> blocs détaillés
   └─ CampaignChat (client) ──POST /chat──> API ──snapshot+Anthropic──> stream réponse
```

## Gestion d'erreurs

- API Google Ads down/quota → `live:false`, on affiche la config DB + bannière. Le chat fonctionne avec le snapshot partiel.
- Pas de clé Anthropic → chat renvoie 503 lisible ; le reste de la page marche.
- `customer_id`/`campaign_id` manquants en base → la campagne n'apparaît pas dans la liste (filtre `campaign_id IS NOT NULL`).

## Tests

- `report.test.ts` : helpers purs (micros→€, normalisation des lignes GAQL en `Metrics`, parsing policy_summary). Réseau mocké.
- `chatPrompt.test.ts` : `buildCampaignSystemPrompt` produit un prompt contenant les KPIs clés et reste robuste si `live:false`.

## Hors périmètre (YAGNI)

- Pas de tool-use agentique (le chat ne modifie rien, ne requête pas l'API à la demande).
- Pas de scan de tout le MCC (uniquement campagnes du funnel).
- Pas de graphiques temporels (KPI chiffrés suffisent en V1).
