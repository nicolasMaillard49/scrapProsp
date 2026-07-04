# Instagram — Cockpit de supervision multi-comptes — Design

> Date : 2026-07-06 · Statut : validé (Nicolas) → implémentation directe
> Principe : l'envoi reste 100 % HUMAIN (règle Meta : aucun bot). L'outil supervise :
> comptes émetteurs, quotas (15/h · 60/j, chauffe progressive), pipeline par prospect,
> file de relances, notifications Telegram (bot déjà branché, `app/lib/notify.ts`).

## 1. Données — migration 017
- **`ig_accounts`** : comptes Instagram émetteurs. `username` (unique), `status`
  (`warmup|chaud|pause`), `started_at` (début du plan de chauffe), `notes`.
- **`ig_dm_log`** : 1 ligne par message marqué envoyé (`prospect_id`, `account_id`,
  `step` M1..M9/R1..R3, `sent_at`). Source des compteurs de quotas (heure glissante /
  jour) et des stats.
- **`instagram_prospects`** + colonnes : `contacted_by` (fk ig_accounts), `stage`
  (`accroche|presentation|connexion|douleur|appel_propose|questionnaire_envoye|call_booke|perdu`),
  `last_dm_at`, `followup_count`, `next_followup_at` (échéance de relance calculée).

## 2. Lib pure `app/lib/igPipeline.ts` (testée)
- `warmupCaps(startedAt, status, now)` → `{ hourly, daily, day }` — plan de chauffe :
  J1-2 : 5/h · 15/j → J3-4 : 10/20 → J5-7 : 10/25 → J8-10 : 15/30 → J11-14 : 15/40 →
  J15+ ou `chaud` : 15/h · 60/j (plafonds de la méthode, jamais dépassés).
- `clampToWindow(date)` — fenêtre d'envoi 8 h-20 h (sinon reporté au lendemain 8 h).
- `nextFollowup(now, followupCount, seen)` — vu sans réponse : R1 +1 h, R2 +7 h,
  R3 +6 h, ensuite +24 h ; pas de vu : +48 h. Clampé à la fenêtre.
- `stageForStep(step)` — mapping M1→accroche … M9→questionnaire_envoye (Rn : inchangé).

## 3. Routes
- `GET/POST /api/instagram/accounts` — liste (avec compteurs heure/jour dérivés de
  `ig_dm_log` + caps calculés) / création. `PATCH /api/instagram/accounts/[id]` : statut.
- `POST /api/instagram/dm` `{ prospect_id, account_id, step }` — vérifie le quota
  (refus 429 si plafond), log, met à jour le prospect (stage, `contacted_by`,
  `status=contacted` sur M1, `last_dm_at`, `next_followup_at` +48 h par défaut,
  `followup_count` sur Rn). **Telegram** : alerte à 80 % du plafond jour et au plafond.
- `PATCH /api/instagram/[id]` étendu : `{ seen: true }` → `next_followup_at = now+1h`
  (clampé) ; `{ stage }` → transitions manuelles (`repondu`, `call_booke`, `perdu`).
- **Digest Telegram** (`app/lib/igDigest.ts`) : par compte (envoyés aujourd'hui / plafond),
  nb de relances dues (top 5), funnel (questionnaires envoyés, calls bookés).
  Deux entrées : `POST /api/instagram/digest` (bouton UI, cookie) et
  `POST /api/cron/ig-digest` (`x-cron-secret`, comme radar/run-blasts — cron VPS 8 h).

## 4. UI (`/instagram`, section « Cockpit » entre l'outil et la liste)
- Cartes comptes : statut (Jn de chauffe / chaud / pause), jauges **X/15 h** et **Y/60 j**
  (rouge au plafond), sélection du **compte actif** (radio), ajout inline, bouton récap
  Telegram.
- **File « À relancer maintenant »** : prospects `next_followup_at <= now` (statut
  contacted, non perdus) — clic = filtre la liste sur le prospect.
- Cartes prospects : chip **stade**, bouton **« Vu sans réponse »** (programme R1 +1 h),
  boutons stage manuels (Répondu / Call ✓ / Perdu) ; dans la séquence DM, chaque étape a
  **« Marquer envoyé »** (compte actif requis) → POST /dm, MAJ compteurs + stade en live.

## 5. Garde-fous méthode (encodés)
- Refus d'envoi au-delà des plafonds (heure glissante + jour, par compte).
- Relances jamais entre 20 h et 8 h (clamp).
- L'outil n'envoie JAMAIS de DM — il trace ce que l'humain a envoyé.
