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

## Radar de nouveaux prospects (script VPS — `vps/radar.mjs`)

Détecte chaque nuit les nouvelles fiches Google Maps (sans site web) par métier×région, les insère en base et envoie **1 SMS récap** au `0615907873` s'il y a ≥ 1 nouveau prospect.

> ⚠️ Le radar **ne tourne PAS sur Vercel** : il scrape ~27 combos × ~13 villes (~25-75 min), bien au-delà de la limite de 300 s des fonctions Vercel. Il s'exécute donc **sur le VPS** (où vit déjà le scraper), via Node ≥ 18 — aucune dépendance npm (il utilise les API REST Supabase + Twilio). L'ancien endpoint `/api/cron/radar` reste mais n'est plus le chemin de prod.

1. Sur le VPS, place le dépôt (ou au moins le dossier `vps/`) et installe Node ≥ 18 (`node -v`).
2. Copie la config : `cp vps/radar.env.example vps/radar.env` puis remplis `radar.env` (mêmes valeurs que Vercel ; `SUPABASE_KEY` = la clé *publishable* ; `SCRAPER_URL=http://localhost:8001`). **Ne committe jamais `radar.env`** (déjà dans `.gitignore`).
3. Test manuel : `cd vps && set -a && . ./radar.env && set +a && node radar.mjs` → logs `+N metier/ville`, total, puis `SMS recap envoyé` (ou `Aucun nouveau prospect`).
4. Cron (3h du matin), `crontab -e` sous le user `deploy` :
   ```cron
   0 3 * * * cd /chemin/vers/repo/vps && set -a && . ./radar.env && set +a && node radar.mjs >> /var/log/radar-cron.log 2>&1
   ```
5. Vérifie le lendemain : `tail -50 /var/log/radar-cron.log`.

Note : `vps/regionCities` est dupliqué dans `radar.mjs` (constante `REGION_CITIES`) — à garder en phase avec `app/lib/regionCities.ts` si tu changes les villes.
