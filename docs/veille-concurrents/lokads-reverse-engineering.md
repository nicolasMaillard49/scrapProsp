# Reverse Engineering — lokads.fr/eligibilite

> Analyse réalisée le 2026-06-13. Méthode : récupération HTML/RSC, dump des chunks JS,
> navigateur headless (Playwright + Chrome) pour parcourir le funnel et intercepter le réseau.
> Aucune intrusion : la soumission finale du lead a été **interceptée et bloquée** côté client
> (aucun faux lead inséré dans leur base). Surface protégée seulement *mappée* (codes HTTP), jamais forcée.

## 1. Ce qu'est Lokads (le business)

Agence/SaaS **Google Ads pour services locaux**. Angle marketing = **exclusivité** :
« 1 seul client par métier × ville, premier arrivé seul servi ». Offre : 7 jours offerts,
puis **750 € TTC/mois** (prix fixe, pas de % du budget), sans engagement. Cible = artisans
(paysagiste, plombier, chiro, prothésiste dentaire, institut laser, conciergerie…).
**C'est un concurrent direct frontal de scrapProsp** (même cible, même promesse de leads locaux).

## 2. Stack technique

| Élément | Valeur |
|---|---|
| Framework | **Next.js (App Router)** + React Server Components |
| Hébergement | **Vercel** (`Server: Vercel`, `x-vercel-cache: HIT`, edge `cdg1` = Paris) |
| Rendu | Pages prerender ISR (`x-nextjs-prerender: 1`, stale 300 s) |
| Build / deploy | `buildId = vAqdtfdzfsrVm8dpfkU5m` · `x-deployment-id = dpl_BjWf9vtEekWPVSKa2y7VDNQ8RXD8` |
| Analytics | **GA4** `G-07SV1GL8MD` + une server action funnel maison |
| Géocodage | **Nominatim / OpenStreetMap** (gratuit) — voir §4 |
| Backend lead | **Server Actions** (pas d'API REST publique) |
| Auth admin | Panel `/admin` → redirige vers `/login?next=/admin` (existe, non public) |

Bundle client minimal : toute la logique sensible est en **Server Actions** (rien d'exploitable côté client).

## 3. Le funnel `/eligibilite` → `/eligibilite/quiz` (9 étapes)

La landing `/eligibilite` est 100 % marketing (aucun formulaire). Tous les CTA pointent vers
`/eligibilite/quiz`, un quiz client-side en 9 étapes :

| # | Question | Type | Sert à |
|---|---|---|---|
| 0 | Quel est votre métier ? | texte libre | ciblage campagne |
| 1 | Dans quelle ville exercez-vous ? | texte → **géocodé** | « exclusivité zone » |
| 2 | Quel rayon autour de {ville} ? | slider 0–50 km | ciblage géo |
| 3 | Adresse de votre site web ? | texte (**obligatoire**) | qualification |
| 4 | Combien dans l'équipe ? | choix : `solo / 2_5 / 6_15 / gt_15` | calibrage volume leads |
| 5 | CA mensuel actuel ? | choix : `lt_5k / 5k_15k / 15k_50k / gt_50k` | calcul ROI |
| 6 | Budget pub Google/mois ? | choix : `lt_500 / 500_1000 / 1000_3000 / gt_3000` | ticket |
| 7 | Objectif de croissance ? | choix : `plus_30 / plus_50 / plus_100 / plus_200 / double` | dimensionnement |
| 8 | Coordonnées | Prénom*, Nom, Email*, Téléphone* | capture lead |

**Qualification cachée :** à l'étape 3, si l'utilisateur clique « Je n'ai pas de site web »,
il est renvoyé sur `/eligibilite/site-requis` (« Sans site web, pas de campagne ») qui
**upsell un partenaire, Sendpage** (« votre site généré en 60 s par IA »). Ils refusent /
détournent les prospects sans site web et monétisent l'upsell.

## 4. ⭐ Le « check de ville » est du marketing, pas un vrai inventaire

Le pitch « votre ville est peut-être encore libre / premier arrivé seul servi » laisse croire
à une base de disponibilité en temps réel. **Faux.** À l'étape ville, le seul appel déclenché
est une server action de **géocodage** (`["Niort"]`) qui renvoie :

```json
{ "lat": 46.3239233, "lon": -0.4646064,
  "display_name": "Niort, Deux-Sèvres, Nouvelle-Aquitaine, France métropolitaine, 79000, France" }
```

→ format **exact de Nominatim (OpenStreetMap)**. Aucune requête vers une base « ville prise / libre ».
**La rareté est un levier de conversion (scarcity), pas un check d'inventaire.**

## 5. Les 3 Server Actions (réseau intercepté)

| Action | ID | Rôle |
|---|---|---|
| `recordFunnelStep` | `406ff08e4b20a2920a498e5f3fd9381b189fb81714` | analytics funnel (fire-and-forget) |
| *(géocodage)* | `40920f31c9066477f55f…` | `["ville"]` → Nominatim lat/lon |
| **`submitLokadsQuiz`** | `6001337bed0c66d8dcb53b1cf94a03a92c5ad4937a` | **insertion du lead** |

### Tracking funnel (chaque étape)
```json
POST /eligibilite/quiz   (Next-Action: 406ff08e…)
[{"sid":"<uuid localStorage 'lok_funnel_sid'>","event":"quiz_step",
  "stepIndex":N,"utm":{"source":…,"medium":…,"campaign":…},"referrer":…}]
```

### ⭐ Payload final du lead (`submitLokadsQuiz`) — schéma exact
```json
POST /eligibilite/quiz   (Next-Action: 6001337b…)
[{
  "metier":"Paysagiste",
  "ville":"Niort",
  "radius_km":10,
  "site_url":"https://exemple-paysagiste.fr",
  "employees_range":"solo",     // solo | 2_5 | 6_15 | gt_15
  "ca_range":"lt_5k",           // lt_5k | 5k_15k | 15k_50k | gt_50k
  "ad_budget_range":"lt_500",   // lt_500 | 500_1000 | 1000_3000 | gt_3000
  "goal_range":"plus_30",       // plus_30 | plus_50 | plus_100 | plus_200 | double
  "first_name":"Jean", "last_name":"…",
  "email":"…", "phone":"…",
  "utm_source":null, "utm_medium":null, "utm_campaign":null
}, "<sid-uuid>"]
```

## 6. Surface exposée (robots.txt) — mappée, non forcée
`Disallow: /admin/ /auth/ /api/ /vsl`
- `/admin` → 307 `/login?next=/admin` (back-office, auth-wall)
- `/auth`, `/api`, `/vsl` → 404 sur le chemin nu (sous-routes uniquement)
- Pages publiques (sitemap) : `/services /resultats /contact /blog/* /mentions-legales`

## 7. Verdict reverse-engineering

- **Tech** : Next.js + Vercel + Server Actions + Supabase (probable, côté serveur) + Nominatim gratuit.
- **Leur « moat » d'exclusivité = pur copywriting.** Le funnel ne vérifie aucune disponibilité ;
  il géocode juste et capture un lead qualifié (métier, zone, taille, CA, budget, objectif, contact).
- **Funnel = machine à leads qualifiés** : 8 questions de qualification → scoring implicite (CA × budget × objectif)
  → handoff commercial. Le « 750 €/mois prix fixe » + « 7 jours offerts » lèvent les 2 objections (prix, risque).
- **Qualification site web obligatoire + upsell Sendpage** = ils filtrent et monétisent les non-équipés.
