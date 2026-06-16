# Répondre aux SMS clients — Design

**Date :** 2026-06-16
**Statut :** Validé (design), en attente de plan d'implémentation

## Objectif

Permettre de **répondre en texte libre** aux SMS entrants des clients, directement
depuis l'app, sans sortir vers Twilio. Aujourd'hui les réponses clients sont déjà
reçues et stockées (webhook `/api/sms/incoming`) mais il n'existe aucun moyen de
**répondre** depuis l'interface.

## Contexte existant (déjà en place)

- **Provider :** Twilio (`app/lib/twilio.ts`, Messaging Service SID).
- **Envoi sortant :** `POST /api/sms` (templates `sales`/`delivery`, bascule le
  statut prospect en `sms_sent`).
- **Réception :** webhook `POST /api/sms/incoming` — log inbound + maj statut
  prospect (STOP → `negative`, toute autre réponse → `positive`).
- **Table :** `sms_messages` (`direction` `inbound`/`outbound`, `to_phone`,
  `from_phone`, `body`, `segments`, `status`, `sentiment`, `sent_at`, `twilio_sid`,
  `prospect_id`). Voir `supabase/migration-004-sms-messages.sql`.
- **Vue conversation :** page `/sms` regroupe les SMS par numéro (`Convo.thread`).
- **Fiche :** `app/components/CallModal.tsx` affiche « SMS envoyé le X ».
- **Helpers :** `toE164`, `smsSegments`, `salesSmsMsg`, `deliverySmsMsg`
  (`app/lib/sms.ts`) ; `logOutboundSms`, `logInboundSms` (`app/lib/smsLog.ts`).

## Décisions

| Sujet | Décision |
|-------|----------|
| Emplacement | Page `/sms` **ET** fiche prospect (CallModal) |
| Rédaction | Texte libre **+ modèles rapides** éditables |
| Créneaux horaires | **Aucune restriction** (réponse 1-1 sollicitée, légalement OK) |
| Notification | **Badge « à répondre » in-app** (pas de Telegram) |
| Garde-fou STOP | **Bloquer** l'envoi vers un numéro désinscrit (STOP/ARRET) |
| Suivi « non lu » | **Dérivé** (dernier message du fil entrant), pas de colonne DB |
| Coût | **Compteur de segments** affiché avant envoi |

## Architecture

### 1. Backend — `POST /api/sms/reply`

Nouvel endpoint dédié aux réponses conversationnelles en texte libre. Distinct de
`/api/sms` qui est basé sur des templates et bascule le statut en `sms_sent`.

