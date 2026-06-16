# Google Ads Phase 2 (testable) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Au clic « Lancer ma campagne » pour un lead autorisé (allow-list), créer un vrai sous-compte Google Ads sous le MCC 671, inviter l'email du lead (→ email d'invitation Google reçu), créer la campagne en PAUSED, et afficher le vrai ID de compte sur la page d'activation.

**Architecture:** Une fonction pure `isRealAllowed` décide dry-run vs réel depuis `GOOGLE_ADS_REAL_EMAILS`. Les écritures Google sont isolées dans un nouveau module `app/lib/googleAds/create.ts` (création compte + invitation + campagne PAUSED via `mutateResources`). `campaign.ts` orchestre (dry-run inchangé, branche réelle déléguée). La page d'activation lit `google_ads_accounts` pour afficher le vrai ID.

**Tech Stack:** Next.js 15 App Router, TypeScript, `google-ads-api` v24 (API Google Ads v22), Supabase (`supabaseAdmin`), `node:test` + `tsx` pour les tests purs.

**Référence spec :** `docs/superpowers/specs/2026-06-16-google-ads-phase2-creation-reelle-design.md`

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `app/lib/googleAds/allowlist.ts` | **Nouveau** — parsing + test de l'allow-list (pur, sans I/O). |
| `app/lib/googleAds/allowlist.test.ts` | **Nouveau** — tests `node:test`. |
| `app/lib/googleAds/create.ts` | **Nouveau** — écritures réelles : compte, invitation, campagne PAUSED. |
| `app/lib/googleAds/campaign.ts` | **Modifié** — branche réelle déléguée à `create.ts` ; `CreateResult` enrichi. |
| `app/api/eligibilite/launch/route.ts` | **Modifié** — `dryRun` calculé via allow-list ; notif Telegram réel. |
| `app/eligibilite/activation/[id]/page.tsx` | **Modifié** — affiche le vrai ID + email d'invitation si compte créé. |

---

## Task 1: Allow-list (fonction pure, TDD)

**Files:**
- Create: `app/lib/googleAds/allowlist.ts`
- Test: `app/lib/googleAds/allowlist.test.ts`

- [ ] **Step 1: Write the failing test**

`app/lib/googleAds/allowlist.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAllowlist, isRealAllowed } from "./allowlist.ts";

test("parseAllowlist: vide => set vide", () => {
  assert.equal(parseAllowlist("").size, 0);
  assert.equal(parseAllowlist(undefined).size, 0);
  assert.equal(parseAllowlist(null).size, 0);
});

test("parseAllowlist: normalise casse + espaces, ignore vides", () => {
  const s = parseAllowlist(" A@B.com , c@d.fr ,, ");
  assert.deepEqual([...s].sort(), ["a@b.com", "c@d.fr"]);
});

test("isRealAllowed: match insensible à la casse", () => {
  assert.equal(isRealAllowed("Nico@Test.fr", "nico@test.fr"), true);
  assert.equal(isRealAllowed("autre@x.fr", "nico@test.fr"), false);
  assert.equal(isRealAllowed(null, "nico@test.fr"), false);
  assert.equal(isRealAllowed("nico@test.fr", ""), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test app/lib/googleAds/allowlist.test.ts`
Expected: FAIL (`Cannot find module './allowlist.ts'` ou export manquant).

- [ ] **Step 3: Write minimal implementation**

`app/lib/googleAds/allowlist.ts` :

```ts
/**
 * Allow-list des emails autorisés à déclencher la CRÉATION RÉELLE d'une campagne
 * (sinon dry-run). Source = env GOOGLE_ADS_REAL_EMAILS (CSV). Vide = personne.
 * Fonctions PURES (aucune I/O) pour être testables.
 */
export function parseAllowlist(csv: string | undefined | null): Set<string> {
  return new Set(
    (csv || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isRealAllowed(
  email: string | null | undefined,
  csv: string | undefined | null = process.env.GOOGLE_ADS_REAL_EMAILS,
): boolean {
  if (!email) return false;
  return parseAllowlist(csv).has(email.trim().toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test app/lib/googleAds/allowlist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/googleAds/allowlist.ts app/lib/googleAds/allowlist.test.ts
git commit -m "feat(google-ads): allow-list emails pour declenchement reel (pur + tests)"
```

