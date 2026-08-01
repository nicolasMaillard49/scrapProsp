# Mettre prospects-tracker en ligne — Vercel, 5 minutes

Le projet est prêt à être déployé sur Vercel sans aucune configuration supplémentaire (Next 15 + Node 22 auto-détectés). Suis les étapes ci-dessous.

## 1. Importer le repo

1. Ouvre https://vercel.com/new
2. Connecte ton compte GitHub si pas déjà fait
3. Recherche le repo `nicolasMaillard49/scrapProsp` → clic **Import**
4. Sur l'écran de config :
   - **Framework Preset** : Next.js (auto-détecté)
   - **Build Command** : laisser par défaut (`next build`)
   - **Output Directory** : laisser par défaut
   - **Install Command** : laisser par défaut
   - **Root Directory** : laisser à la racine

## 2. Définir le mot de passe d'accès

Toujours sur l'écran de config, ouvre **Environment Variables** et ajoute :

| Name | Value |
|---|---|
| `AUTH_PASSWORD` | *choisis un code à toi* (au moins 6 caractères) |

Si tu ne définis rien, le code par défaut est `0902` (présent dans `.env.example`) — **change-le pour la prod**.

## 3. Cliquer "Deploy"

Vercel build + déploie en ~90 secondes. Tu obtiens une URL `https://scrap-prosp-xxxx.vercel.app`.

## 4. (Optionnel) Brancher un domaine

- Dashboard Vercel → projet → **Settings → Domains**
- Ajouter `prospects.nmf-agence.fr` (ou un sous-domaine de ton choix)
- Suivre la consigne DNS (un CNAME chez ton registrar)

## 5. Re-déploiements automatiques

Chaque `git push` sur `main` déclenche un nouveau build/deploy. Rien à faire.

## Limites connues

- **Auth ultra-simple** : 1 mot de passe partagé, cookie 90 jours. Suffisant pour un usage solo.
- **État sauvé en localStorage** (statuts, notes, historique des appels) : un autre device = vue vierge. Pas grave pour l'instant ; on bascule en DB le jour où c'est multi-device.
- **Données = CSV statiques** dans `public/` : pour ajouter des prospects, on commit + push.

## Réenrichir les données SIRENE

À refaire tous les ~6 mois pour rattraper les nouvelles créations / radiations :

```bash
npm run enrich:sirene
git add public/*.csv public/manifest.json
git commit -m "refresh SIRENE data"
git push
```

Vercel redéploie tout seul après le push.

## Blast programmé (cron VPS)

Permet de programmer un envoi SMS depuis `/sms` (heure + nombre de prospects) qui part automatiquement même app/PC fermés.

1. Définir un secret partagé **identique** dans **Vercel** (Production → Environment Variables) et sur le **VPS** :
   - Vercel : `CRON_SECRET=<valeur-aléatoire-longue>` (puis redeploy).
2. Sur le VPS, ajouter au crontab (`crontab -e`) — déclenche le moteur chaque minute :
   ```cron
   * * * * * curl -s -X POST https://prospects.nmf-agence.com/api/cron/run-blasts -H "x-cron-secret: VOTRE_CRON_SECRET" >> /var/log/blast-cron.log 2>&1
   ```
3. Test : `curl -i -X POST https://prospects.nmf-agence.com/api/cron/run-blasts` → **401** (pas de secret).
   Avec le bon en-tête → `{ "ran": [...], "count": n }`.
4. Les envois se créent depuis `/sms` → « Programmer un envoi ». Le cron exécute les jobs `scheduled_blasts` en `status=pending` dont l'heure est passée ; chaque job envoie aux prospects `status=todo` (mobiles uniques), avec garde-fou légal 8h-20h hors dimanche (un job hors créneau est remis en attente, pas perdu).

## Bilan KPI quotidien → Slack #04-kpis (cron Vercel)

Poste chaque jour le bilan de prospection IG (envois, relances, réponses, calls bookés) dans le canal Slack **#04-kpis** du workspace Generate.io.

