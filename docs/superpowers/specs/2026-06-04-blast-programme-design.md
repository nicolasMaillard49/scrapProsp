# Blast SMS programmé — Design

> **But** : permettre de programmer, depuis la section `/sms`, l'envoi d'une vague de
> prospection SMS à une **date/heure choisie** et pour un **nombre de prospects choisi**.
> L'envoi part automatiquement à l'heure dite, **app et PC fermés** (déclenché par un cron VPS).

**Date** : 2026-06-04
**Stack** : Next.js 15 (App Router), Supabase JS (clé publishable + secret), Twilio, Tailwind v4, lucide-react.

---

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|---|---|
| Déclencheur à l'heure dite | **Cron sur le VPS** (machine 24/7, infra cron déjà présente). |
| Type d'envoi | **Ponctuel** (date + heure précise). Récurrence hors scope. |
| Message | **Message actuel** (avec accents), inchangé. Pas de toggle. |
| Fuseau | **Europe/Paris**. |
| Sélection des cibles | À l'exécution : `status=todo`, mobiles 06/07 uniques (logique blast existante). |

**Hors scope (YAGNI)** : récurrence, choix du message/variante sans accents, choix de l'offset,
retry automatique, file de priorité.

---

## 2. Architecture

Cinq composants. Le « moteur » d'envoi existant (`/api/blast`) est extrait dans une lib
partagée pour être réutilisé par le cron sans duplication.

### 2.1 Table Supabase `scheduled_blasts`

```
id            uuid pk default gen_random_uuid()
scheduled_at  timestamptz not null          -- échéance (stockée en UTC, saisie en heure de Paris)
limit_count   int not null check (limit_count > 0)
status        text not null default 'pending'  -- pending | running | done | failed | canceled
result        jsonb                          -- {sent, failed, totalSegments, pool, targeted, error?}
created_at    timestamptz not null default now()
executed_at   timestamptz
```
- Index sur `(status, scheduled_at)` pour la sélection des jobs dus.
- Publiée au realtime (comme `prospects`/`sms_messages`) pour rafraîchir la liste UI en live.
- Migration : `supabase/migration-005-scheduled-blasts.sql` + script d'application
  `scripts/apply-migration-005.mjs` (même schéma que `apply-migration-004.mjs`).

### 2.2 Lib partagée `app/lib/blast.ts`

Extraction de la logique aujourd'hui inline dans `app/api/blast/route.ts` :

```ts
runBlast({ limit, offset, force, dryRun, base }): Promise<BlastResult>
```
- Sélection `status=todo` + mobiles uniques (`toE164`), garde-fou légal Paris 8h–20h hors
  dimanche (sauf `force`), envoi via Messaging Service, `logOutboundSms` + `markProspectSmsSent`,
  `statusCallback`. **Comportement identique à l'actuel.**
- `BlastResult = { pool, targeted, sent, failed, totalSegments, results }`.
- `app/api/blast/route.ts` devient un mince wrapper qui parse le body et appelle `runBlast`.

### 2.3 API

| Route | Méthode | Rôle | Auth |
|---|---|---|---|
| `/api/scheduled-blasts` | `POST` | Crée un job `{ scheduledAt, limit }`. Valide `limit>0`, `scheduledAt` futur. | Cookie `prospects-auth` (middleware) |
| `/api/scheduled-blasts` | `GET` | Liste les jobs (pending + historique récent). | Cookie |
| `/api/scheduled-blasts/[id]` | `DELETE` | Passe un job `pending` → `canceled`. | Cookie |
| `/api/cron/run-blasts` | `POST` | **Moteur**. Voir 2.4. | En-tête `x-cron-secret` = `CRON_SECRET` |
| `/api/twilio/balance` | `GET` | Renvoie `{ balance, currency }` (Twilio API). Pour l'aperçu coût/solde. | Cookie |

### 2.4 Moteur `/api/cron/run-blasts`

Appelé chaque minute par le cron VPS. Logique :
1. Vérifie l'en-tête secret (`x-cron-secret` === `process.env.CRON_SECRET`) → sinon `401`.
2. Sélectionne les jobs `status='pending' AND scheduled_at <= now()`.
3. Pour chaque job : **claim atomique** `update … set status='running' where id=? and status='pending'`
   (renvoie 0 ligne si déjà pris par un tick précédent → on saute → **anti-double-envoi**).
4. Exécute `runBlast({ limit: job.limit_count, base: PROD_URL })`.
5. Écrit `status='done'` (ou `'failed'` si exception / refus légal) + `result` + `executed_at`.
6. Renvoie un récap `{ ran: [...], skipped: n }`.