---

## Task 2: Gate allow-list dans la route launch

**Files:**
- Modify: `app/api/eligibilite/launch/route.ts`

Contexte actuel (lignes ~17-34) : `b` est parsé, puis `const dryRun = b.dryRun !== false;` est calculé **avant** de connaître le lead, puis le lead est récupéré par l'`update`. On déplace le calcul de `dryRun` **après** la récupération du lead pour utiliser `lead.email`.

- [ ] **Step 1: Ajouter l'import**

En tête de `app/api/eligibilite/launch/route.ts`, après les autres imports `googleAds` :

```ts
import { isRealAllowed } from "@/app/lib/googleAds/allowlist";
```

- [ ] **Step 2: Supprimer le calcul anticipé de dryRun**

Supprimer ces 3 lignes (juste après le `if (!b.id) ...`) :

```ts
  // Sécurité : tant que la création réelle (Phase 2) n'est pas validée, on reste
  // en dry-run sauf override explicite { dryRun: false }.
  const dryRun = b.dryRun !== false;
```

- [ ] **Step 3: Calculer dryRun après l'obtention du lead**

Juste après le bloc qui définit `lead` (après `if (error || !lead) return ...`), insérer :

```ts
  // Mode réel UNIQUEMENT si l'email du lead est dans l'allow-list
  // (GOOGLE_ADS_REAL_EMAILS), ou override interne explicite { dryRun:false }.
  const dryRun = b.dryRun === false ? false : !isRealAllowed(lead.email);
```