- **Entrée :** `{ prospectId?: string | null, to: string, text: string, dryRun?: boolean }`
  - `to` requis (numéro du contact, tel qu'affiché dans le fil).
  - `prospectId` optionnel (sert au log/liaison).
- **Validation :** `text` non vide (trim) ; `to` normalisé via `toE164` (mobile FR
  valide), sinon 400.
- **Garde-fou STOP (légal, obligatoire) :** chercher dans `sms_messages` un message
  `inbound` de ce numéro dont le `body` matche le regex STOP
  (`/\b(STOP|ARRET|ARRÊT|DESABONNER|UNSUBSCRIBE)\b/i`). Si trouvé → **403**
  (`"Client désinscrit (STOP) — envoi interdit"`). Un simple « non merci » sans STOP
  reste répondable.
- **dryRun:true** → renvoie `{ ok:true, message:text, segments }` sans rien envoyer
  (aperçu/coût), même contrat que `/api/sms`.
- **Envoi :** `client.messages.create({ messagingServiceSid, to, body:text,
  statusCallback: ${base}/api/sms/status })`.
- **Log :** `logOutboundSms({ prospectId, to, body:text, segments, sid })`.
- **NE FAIT PAS :** `markProspectSmsSent` (on n'écrase pas le statut `positive`) ;
  aucune vérification de créneau horaire.
- **Sortie :** `{ ok:true, sid, segments, sentAt }` ou `{ error }` + status HTTP.
- **Garde-fous infra :** mêmes que `/api/sms` — `supabaseConfigured` (503),
  `twilioConfigured` si non-dryRun (503).
- **Auth :** route protégée (cookie `prospects-auth`), comme `/api/sms` — **pas**
  ajoutée à la whitelist du middleware (ce n'est pas un webhook).

### 2. Modèles de réponse rapides

Nouveau fichier `app/lib/smsReplyTemplates.ts` :

```ts
export interface ReplyTemplate { label: string; text: string }
export const REPLY_TEMPLATES: ReplyTemplate[] = [ /* ~5 snippets */ ];
```

- Snippets courts, ton conversationnel, **sans** mention STOP.
- Exemples : « Je vous rappelle dans la journée 👍 », « Quel créneau vous convient
  pour un appel ? », « Merci pour votre retour ! », « Je vous envoie ça tout de
  suite. », « Avec plaisir, je m'en occupe. »
- Comportement UI : clic sur un modèle = **insère** le texte dans le champ
  (remplace le contenu courant s'il est vide, sinon ajoute), toujours éditable
  avant envoi. Aucune logique serveur (pur frontend).

### 3. UI — page `/sms` (composer dans le fil)

Dans `app/sms/page.tsx`, au sein du thread **déplié** (`expanded`) d'une conversation :

- Un **composer** en bas du fil : chips des `REPLY_TEMPLATES` + `<textarea>` +
  compteur de segments live (`smsSegments(text)`) + bouton « Envoyer ».
- À l'envoi : `POST /api/sms/reply` avec `{ prospectId: c.prospectId, to: c.phone
  (E.164), text }`. Sur succès : ajout optimiste d'une ligne `outbound` dans `rows`
  (le fil et le badge se recalculent), vide le champ ; sinon affiche l'erreur.
- **Masqué/désactivé** si la conversation contient un STOP (même détection que le
  backend, calculée côté client sur `c.replies`).
- Le numéro envoyé doit être au format E.164 : reconstruire `+` + `c.phone`
  (`c.phone` est déjà normalisé `33…`) ⇒ `+${c.phone}`.

**Badge « à répondre » :**
- Définition : conversation dont le **dernier message du `thread` est `inbound`**
  (le client a écrit en dernier).
- Ajouts : nouveau filtre « À répondre » + compteur dans la barre de stats +
  pastille visuelle (point coloré) sur les cartes concernées.
- Répondre bascule le dernier message en `outbound` → le badge disparaît tout seul.

### 4. UI — fiche (CallModal)

Dans `app/components/CallModal.tsx`, ajouter un bloc « Conversation SMS » :

- Charge le fil du prospect (`sms_messages` où `prospect_id = prospect.id`, triés
  par `sent_at`), affiche les ~5 derniers messages en bulles (réutilise le style du
  thread `/sms` : sortant à droite, entrant à gauche).
- Même **composer** (chips de modèles + textarea + compteur + envoi) appelant
  `POST /api/sms/reply` avec `{ prospectId: prospect.id, to: <E.164 du prospect>, text }`.
- Indicateur « à répondre » si le dernier message du fil est entrant.
- Désactivé si STOP détecté dans le fil du prospect.

### 5. Données

**Aucune migration.** On réutilise `sms_messages`. Une réponse = ligne
`direction='outbound'` loggée à l'identique des autres envois. Le fil et l'état
« à répondre » se dérivent du regroupement par numéro déjà existant.

## Découpage proposé (unités)

1. `app/lib/smsReplyTemplates.ts` — constante des modèles (isolé, testable).
2. `app/api/sms/reply/route.ts` — endpoint (validation, garde-fou STOP, envoi, log).
3. Composer réutilisable — composant React partagé (`SmsReplyComposer`) consommé par
   `/sms` et CallModal, pour éviter la duplication (textarea + chips + compteur +
   bouton + état d'envoi).
4. Intégration `/sms` — composer dans le thread + filtre/badge « à répondre ».
5. Intégration CallModal — bloc conversation + composer.

## Tests

- **Unitaire** `smsReplyTemplates` : structure (label/text non vides, pas de mention
  STOP dans les textes).
- **Unitaire** détection STOP (regex) partagée entre back et front : matche
  STOP/ARRET/ARRÊT/DESABONNER/UNSUBSCRIBE, ignore « non merci ».
- **Endpoint** `/api/sms/reply` :
  - `text` vide → 400 ; numéro non mobile → 400.
  - `dryRun` → renvoie `message`+`segments`, n'appelle pas Twilio.
  - Numéro avec STOP en historique → 403, pas d'envoi.
  - Succès → `logOutboundSms` appelé, **pas** de `markProspectSmsSent`.
- **Manuel** : répondre depuis `/sms` et depuis la fiche ; vérifier l'apparition de
  la bulle, la disparition du badge « à répondre », le blocage sur un numéro STOP.

## Hors périmètre (YAGNI)

- Colonnes `read_at` / `conversation_id` / `parent_message_id`.
- Notifications externes (Telegram, push).
- Restriction horaire sur les réponses.
- Accusés de lecture, indicateur de frappe.
