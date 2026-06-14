# Comment répliquer le funnel Lokads avec TA stack (scrapProsp)

Tu as déjà 90 % des briques. Mapping direct :

| Brique Lokads | Ton équivalent existant | Action |
|---|---|---|
| Next.js + Vercel | scrapProsp = Next 15 sur Vercel | ✅ rien à faire |
| Server Actions pour le lead | tu utilises déjà des API routes / Supabase | ➕ ajouter 1 action `submitQuiz` |
| Supabase (lead store) | `NEXT_PUBLIC_SUPABASE_URL` déjà en place | ✅ nouvelle table `quiz_leads` |
| Géocodage ville (Nominatim) | tu géocodes déjà les villes dans `vps/scraper/main.py` (`geocode_ville`) | ✅ réutiliser |
| Quiz qualification | — | ➕ à créer (copie le leur, ci-dessous) |
| Upsell « site requis » | **tu génères déjà des maquettes/sites démo** (`/maquette`, 7 templates) | ⭐ ton avantage |
| Notif lead temps réel | Twilio + Telegram déjà branchés (`TELEGRAM_BOT_TOKEN`) | ✅ ping à chaque lead |

## 1. Le quiz (copie leur structure exacte, 8 questions + contact)

```
0 métier (texte)        → ciblage
1 ville (texte+géocode) → Nominatim: https://nominatim.openstreetmap.org/search?q={ville}&format=json&limit=1&countrycodes=fr
2 rayon (slider 0-50km)
3 site web (obligatoire) → si "pas de site" ⇒ propose TA maquette démo (ton edge vs Sendpage)
4 équipe   solo|2_5|6_15|gt_15
5 CA       lt_5k|5k_15k|15k_50k|gt_50k
6 budget   lt_500|500_1000|1000_3000|gt_3000
7 objectif plus_30|plus_50|plus_100|plus_200|double
8 contact  prénom*, nom, email*, téléphone*
```

⚠️ **Respecte Nominatim** : 1 req/s max, `User-Agent` identifiant ton app (sinon ban). Pour du volume,
self-host Nominatim sur ton VPS OVH, ou utilise l'API officielle gratuite **api-adresse.data.gouv.fr**
(BAN, sans limite, françois) : `https://api-adresse.data.gouv.fr/search/?q={ville}&type=municipality&limit=1`.

## 2. Schéma table Supabase (calque leur payload)

```sql
create table quiz_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  metier text, ville text, lat double precision, lon double precision,
  radius_km int, site_url text,
  employees_range text, ca_range text, ad_budget_range text, goal_range text,
  first_name text, last_name text, email text, phone text,
  utm_source text, utm_medium text, utm_campaign text,
  sid uuid,
  score int  -- scoring auto, voir §3
);
```

## 3. Le scoring implicite (leur vraie sauce)

Les 4 questions équipe/CA/budget/objectif servent à **prioriser le rappel commercial**.
Formule simple à reproduire :

```
score = poids(ca_range) + poids(ad_budget_range) + poids(goal_range)
ca:     lt_5k=1  5k_15k=2  15k_50k=3  gt_50k=4
budget: lt_500=1 500_1000=2 1000_3000=3 gt_3000=4
goal:   plus_30=1 plus_50=2 plus_100=3 plus_200=4 double=4
```
→ lead score ≥ 9 = chaud, rappel < 1 h. Tu peux router via Telegram (déjà branché).

## 4. Server Action (Next.js) — le cœur

```ts
'use server';
import { createClient } from '@supabase/supabase-js';
export async function submitQuiz(data: QuizPayload, sid: string) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const score = computeScore(data);
  const { data: row } = await db.from('quiz_leads').insert({ ...data, sid, score }).select().single();
  // notif Telegram instantanée (réutilise ton helper existant)
  await notifyTelegram(`🔥 Lead ${data.metier} ${data.ville} — score ${score} — ${data.phone}`);
  return { ok: true, id: row?.id };
}
```

## 5. Ton avantage décisif vs Lokads

Lokads renvoie les prospects **sans site** vers un partenaire (Sendpage) et perd la main.
**Toi, tu génères déjà le site démo personnalisé** (scrapProsp : maquettes live `/demo/{id}` avec
nom + avis Google + téléphone du prospect). Donc à l'étape 3 :
- prospect **avec** site → tu l'analyses (comme eux)
- prospect **sans** site → **tu lui montres SA maquette générée en direct** dans le quiz.
  C'est exactement le « moment WOW » de ta ROADMAP (`prospects.nmf-agence.fr/demo/{id}`).

→ Tu fusionnes leur funnel de qualification + ta machine à maquettes = funnel strictement supérieur.

## 6. Scripts de capture (réutilisables sur n'importe quel concurrent)

Dans ce dossier :
- `capture.mjs` — ouvre une page, dump CTA + inputs + réseau
- `walk2.mjs` — parcourt un funnel multi-étapes et logge chaque question
- `walk3.mjs` — **intercepte ET bloque** la soumission pour lire le payload sans créer de lead
- `actions.py` — extrait les IDs + noms de Server Actions Next.js des chunks
- lancer : `node walk3.mjs` (Chrome système via playwright-core, pas de download navigateur)

Pour scaler ce reverse-eng à d'autres concurrents, lance ces scripts depuis ton **VPS OVH**
(51.255.200.169, Playwright déjà installé) en changeant l'URL cible.
```
```
