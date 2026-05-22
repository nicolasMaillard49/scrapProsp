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
