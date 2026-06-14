# Funnel d'éligibilité par prospect (clone Lokads, version test)

Reproduit la mécanique de `lokads.fr/eligibilite` à l'échelle d'un prospect :
**génère un formulaire perso → SMS Twilio → remplissage → BDD → email "pris en compte"
→ page rapport (analyse auto Claude) → bouton "Lancer ma campagne" → 2e email.**

## Flow complet

```
1. POST /api/eligibilite/create { prospectId }
   → crée un lead + token, envoie un SMS Twilio avec le lien /eligibilite/{token}
2. Le prospect ouvre /eligibilite/{token}  (formulaire 9 étapes, métier+ville pré-remplis)
3. Submit → POST /api/eligibilite/submit
   → géocode (BAN data.gouv), génère l'analyse (Claude Haiku), enregistre en BDD,
     envoie l'email "Votre analyse est prête" (Resend), notifie Telegram
   → redirige vers /eligibilite/rapport/{id}
4. Page rapport : service ciblé, budget, demandes & CA estimés
5. Clic "Lancer ma campagne" → POST /api/eligibilite/launch
   → status=launched, 2e email "Votre compte est prêt"
```

## Setup (1 fois)

1. **Migration BDD :**
   ```bash
   node scripts/apply-migration-011.mjs
   ```
2. **Variables d'env** (`.env.local`, cf. `.env.example`) :
   - `SUPABASE_SECRET_KEY` — clé service_role (écritures funnel)
   - `NEXT_PUBLIC_APP_BASE_URL` — base des liens (vide en dev = localhost:3000)
   - `RESEND_API_KEY` — pour les emails (sans : emails en no-op, le reste marche)
   - `RESEND_FROM` — vide en test (= onboarding@resend.dev, n'envoie qu'à ton email Resend)
   - Twilio / Anthropic / Telegram : déjà en place.

## Tester en local

```bash
npm run dev

# 1. Générer le formulaire + SMS pour un prospect (dryRun = ne pas envoyer le SMS) :
curl -X POST http://localhost:3000/api/eligibilite/create \
  -H "Content-Type: application/json" \
  -d '{"prospectId":"<UUID_PROSPECT>","dryRun":true}'
# → renvoie { formUrl, message, leadId } ; ouvre formUrl dans le navigateur

# 2. Remplir le formulaire dans le navigateur → redirige vers la page rapport
# 3. Cliquer "Lancer ma campagne" → 2e email
```

Sans `dryRun`, le SMS part réellement via ton Messaging Service Twilio.

## Briques réutilisées

| Fichier | Rôle |
|---|---|
| `app/lib/eligibilite.ts` | config quiz, scoring, géocodage BAN, analyse Claude, templates email |
| `app/lib/email.ts` | wrapper Resend (no-op si pas de clé) |
| `app/lib/supabaseAdmin.ts` | client service_role (écritures serveur) |
| `app/api/eligibilite/{create,submit,launch}/route.ts` | les 3 endpoints |
| `app/eligibilite/[token]/` | formulaire (page + QuizForm client) |
| `app/eligibilite/rapport/[id]/` | page rapport + LaunchButton |
| `supabase/migration-011-eligibilite.sql` | table `eligibilite_leads` |

## Différences voulues vs Lokads

- **Géocodage** : BAN `api-adresse.data.gouv.fr` (gratuit, sans quota) au lieu de Nominatim.
- **Analyse** : générée par **Claude Haiku** (ta clé) au lieu de leur moteur serveur opaque.
- **Le "check ville libre"** reste du marketing (comme eux) — aucune base d'inventaire.
- **Étape "pas de site web"** : à brancher sur **ta** machine à maquettes (`/d/{code}`) plutôt
  que sur un partenaire externe — c'est ton avantage (voir ROADMAP quick win #1).

## Déclenchement depuis l'app

Le bouton **« Envoyer le formulaire d'éligibilité »** est dans la fiche prospect
(`CallModal`), visible **uniquement pour `source=ads`** (les cibles du scrape Ads).
Flux : clic → aperçu du SMS (dryRun, ne crée pas de lead) → « Envoyer le SMS »
appelle `/api/eligibilite/create` qui crée le lead et envoie le SMS Twilio.
Bouton « Copier le lien » dispo dans l'aperçu (utile si pas de mobile valide).

## Prochaines branches possibles

- À l'étape site web : si pas de site, afficher la **maquette démo live** du prospect.
- Cron de relance : si `status=report_viewed` et pas `launched` après 24 h → email/SMS de relance.
