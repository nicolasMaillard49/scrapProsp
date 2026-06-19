# Instagram — hashtags petites-villes + export profils CSV — Design

> Date : 2026-06-20
> Statut : validé (brainstorming) → implémentation directe
> Se greffe sur le pipeline Insta existant (Apify, `instagram_prospects`, `/instagram`).

## Décisions validées
- **Pipeline complet** : métier → génère hashtags petites-villes → scrape profils → export CSV.
- **Seuil ville** : on exclut les communes **> 100 000 hab** (grandes villes). Vivier = 1 000–100 000.
- **CSV profils** : **tous** les profils scannés + colonne « a un site » (pas seulement les sans-site).
- **Stockage** : on **enrichit `instagram_prospects`** (email, tél…) + export depuis la base.
- **Champs profil** : maximum possible (actor Apify + extraction depuis la bio).

## 1. Données communes
- `scripts/fetch-communes.mjs` : fetch **geo.api.gouv.fr** (`/communes?fields=nom,population,codeDepartement`), filtre pop **1 000–100 000**, écrit `app/lib/data/communes-fr.json` (`{ nom, pop, dept }`, trié pop desc). ~10 000 entrées. Régénérable à la main.

## 2. Générateur de hashtags — `app/lib/hashtags.ts` (PUR, testé)
- `slugify(s)` : minuscules, sans accents, sans espaces/tirets/apostrophes/non-alphanum.
- `metierSynonyms(metier)` : étend les niches connues (coiffeur→coiffure, barbier, salondecoiffure ; restaurant→resto, restaurant ; etc.), sinon `[slug(metier)]`.
- `generateHashtags(metier, { maxPop=100000, minPop=1000, departments?, limitTowns? })`
  → `HashtagRow[]` : `{ hashtag, ville, population, dept, metier, pattern }`.
  - Patterns par (synonyme × ville) : `${metier}${ville}` et `${ville}${metier}`.
  - Dédup par `hashtag`. Tri par population desc (proxy d'activité IG).
  - `limitTowns` borne le nombre de communes prises (défaut : pas de limite, l'UI cape).

## 3. Extraction profil — `app/lib/apify.ts` + `app/lib/instagram.ts`
- **apify.ts** : `IgProfile` étendu (champs renvoyés par `apify~instagram-profile-scraper`) :
  `username, fullName, biography, externalUrl, externalUrls[], followersCount, followsCount,
  postsCount, businessCategoryName, isBusinessAccount, verified, private, profilePicUrl,
  businessEmail/public_email, businessPhoneNumber/public_phone_number`. On capture aussi le brut.
- **instagram.ts** (PUR, testé) :
  - `extractEmails(text)` : regex email → liste dédupliquée.
  - `extractPhonesFr(text)` : numéros FR (0X……, +33…, séparateurs variés) → format normalisé.
  - `pickContact(profile)` : email = champ actor (alias multiples) sinon 1er email de la bio ;
    phone idem. Renvoie `{ email, phone }`. C'est le cœur « IG email extractor ».

## 4. Migration `supabase/migration-015-instagram-enrichment.sql`
`ALTER TABLE instagram_prospects ADD COLUMN IF NOT EXISTS` :
`email text`, `phone text`, `follows_count int`, `posts_count int`,
`is_business boolean`, `verified boolean`, `has_website boolean`,
`profile_pic_url text`, `raw jsonb`. Dédup toujours par `username`.

## 5. Scrape multi-hashtags — route discover étendue
- `POST /api/instagram/discover` accepte `keepAll?: boolean` (défaut `false`).
  - `keepAll=false` (existant) : comportement DM inchangé (filtre sans-site).
  - `keepAll=true` (nouveau pipeline) : capture **tous** les profils, calcule `has_website`
    (= `hasRealWebsite`), remplit email/phone/posts/follows/verified/is_business/profile_pic_url/raw.
- Insertion incrémentale + dédup `username` conservées. Cap de profils/run conservé.
- Le pipeline UI appelle discover pour chaque hashtag sélectionné, en série, en cumulant.

## 6. Export CSV
- `app/lib/csv.ts` (PUR, testé) : `toCsv(headers, rows)` — échappement RFC 4180, **BOM UTF-8**
  (Excel FR), séparateur `;` (Excel FR).
- `GET /api/instagram/export?metier=&hasWebsite=` → CSV depuis `instagram_prospects`
  (colonnes : username, full_name, email, phone, followers, follows_count, posts_count,
  category, metier, ville, is_business, verified, a_un_site, external_url, profile_pic_url, bio).
- L'UI propose aussi un export CSV de la **liste de hashtags** générée (client-side via `toCsv`).

## 7. UI — `app/instagram/prospection/page.tsx` (+ composants client)
1. Champ **métier** + filtre **département** optionnel + nb de villes (cap).
2. **Générer les hashtags** → liste sélectionnable (tout / top 10), avec ville/pop/dept ;
   bouton **Export hashtags CSV**.
3. **Lancer la prospection** sur les N hashtags sélectionnés → barre de progression
   (hashtag courant, profils cumulés) ; appelle discover `keepAll=true` en série.
4. **Résumé** : X profils, Y avec email, Z sans site. Bouton **Export profils CSV**.
- Lien croisé avec `/instagram` (DM tool). Le `/instagram` filtre `has_website = false`/null
  pour garder sa sémantique « sans site ».

## 8. Tests
- `hashtags.test.ts` (slugify, synonymes, génération + dédup + tri + filtre dept).
- `csv.test.ts` (échappement, BOM, séparateur).
- `instagram.test.ts` (extractEmails, extractPhonesFr, pickContact alias + bio).

## 9. Conformité / coût
- Lecture seule via Apify (rien de grillé). Plafond profils/run conservé → coût borné.
- Données publiques B2B, volume modéré.
- Réserve : petites communes (<5k) ont peu de comptes IG → beaucoup de hashtags vides.
  Le tri par population met les plus actives en tête ; les hashtags sans résultat sont
  signalés, pas masqués.