- Route : `GET/POST /api/cron/kpi-slack` — auth `x-cron-secret` (VPS) **ou** `Authorization: Bearer CRON_SECRET` (cron Vercel, envoyé automatiquement).
- Déclencheur : cron Vercel dans `vercel.json` — `0 17 * * *` UTC (≈ 19 h Paris l'été).
- Env Vercel requis : `CRON_SECRET` (déjà posé) + `SLACK_KPI_WEBHOOK_URL` (webhook entrant Slack du canal #04-kpis : api.slack.com/apps → créer une app → Incoming Webhooks → Add New Webhook → choisir #04-kpis).
- Test sans poster : `curl "https://prospects.nmf-agence.com/api/cron/kpi-slack?dry=1" -H "x-cron-secret: VOTRE_CRON_SECRET"` → renvoie `{ dry, message }`.

## Sélection du jour + récap Telegram (cron Vercel)

Chaque matin, prépare la **liste fermée des comptes Instagram à démarcher aujourd'hui** — il n'y a plus de tri manuel à faire dans la liste des prospects.

- Route : `GET/POST /api/cron/ig-digest` — auth `x-cron-secret` (VPS) **ou** `Authorization: Bearer CRON_SECRET` (cron Vercel, envoyé automatiquement).
- Déclencheur : cron Vercel dans `vercel.json` — `0 6 * * *` UTC (≈ 8 h Paris l'été = début de la fenêtre d'envoi).
- Déroulé :
  1. reporte les comptes non traités de la veille (compteur `carry_count`) ;
  2. complète jusqu'au plafond de chauffe du compte (50/j max) avec les prospects **qualifiés par l'IA**, mixés par métier ;
  3. si des créneaux restent vides : **tri IA du stock déjà scrapé** (coût Claude seul), et seulement s'il n'y a plus rien à trier, **scan Apify d'un hashtag jamais utilisé** puis qualification des nouveaux ;
  4. poste le récap Telegram, sélection en tête.
- Tables : `ig_daily_selection` (la sélection) et `ig_hunt_targets` (les métiers à chasser + avatar IA) — `npm run migrate:019`.
- Cibles de chasse : amorcées automatiquement avec les métiers ayant ≥ 20 prospects en base. Pour en ajouter/retirer, éditer `ig_hunt_targets` (`active`, `avatar_profession`, `min_followers`, `max_followers`).
- Test sans rien poster ni dépenser : `curl "https://prospects.nmf-agence.com/api/cron/ig-digest?dry=1" -H "x-cron-secret: VOTRE_CRON_SECRET"` → renvoie `{ dry, selection }`.
- Côté cockpit : `/instagram` → onglet **Sélection du jour** (vue par défaut). Chaque « Prendre contact » raye sa ligne tout seul ; la corbeille écarte un compte (il ne sera pas reporté demain) ; « Aller en chercher » relance le refill à la main.

## Refill automatique de la sélection (script VPS — `vps/ig-refill.mjs`)

Remplit la sélection du jour **sans aucun clic** : le bouton « Aller en chercher » du cockpit ne sert plus que de rattrapage.

> ⚠️ Pourquoi sur le VPS et pas sur Vercel : une invocation Vercel meurt à **300 s**, ce qui plafonne une passe de refill à ~1 collecte + ~37 profils résolus + 1 lot Claude. Pour pourvoir les ~49 créneaux d'une journée de chauffe il en faut **7 à 10**. Le cron `ig-digest` du matin ne pouvait donc structurellement pas remplir la journée (constat 01/08/2026 : 33 qualifiés en stock pour 49 créneaux). Le VPS, lui, boucle sans mur.

- Route appelée : `GET/POST /api/cron/ig-refill` — auth `x-cron-secret` (même `CRON_SECRET` que les autres crons). Une passe de refill par appel, chacune courte et autonome.
  - `?mode=status` — ne dépense rien, renvoie seulement l'état (sonde d'entrée de la boucle).
  - `?notify=1` — poste l'état sur Telegram (utilisé par le script quand des créneaux restent vides).
- Le script boucle jusqu'à `shortfall = 0`, puis s'arrête. Garde-fous : `IG_REFILL_MAX_PASSES` (12), `IG_REFILL_MAX_MINUTES` (40) et surtout `IG_REFILL_QUOTA_FLOOR` (1500) — on n'entame pas la réserve mensuelle du fournisseur.
- Une passe tuée en vol (timeout Vercel, source à terre) n'est pas perdue : le refill commence toujours par qualifier les profils sans verdict, donc la passe suivante rattrape les orphelins.
- Déploiement : `VPS_SSH_PASSWORD='…' python scripts/deploy-vps.py` (le fichier est dans la liste).
- Config : ajouter `CRON_SECRET=…` (valeur Vercel) dans `/home/deploy/scrapProsp/vps/radar.env`.
- Cron sous le user `deploy` (`crontab -e`), toutes les 30 min sur la fenêtre d'envoi — **chemin Node absolu obligatoire** :
  ```cron
  */30 6-11 * * * cd /home/deploy/scrapProsp/vps && set -a && . ./radar.env && set +a && /home/deploy/.nvm/versions/node/v20.20.2/bin/node ig-refill.mjs >> /home/deploy/ig-refill.log 2>&1
  ```
- Test manuel : `cd /home/deploy/scrapProsp/vps && set -a && . ./radar.env && set +a && /home/deploy/.nvm/versions/node/v20.20.2/bin/node ig-refill.mjs`
- Vérif : `tail -50 /home/deploy/ig-refill.log`.

## Radar de nouveaux prospects (script VPS — `vps/radar.mjs`)

Détecte chaque nuit les nouvelles fiches Google Maps (sans site web) par métier×région, les insère en base et envoie **1 SMS récap** au `0615907873` s'il y a ≥ 1 nouveau prospect.

> ⚠️ Le radar **ne tourne PAS sur Vercel** : il scrape ~27 combos × ~13 villes, bien au-delà de la limite de 300 s des fonctions Vercel. Il s'exécute donc **sur le VPS** (où vit déjà le scraper), via Node ≥ 18 — aucune dépendance npm (il utilise les API REST Supabase + Twilio). L'ancien endpoint `/api/cron/radar` reste mais n'est plus le chemin de prod.

> ✅ **Déployé et live depuis le 2026-06-09** sur le VPS `deploy@51.255.200.169` (premier run manuel validé : 342 scrapes, 0 erreur, ~5 min). Chemins réels notés ci-dessous.

1. Sur le VPS, place le dépôt (ou au moins le dossier `vps/`) dans `~/scrapProsp/vps/`. Node est installé via **nvm** (Node 20) ; le binaire absolu (utile pour le cron, qui n'a pas nvm dans son PATH) est `/home/deploy/.nvm/versions/node/v20.20.2/bin/node`.
2. Copie la config : `cp vps/radar.env.example vps/radar.env` puis remplis `radar.env` (mêmes valeurs que Vercel ; `SUPABASE_KEY` = la clé *publishable* ; `SCRAPER_URL=http://localhost:8001`). **Ne committe jamais `radar.env`** (déjà dans `.gitignore`). Sur le VPS : `chmod 600 vps/radar.env`.
3. Test manuel : `cd ~/scrapProsp/vps && set -a && . ./radar.env && set +a && /home/deploy/.nvm/versions/node/v20.20.2/bin/node radar.mjs` → logs `+N metier/ville`, total, puis `SMS recap envoyé` (ou `Aucun nouveau prospect`).
4. Cron (3h du matin), `crontab -e` sous le user `deploy` (**chemin Node absolu obligatoire** — pas de nvm dans le PATH du cron) :
   ```cron
   0 3 * * * cd /home/deploy/scrapProsp/vps && set -a && . ./radar.env && set +a && /home/deploy/.nvm/versions/node/v20.20.2/bin/node radar.mjs >> /home/deploy/radar-cron.log 2>&1
   ```
5. Vérifie le lendemain : `tail -50 /home/deploy/radar-cron.log`.

Note : `vps/regionCities` est dupliqué dans `radar.mjs` (constante `REGION_CITIES`) — à garder en phase avec `app/lib/regionCities.ts` si tu changes les villes.