- [ ] **Step 4: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: `No errors found` (la branche réelle de `createCampaignForLead` lève encore une erreur Phase 2, c'est attendu jusqu'à la Task 5 ; l'erreur est déjà attrapée par le `try/catch` existant de la route).

- [ ] **Step 5: Commit**

```bash
git add app/api/eligibilite/launch/route.ts
git commit -m "feat(google-ads): launch — dry-run pilote par l'allow-list email"
```

---

## Task 3: Module `create.ts` — compte réel + invitation

**Files:**
- Create: `app/lib/googleAds/create.ts`

But : créer (ou réutiliser) le sous-compte sous le MCC, puis inviter l'email du lead. C'est l'étape qui déclenche **l'email d'invitation Google**.

- [ ] **Step 1: Vérifier les signatures de la lib (lecture seule)**

Les écritures dépendent de l'API exacte de `google-ads-api` v24. Avant d'écrire, confirmer 2 points dans les types installés :

Run: `npx tsc --noEmit` (sanity) puis lire les définitions :
- `node_modules/google-ads-api/build/src/customer.d.ts` → confirmer la présence de `createCustomerClient(...)` et `mutateResources(...)`.
- `node_modules/google-ads-api/build/protos/...` ou l'export `enums` → confirmer `enums.AccessRole.ADMIN`.

Recherche rapide :
```bash
grep -rn "createCustomerClient" node_modules/google-ads-api/build/src/customer.d.ts
grep -rn "customerUserAccessInvitations" node_modules/google-ads-api/build/src/ | head
```
Note attendue : `createCustomerClient(customerClient, options?)` renvoie un objet avec `resource_name`. Les services pluralisés (`customer.customerUserAccessInvitations.create([...])`) existent. **Si une signature diffère, adapter le code des steps suivants en conséquence — ne pas inventer.**

- [ ] **Step 2: Écrire `create.ts` (compte + invitation)**

`app/lib/googleAds/create.ts` :

```ts
/**
 * Écritures RÉELLES Google Ads (Phase 2). Isolé de campaign.ts pour rester lisible.
 * - createOrReuseAccount : sous-compte sous le MCC 671 (idempotent par lead).
 * - inviteUser : invite l'email du lead -> Google envoie son email d'invitation.
 * - createPausedCampaign : campagne PAUSED (Task 4).
 */
import { enums } from "google-ads-api";
import { mccCustomer, clientCustomer } from "./client";
import { existingCustomerForLead } from "./persistence";
import type { CampaignPlan } from "./campaign";

/** Extrait le dernier groupe de chiffres d'un resource_name (= customer_id créé). */
function lastNumericId(resourceName: string | undefined): string | null {
  const ids = (resourceName || "").match(/\d+/g);
  return ids && ids.length ? ids[ids.length - 1] : null;
}

/** Crée le sous-compte (ou réutilise l'existant pour ce lead). Renvoie le customer_id (sans tirets). */
export async function createOrReuseAccount(leadId: string, accountName: string): Promise<string> {
  const existing = await existingCustomerForLead(leadId);
  if (existing) return existing.replace(/-/g, "");

  const res = await mccCustomer().createCustomerClient({
    descriptive_name: accountName,
    currency_code: "EUR",
    time_zone: "Europe/Paris",
  });
  const customerId = lastNumericId((res as { resource_name?: string }).resource_name);
  if (!customerId) {
    throw new Error(`createCustomerClient: resource_name inattendu (${JSON.stringify(res)})`);
  }
  return customerId;
}

/** Invite l'email sur le compte client (rôle ADMIN). true = invitation envoyée, false = déjà invité/membre. */
export async function inviteUser(customerId: string, email: string): Promise<boolean> {
  try {
    await clientCustomer(customerId).customerUserAccessInvitations.create([
      { email_address: email, access_role: enums.AccessRole.ADMIN },
    ]);
    return true;
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/already|exist|pending|duplicate/i.test(msg)) return false; // déjà invité : non bloquant
    throw e;
  }
}
```

- [ ] **Step 3: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: `No errors found`. Si erreur de type sur `createCustomerClient`/`customerUserAccessInvitations`, ajuster selon les signatures lues au Step 1 (ex. cast `as any` localisé documenté par un commentaire si la lib est mal typée — mais privilégier la signature réelle).

- [ ] **Step 4: Commit**

```bash
git add app/lib/googleAds/create.ts
git commit -m "feat(google-ads): create.ts — sous-compte reel + invitation email"
```

---

## Task 4: `create.ts` — campagne PAUSED

**Files:**
- Modify: `app/lib/googleAds/create.ts`

Ajoute la création de la campagne **PAUSED** via une seule transaction `mutateResources` (opérations liées par resource_names temporaires négatifs).

- [ ] **Step 1: Ajouter les helpers de resource_name temporaires + l'import ResourceNames**

En tête de `create.ts`, compléter l'import :

```ts
import { enums, ResourceNames } from "google-ads-api";
```

- [ ] **Step 2: Écrire `createPausedCampaign`**

Append à `app/lib/googleAds/create.ts` :

```ts
export interface CampaignIds {
  campaignId: string;
  budgetId: string;
  warnings: string[];
}

/** Crée budget + campagne PAUSED + ad group + keywords + RSA + négatifs + géo/langue. */
export async function createPausedCampaign(customerId: string, plan: CampaignPlan): Promise<CampaignIds> {
  const cust = clientCustomer(customerId);
  const warnings: string[] = [];

  const budgetRN = ResourceNames.campaignBudget(customerId, "-1");
  const campaignRN = ResourceNames.campaign(customerId, "-2");
  const adGroupRN = ResourceNames.adGroup(customerId, "-3");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];

  ops.push({
    entity: "campaign_budget",
    operation: "create",
    resource: {
      resource_name: budgetRN,
      name: `${plan.params.campaignName} — budget`.slice(0, 250),
      amount_micros: plan.params.dailyBudgetMicros,
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
      explicitly_shared: false,
    },
  });

  ops.push({
    entity: "campaign",
    operation: "create",
    resource: {
      resource_name: campaignRN,
      name: plan.params.campaignName,
      status: enums.CampaignStatus.PAUSED,
      advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
      campaign_budget: budgetRN,
      end_date: plan.params.endDate,
      network_settings: {
        target_google_search: true,
        target_search_network: true,
        target_content_network: false,
        target_partner_search_network: false,
      },
      geo_target_type_setting: {
        positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
        negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
      },
      // Maximize Clicks sans plafond CPC (cpcCeilingMicros=0 -> objet vide).
      maximize_clicks: plan.params.cpcCeilingMicros > 0
        ? { cpc_bid_ceiling_micros: plan.params.cpcCeilingMicros }
        : {},
    },
  });

  ops.push({
    entity: "ad_group",
    operation: "create",
    resource: {
      resource_name: adGroupRN,
      name: plan.params.adGroupName,
      campaign: campaignRN,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  });

  for (const kw of plan.keywords) {
    ops.push({
      entity: "ad_group_criterion",
      operation: "create",
      resource: {
        ad_group: adGroupRN,
        status: enums.AdGroupCriterionStatus.ENABLED,
        keyword: { text: kw.text, match_type: enums.KeywordMatchType[kw.match] },
      },
    });
  }

  ops.push({
    entity: "ad_group_ad",
    operation: "create",
    resource: {
      ad_group: adGroupRN,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [plan.params.finalUrl],
        responsive_search_ad: {
          headlines: plan.ad.headlines.map((t) => ({ text: t })),
          descriptions: plan.ad.descriptions.map((t) => ({ text: t })),
          ...(plan.ad.path1 ? { path1: plan.ad.path1 } : {}),
          ...(plan.ad.path2 ? { path2: plan.ad.path2 } : {}),
        },
      },
    },
  });

  for (const neg of plan.negatives) {
    ops.push({
      entity: "campaign_criterion",
      operation: "create",
      resource: {
        campaign: campaignRN,
        negative: true,
        keyword: { text: neg, match_type: enums.KeywordMatchType.PHRASE },
      },
    });
  }

  // Géo : proximité si lat/lon, sinon on n'ajoute pas de critère (ville seule = besoin
  // d'un geo_target_constant non résolu ici) et on avertit.
  if (plan.params.geo.kind === "proximity") {
    ops.push({
      entity: "campaign_criterion",
      operation: "create",
      resource: {
        campaign: campaignRN,
        proximity: {
          geo_point: {
            latitude_in_micro_degrees: plan.params.geo.latMicro,
            longitude_in_micro_degrees: plan.params.geo.lonMicro,
          },
          radius: plan.params.geo.radiusKm,
          radius_units: enums.ProximityRadiusUnits.KILOMETERS,
        },
      },
    });
  } else {
    warnings.push("Pas de lat/lon : campagne PAUSED créée SANS ciblage géo (à cibler à la main).");
  }

  ops.push({
    entity: "campaign_criterion",
    operation: "create",
    resource: { campaign: campaignRN, language: { language_constant: plan.params.languageConstant } },
  });

  const result = await cust.mutateResources(ops);
  const results = (result as { mutate_operation_responses?: Array<Record<string, { resource_name?: string }>> })
    .mutate_operation_responses ?? [];
  const find = (key: string) =>
    lastNumericId(results.map((r) => r[key]?.resource_name).find(Boolean) as string | undefined) ?? "";

  return { campaignId: find("campaign_result"), budgetId: find("campaign_budget_result"), warnings };
}
```

> Note : la forme exacte de `mutate_operation_responses` (clés `campaign_result`, `campaign_budget_result`) est à confirmer au runtime du smoke-test (Task 7). `find` est tolérant (renvoie "" si introuvable) — les ID ne sont pas critiques pour le test, le compte + invitation + campagne visible le sont.

- [ ] **Step 3: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 4: Commit**

```bash
git add app/lib/googleAds/create.ts
git commit -m "feat(google-ads): create.ts — campagne PAUSED (budget/geo/keywords/RSA/negatifs)"
```

---

## Task 5: Brancher la branche réelle dans `campaign.ts`

**Files:**
- Modify: `app/lib/googleAds/campaign.ts`
- Modify: `app/api/eligibilite/launch/route.ts` (notif Telegram réel)

- [ ] **Step 1: Enrichir `CreateResult`**

Dans `app/lib/googleAds/campaign.ts`, modifier l'interface `CreateResult` :

```ts
export interface CreateResult {
  ok: boolean;
  dryRun: boolean;
  plan: CampaignPlan;
  recordId: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  error?: string;
}
```

- [ ] **Step 2: Ajouter l'import de `create.ts`**

En tête de `campaign.ts`, après les imports existants :

```ts
import { createOrReuseAccount, inviteUser, createPausedCampaign } from "./create";
```

- [ ] **Step 3: Remplacer la branche réelle (le `throw`)**

Dans `createCampaignForLead`, remplacer tout le bloc après le commentaire `// ── Mode réel — Phase 2 (non activé) ───` (le `if (!googleAdsConfigured()) ...` + le `throw new Error(...)`) par :

```ts
  // ── Mode réel — Phase 2 ─────────────────────────────────────────────────────
  if (!googleAdsConfigured()) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "Credentials Google Ads incomplets." };
  }
  // La RSA exige une final URL : on refuse de créer sans elle.
  if (!plan.params.finalUrl) {
    return { ok: false, dryRun: false, plan, recordId: null, error: "site_url manquant : final URL obligatoire." };
  }

  try {
    const customerId = await createOrReuseAccount(lead.id, plan.params.accountName);
    let invited = false;
    if ((lead as { email?: string }).email) {
      invited = await inviteUser(customerId, (lead as { email?: string }).email as string);
    }
    const camp = await createPausedCampaign(customerId, plan);

    const recordId = await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      customer_id: customerId,
      mcc_id: plan.mccId,
      campaign_id: camp.campaignId || null,
      budget_id: camp.budgetId || null,
      status: "paused",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: { plan, invited, warnings: [...plan.warnings, ...camp.warnings] },
    });

    return { ok: true, dryRun: false, plan, recordId, customerId, campaignId: camp.campaignId || null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await recordAdsAccount({
      lead_id: lead.id,
      client_name: plan.params.accountName,
      mcc_id: plan.mccId,
      status: "error",
      daily_budget: Math.round(plan.params.dailyBudgetMicros / 1_000_000),
      metier: plan.params.metier,
      ville: plan.params.ville,
      payload: plan,
      error,
    });
    return { ok: false, dryRun: false, plan, recordId: null, error };
  }
```

- [ ] **Step 4: Notif Telegram pour le mode réel (route launch)**

Dans `app/api/eligibilite/launch/route.ts`, dans le bloc `try` après `createCampaignForLead`, le code actuel notifie seulement `if (res.dryRun)`. Ajouter un `else` pour le réel. Remplacer :

```ts
    ads = { ok: res.ok, dryRun: res.dryRun, recordId: res.recordId, warnings: res.plan.warnings };
    if (res.dryRun) {
```

par :

```ts
    ads = { ok: res.ok, dryRun: res.dryRun, recordId: res.recordId, warnings: res.plan.warnings };
    if (!res.dryRun) {
      await sendTelegram(
        res.ok
          ? `✅ Compte Google Ads RÉEL créé — ID ${res.customerId} — campagne PAUSED « ${res.plan.params.campaignName} » — invitation envoyée à ${lead.email || "?"}`
          : `❌ Création Google Ads réelle échouée — ${res.error || "erreur inconnue"}`,
      );
    } else if (res.dryRun) {
```

(Le reste du bloc dry-run existant est conservé tel quel.)

- [ ] **Step 5: Vérifier le typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: `No errors found` puis build Next.js OK.

- [ ] **Step 6: Commit**

```bash
git add app/lib/googleAds/campaign.ts app/api/eligibilite/launch/route.ts
git commit -m "feat(google-ads): branche la creation reelle (compte+invitation+campagne PAUSED) + notif"
```

---

## Task 6: Page d'activation dynamique

**Files:**
- Modify: `app/eligibilite/activation/[id]/page.tsx`

Afficher un bandeau « compte créé · ID … » + « invitation envoyée à … » quand un compte réel existe pour le lead.

- [ ] **Step 1: Lire le compte créé dans le composant serveur**

Dans `ActivationPage`, après la récupération de `lead` (juste avant `const cap = ...`), ajouter une requête sur `google_ads_accounts` :

```ts
  const { data: adsAccount } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id, status")
    .eq("lead_id", id)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```

- [ ] **Step 2: Ajouter le formatage d'ID et le bandeau**

Ajouter ce helper en bas du fichier (près de `Centered`) :

```ts
/** 6711813801 -> "671-181-3801" (format compte Google Ads). */
function formatCustomerId(id: string): string {
  const d = id.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : id;
}
```

Puis, dans le JSX, juste après le `<p>` d'intro (celui qui se termine par « besoin de votre moyen de paiement. ») et **avant** la carte `POURQUOI MA CARTE ?`, insérer le bandeau conditionnel :

```tsx
        {adsAccount?.customer_id ? (
          <div
            className="mt-5 rounded-[16px] p-4"
            style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.30)" }}
          >
            <p className="text-sm font-bold" style={{ color: "#047857" }}>
              ✅ Votre compte est créé · ID {formatCustomerId(adsAccount.customer_id)}
            </p>
            {lead.email ? (
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                Google a envoyé une invitation à <b style={{ color: "var(--ink)" }}>{lead.email}</b>. Acceptez-la pour accéder à votre compte.
              </p>
            ) : null}
          </div>
        ) : null}
```

- [ ] **Step 3: Vérifier le typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add app/eligibilite/activation/[id]/page.tsx
git commit -m "feat(funnel): page activation affiche le vrai ID de compte + email d'invitation"
```

---

## Task 7: Config env + validation e2e manuelle

**Files:**
- Modify: `.env.local` (local, non commité)
- Doc/checklist uniquement (pas de code)

- [ ] **Step 1: Ajouter l'allow-list en local**

Dans `.env.local`, ajouter (ton email = celui qui déclenchera le réel) :

```
GOOGLE_ADS_REAL_EMAILS=nico39320@gmail.com
```

Vérifier que les `GOOGLE_ADS_*` (developer token, client id/secret, refresh, MCC) sont bien présents en local (cf. note Obsidian). Si absents, les copier depuis la note.

- [ ] **Step 2: Préparer un lead de test avec TON email**

Soit via le funnel démo (`/eligibilite/demo`) en renseignant ton email, soit en mettant à jour le lead démo en base. Le lead doit avoir : `email` = ton email, `metier`, `ville`, `lat`/`lon` (étape carte), `site_url`, `phone`, `budget_daily`.

- [ ] **Step 3: Dérouler le vrai parcours**

Lancer `npm run dev`, ouvrir le rapport du lead (`/eligibilite/rapport/<id>`), cliquer « Lancer ma campagne ».

Vérifications (checklist) :
- [ ] Notif Telegram « ✅ Compte Google Ads RÉEL créé — ID … ».
- [ ] **Email d'invitation Google reçu** sur ton adresse (« Invitation à gérer un compte Google Ads »).
- [ ] Dans l'UI Google Ads (MCC 671), le sous-compte apparaît avec une **campagne PAUSED** (budget, ad group, keywords, RSA, négatifs).
- [ ] Ligne `google_ads_accounts` : `customer_id` rempli, `status='paused'`, `campaign_id` non nul.
- [ ] Page `/eligibilite/activation/<id>` affiche « Votre compte est créé · ID … » + ton email.

> Si une opération `mutateResources` échoue, lire le message d'erreur Google (champ/enum exact) et corriger le nom dans `create.ts` (Task 4 Step 2), puis relancer. L'idempotence du compte (Task 3) évite de recréer un sous-compte à chaque essai.

- [ ] **Step 4: Pousser l'allow-list + credentials sur Vercel (pour tester en prod)**

Sur Vercel (projet `scrap-prosp`, Production) : ajouter `GOOGLE_ADS_REAL_EMAILS` + tous les `GOOGLE_ADS_*` manquants, puis redeploy. (Étape manuelle — Vercel CLI non installé.)

- [ ] **Step 5: Mettre à jour la note Obsidian**

Ajouter une entrée datée dans `D:\obsidian\MonCerveau\Projets\prospects-tracker.md` (Phase 2 livrée + comment tester + pièges rencontrés).

---

## Self-Review (rempli par l'auteur du plan)

- **Couverture spec** : allow-list (T1/T2), compte réel (T3), invitation/email Google (T3), campagne PAUSED (T4), wiring + notif (T5), page activation dynamique (T6), env + e2e (T7). ✅ Tous les points de la spec ont une task.
- **Hors scope respecté** : pas de polling, pas de billing, pas de dépause — conforme.
- **Cohérence des types** : `CampaignPlan`/`CampaignParams` réutilisés tels quels ; `CreateResult` enrichi de `customerId`/`campaignId` (T5) et consommé par la route (T5 Step 4). `createOrReuseAccount`/`inviteUser`/`createPausedCampaign` définis en T3/T4 et appelés en T5.
- **Risque connu** : signatures exactes `google-ads-api` v24 (createCustomerClient, services pluralisés, forme de `mutate_operation_responses`, enums géo) à confirmer au Step 1 de T3 et au smoke-test T7 — instructions de vérification explicites fournies, pas de placeholder.