### 2.5 Cron VPS

Une ligne crontab (toutes les minutes) :
```cron
* * * * * curl -s -X POST https://prospects.nmf-agence.com/api/cron/run-blasts -H "x-cron-secret: $CRON_SECRET" >> /var/log/blast-cron.log 2>&1
```
- `CRON_SECRET` ajouté dans **Vercel** (Production) et sur le **VPS** (`/etc/environment` ou le crontab).
- Doc de mise en place fournie dans `DEPLOY.md` (section « Blast programmé »).

### 2.6 UI — panneau « Programmer un envoi » dans `/sms`

Nouveau bloc repliable en haut de `/sms` (sous le header, avant les stats) :
- **Champs** : nombre de prospects (`number`), date (`date`, défaut aujourd'hui), heure (`time`, défaut `18:00`).
- **Aperçu live** : `coût estimé = N × 0,399 $` · `solde Twilio` (via `/api/twilio/balance`) · badge vert/rouge selon `coût ≤ solde`.
- **Avertissement** si l'heure choisie est hors créneau légal (avant 8h, ≥ 20h, ou dimanche).
- Bouton **« Programmer »** → `POST /api/scheduled-blasts` → toast + rafraîchit la liste.
- **Liste des envois programmés** : date/heure, nb, statut (badge), bouton **Annuler** (si `pending`),
  résultat (`done` → « X envoyés »). Abonnement realtime pour MAJ live.

---

## 3. Flux de données

```
[UI /sms] --POST /api/scheduled-blasts--> [table scheduled_blasts: pending]
                                                     |
[cron VPS chaque minute] --POST /api/cron/run-blasts--> claim pending->running
                                                     |
                                          runBlast(limit) --> Twilio + logOutboundSms
                                                     |            + markProspectSmsSent
                                          status=done + result
                                                     |
[UI liste] <--realtime-- (statut & résultat mis à jour en live)
```

---

## 4. Gestion d'erreurs / cas limites

- **Double-exécution** : claim atomique `pending→running` conditionné sur `status='pending'`.
- **VPS down à l'échéance** : au retour, `scheduled_at <= now()` reste vrai → job exécuté en retard
  (accepté en v1 ; pas de fenêtre d'expiration).
- **Hors créneau légal** : `runBlast` refuse (garde-fou Paris) → job `failed`, `result.error` explicite.
  L'UI prévient dès la saisie.
- **Budget Twilio insuffisant** : envoi partiel, Twilio refuse le surplus, `result` reflète `sent`/`failed`.
  L'aperçu coût/solde prévient avant de programmer.
- **`limit` > prospects dispo** : `runBlast` envoie au max dispo (slice), pas d'erreur.
- **Secret cron manquant/incorrect** : `/api/cron/run-blasts` → `401`, rien n'est exécuté.

---

## 5. Sécurité

- `/api/cron/run-blasts` protégé par `CRON_SECRET` (en-tête), **exempté dans `middleware.ts`**
  (comme `/api/sms/incoming` et `/api/sms/status`).
- Routes UI (`/api/scheduled-blasts*`, `/api/twilio/balance`) restent derrière le cookie middleware.
- Aucune clé en clair côté client ; `CRON_SECRET` et secrets Twilio/Supabase côté serveur uniquement.

---

## 6. Vérification (pas de test runner dans ce repo)

- `npx tsc --noEmit` + `npm run build`.
- Migration appliquée (`node scripts/apply-migration-005.mjs`) → table visible.
- Test fonctionnel : programmer un envoi à `maintenant + 2 min` avec `limit=1` en **dry-run de contrôle**
  (ou `limit=1` réel à faible coût), vérifier le passage `pending→running→done` et la ligne `sms_messages`.
- Vérifier le `401` de `/api/cron/run-blasts` sans secret.

---

## 7. Fichiers touchés

**Créés** : `supabase/migration-005-scheduled-blasts.sql`, `scripts/apply-migration-005.mjs`,
`app/lib/blast.ts`, `app/api/scheduled-blasts/route.ts`, `app/api/scheduled-blasts/[id]/route.ts`,
`app/api/cron/run-blasts/route.ts`, `app/api/twilio/balance/route.ts`,
`app/sms/ScheduleBlastPanel.tsx` (composant client dédié, importé par `app/sms/page.tsx`).

**Modifiés** : `app/api/blast/route.ts` (utilise `runBlast`), `middleware.ts` (exempte le cron),
`app/sms/page.tsx` (intègre le panneau), `DEPLOY.md` (doc cron + `CRON_SECRET`), `.env.example` (+`CRON_SECRET`).
