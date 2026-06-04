# Suivi des SMS — Design

> 2026-06-04 — Ajouter une section SMS dans l'app : tous les SMS envoyés avec leur réponse, classée positive / négative. Aujourd'hui le blast envoie via Twilio mais **n'enregistre rien** ; les réponses sont juste collées dans `prospects.notes`. Il n'existe aucune trace exploitable des envois.

## Problème

- `/api/blast` et `/api/sms` envoient les SMS mais ne créent aucune ligne en base.
- `/api/sms/incoming` (webhook) colle la réponse dans `prospects.notes` et passe le prospect en `positive` — quelle que soit la réponse.
- Conséquence : impossible de lister les SMS envoyés, de voir le taux de réponse, de distinguer positif/négatif, ni de retrouver les envois sans réponse.

## Décisions actées

1. **Historique d'hier** : backfill depuis l'API Twilio (garde tout : envoyés, reçus, statut delivered/failed).
2. **Classement positif/négatif** : IA Claude Haiku (clé Anthropic fournie).
3. **Vue** : tableau filtrable avec compteurs.
4. **Pipeline** : un sentiment `negative` (ou STOP) fait passer le prospect en statut `negative` (« exclus »). Un `positive`/`neutral` le laisse en `positive` (lead à regarder).

## Architecture

Source de vérité unique = nouvelle table `sms_messages`. Alimentée à 3 endroits : envoi, webhook entrant, backfill Twilio. La section `/sms` lit cette table.

### 1. Schéma — `supabase/migration-004-sms-messages.sql`

```sql
CREATE TABLE sms_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid REFERENCES prospects(id) ON DELETE SET NULL,
  twilio_sid       text UNIQUE,                       -- dédup backfill
  direction        text NOT NULL,                     -- 'outbound' | 'inbound'
  to_phone         text,
  from_phone       text,
  body             text NOT NULL DEFAULT '',
  segments         integer,
  status           text,                              -- twilio: sent/delivered/undelivered/failed/received...
  sentiment        text,                              -- 'positive' | 'negative' | 'neutral' | NULL (à classer)
  sentiment_source text,                              -- 'ai' | 'keyword' | 'manual'
  sent_at          timestamptz,                       -- twilio dateSent/dateCreated
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_sms_prospect  ON sms_messages(prospect_id);
CREATE INDEX idx_sms_direction ON sms_messages(direction);
CREATE INDEX idx_sms_sent_at   ON sms_messages(sent_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;
```

`prospect_id` nullable : une réponse peut ne pas matcher de prospect (numéro inconnu) — on garde quand même la ligne. `twilio_sid` unique : le backfill peut tourner en boucle sans doublon (upsert).

### 2. Logging à l'envoi — `app/lib/smsLog.ts` (helper) + `/api/blast`, `/api/sms`

Nouveau helper `logOutboundSms({ prospectId, to, body, segments, sid, status })` qui insère une ligne `outbound`. Appelé après chaque `client.messages.create()` réussi dans `/api/blast` et `/api/sms`. Échec d'insert = non bloquant (log console, on ne casse pas l'envoi).

### 3. Webhook entrant — `app/api/sms/incoming/route.ts`

En plus du comportement actuel :
- Insère une ligne `inbound` (`from_phone`, `body`, `twilio_sid` = `MessageSid`, `status='received'`).
- STOP/ARRET → `sentiment='negative'`, `sentiment_source='keyword'` → prospect passe en `negative`.
- Autre réponse → `sentiment=NULL` (à classer par l'IA). Prospect passe en `positive` (lead à regarder) — affiné ensuite par le classement.
- Reste rapide : **aucun appel IA dans le webhook** (Twilio attend une réponse TwiML rapide).
- On conserve l'ajout dans `prospects.notes` (rétro-compat, trace lisible).

### 4. Backfill Twilio — `scripts/import-twilio-sms.mjs`

- `client.messages.list({ limit })` → tous les messages du compte.
- Direction déduite : `outbound-*` → `outbound`, `inbound` → `inbound`.
- Match prospect par numéro (`toE164` du prospect == `to`/`from` du message).
- Upsert par `twilio_sid` (idempotent).
- Les `inbound` non-STOP arrivent en `sentiment=NULL` → classés ensuite par l'étape 5.
- STOP détecté au backfill → `sentiment='negative'`, `source='keyword'`.
- Ajouté à `package.json` : `"import:twilio": "node scripts/import-twilio-sms.mjs"`.

### 5. Classement IA — `app/api/sms/classify/route.ts` + `app/lib/classify.ts`

- Sélectionne les `inbound` avec `sentiment IS NULL` (limite configurable, ex. 50).
- Pour chaque, appelle **Claude Haiku** via `@anthropic-ai/sdk` (nouvelle dép) avec un prompt court : « réponse d'un prospect à un SMS de prospection web ; réponds par un seul mot : positive / negative / neutral ». Température 0.
- Met à jour `sentiment` + `sentiment_source='ai'`. Si `negative` → prospect en `negative`.
- Déclenché par un bouton « Classer N réponses » dans `/sms` (lazy, hors webhook). Réponse JSON : `{ classified, positive, negative, neutral }`.
- Env : `ANTHROPIC_API_KEY`. Si absente → 503 explicite (le webhook/keyword continue de marcher sans).

### 6. Section `/sms` — `app/sms/page.tsx`

- Page client calquée sur `app/carte/page.tsx` (même thème sombre, retour `ArrowLeft`, lecture Supabase côté client via clé publishable).
- Lien dans le header de `app/page.tsx` à côté de « Carte » (icône `MessageSquare`).
- **Compteurs en haut** : Envoyés · Délivrés · Échecs · Répondu · Positifs · Négatifs (+ taux de réponse).
- **Tableau** (jointure `sms_messages` ↔ `prospects` pour le nom) : Prospect · Date · Statut envoi (badge delivered/failed) · Corps SMS · Réponse · Badge sentiment (vert/rose/gris).
- **Filtres** (chips) : Tous · Envoyés · Répondu · Positifs · Négatifs · Échecs.
- **Bascule manuelle** du sentiment par ligne (positive/negative/neutral) → update `sentiment_source='manual'` (+ MAJ statut prospect si negative). Prime sur l'IA.
- **Bouton « Classer N réponses »** → POST `/api/sms/classify`, refresh.
- Lien vers la démo du prospect (`/d/{shortCode}`) et vers sa fiche.

### Variables d'env ajoutées (`.env.example`)

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Hors scope V1 (YAGNI)

- **Status callback Twilio temps réel** (delivered/failed live) : on s'appuie sur le re-run du backfill pour rafraîchir les statuts. À ajouter plus tard si besoin.
- Fil de conversation par prospect (thread) : la fiche prospect garde déjà les notes ; on ne fait pas de vue thread dédiée en V1.
- Reclassement automatique en masse : le bouton manuel suffit.

## Découpage des unités

| Unité | Rôle | Dépend de |
|-------|------|-----------|
| `migration-004-sms-messages.sql` | Schéma table | — |
| `app/lib/smsLog.ts` | Insert outbound/inbound | supabase |
| `app/lib/classify.ts` | Appel Haiku → sentiment | @anthropic-ai/sdk |
| `/api/blast`, `/api/sms` | Loggent à l'envoi | smsLog |
| `/api/sms/incoming` | Logge inbound + statut prospect | smsLog |
| `/api/sms/classify` | Classe les pending | classify, supabase |
| `scripts/import-twilio-sms.mjs` | Backfill | twilio, supabase |
| `app/sms/page.tsx` | UI tableau + filtres | supabase (client) |

## Critères de succès

- Après backfill, la section `/sms` liste tous les SMS d'hier (envoyés + réponses) avec statut delivered/failed.
- Une nouvelle réponse entrante apparaît dans la section avec sa réponse texte.
- Le bouton « Classer » attribue positive/négatif/neutre via Haiku ; un négatif exclut le prospect.
- Les compteurs (envoyés / répondu / positifs / négatifs) sont justes.
- La bascule manuelle prime sur l'IA.
