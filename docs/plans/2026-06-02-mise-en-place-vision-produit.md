# Plan de mise en place — Vision produit (hors code)

> Date : 2026-06-02 · Source : `ROADMAP.md` (session `/innovate` 2026-06-01)
> Choix acté : **Twilio** comme fournisseur SMS + WhatsApp.
>
> Ce document liste **uniquement ce qui ne se code pas** : comptes à ouvrir, numéros à acheter,
> clés API à générer, DNS, conformité, validations métier. Le code (routes `/demo`, intégration
> Twilio, génération de script IA, etc.) sera fait dans un second temps — il consommera les valeurs
> produites ici via les variables d'environnement listées en §7.

---

## 0. État des lieux (ce qui existe déjà)

| Brique | État | Conséquence pour la mise en place |
|---|---|---|
| App Next.js 15 | ✅ déployable Vercel (cf. `DEPLOY.md`) | Rien à refaire, on ajoute des env vars |
| Supabase (prospects, competitor_reports) | ✅ migré | Ajouter 1-2 tables (consents / envois) |
| Scraper Google Maps | ✅ sur VPS (`SCRAPER_URL`) | Inchangé |
| WhatsApp | ⚠️ liens `wa.me` **manuels** (click-to-send) | Passe en **API Twilio** (auto) |
| Auth | 1 mot de passe partagé, cookie 90 j | Les routes `/demo/*` devront être **hors auth** |
| Score d'opportunité | ✅ fait | — |

---

## 1. Comptes & accès à ouvrir (prérequis)

À créer / vérifier avant tout développement :

1. **Twilio** — compte + (à terme) sortie du mode *trial*. → §2
2. **Anthropic (Claude API)** — pour le script d'appel IA (Haiku). → §5
3. **Domaine `nmf-agence.fr`** — accès au registrar (gestion DNS) pour le sous-domaine `prospects.`. → §4
4. **Vercel** — accès admin au projet `scrapProsp` (env vars + domaines).
5. **Supabase** — accès admin au projet (exécuter le SQL, voir la `service_role key`).
6. *(Plus tard, priorité basse)* **OpenAI** ou hébergement Whisper — transcription d'appel. → §6

---

## 2. Twilio — configuration SMS + WhatsApp (cœur du plan)

Twilio sert **deux canaux** de la roadmap :
- Quick win #2 « Relance WhatsApp auto » (envoi du lien `/demo/{id}`),
- Stratégique #5 « Tunnel inversé » (blast SMS/WhatsApp de masse).

### 2.A. Création & sécurisation du compte
- [ ] Créer le compte sur https://www.twilio.com/ (email pro `nmf-agence`).
- [ ] Activer la **2FA** sur le compte (numéros = argent réel).
- [ ] Noter l'**Account SID** et l'**Auth Token** (Console → Account Info).
      → deviendront `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
- [ ] **Recommandé** : créer une **API Key** dédiée (Console → Account → API keys & tokens)
      plutôt que d'utiliser l'Auth Token brut, pour pouvoir la révoquer sans tout casser.

### 2.B. Canal SMS (pour le blast / tunnel inversé)
- [ ] Acheter un **numéro français** capable d'envoyer des SMS
      (Console → Phone Numbers → Buy a number → France, capability *SMS*).
      ⚠️ En France l'envoi SMS A2P (application→personne) passe en pratique par un
      **Alphanumeric Sender ID** (ex. expéditeur = « NMF ») **ou** un numéro ; valider
      la disponibilité au moment de l'achat.
- [ ] Si Sender ID alphanumérique : le déclarer dans **Messaging → Sender IDs**.
      Limite connue : un Sender ID alphanumérique ne **reçoit pas** les réponses →
      pour le tunnel inversé (« répondez OUI ») il faut un **vrai numéro** qui reçoit.
      → **Décision à prendre** : numéro long FR (reçoit les OUI) recommandé pour le tunnel inversé.
- [ ] Créer un **Messaging Service** (Console → Messaging → Services) et y attacher le
      numéro / sender. C'est lui qu'on appellera côté code (meilleur scaling + opt-out géré).
      → deviendra `TWILIO_MESSAGING_SERVICE_SID`.
- [ ] Activer **Advanced Opt-Out** sur le Messaging Service (STOP/START gérés par Twilio) — obligation légale, cf. §8.

### 2.C. Canal WhatsApp (pour la relance auto)
Deux options — choisir selon l'urgence :

- **Option rapide (test/POC)** : **WhatsApp Sandbox** Twilio
  (Console → Messaging → Try it out → WhatsApp Sandbox).
  - [ ] Rejoindre le sandbox depuis ton téléphone (code « join … »).
  - Limite : seuls les numéros ayant rejoint le sandbox reçoivent → **OK pour tester, pas pour la prod**.

- **Option prod** : **WhatsApp Business via Twilio**
  - [ ] Avoir / créer un **compte Meta Business Manager** (Business verification).
  - [ ] Enregistrer un **WhatsApp Sender** (un numéro dédié, qui ne doit pas déjà être sur l'app WhatsApp).
  - [ ] Faire **vérifier le business** par Meta (peut prendre quelques jours).
  - [ ] Créer et faire **approuver au moins 1 template** de message (les 1ers messages sortants
        hors fenêtre 24 h doivent être des **templates approuvés**). Texte proposé à soumettre :
        > « Bonjour {{1}}, votre aperçu de site pour {{2}} est prêt : {{3}}. Intéressé(e) ? Répondez OUI. »
  - → le numéro WhatsApp deviendra `TWILIO_WHATSAPP_FROM` (format `whatsapp:+33…`).

> **Conséquence produit importante** : avec l'API WhatsApp officielle, on ne peut **pas** spammer
> librement. Le 1er contact = template approuvé. La relance #2 (lien démo) rentre dans ce cadre :
> on enverra le template « aperçu prêt + lien ». Le message libre n'est possible que dans les 24 h
> après une réponse du prospect.

### 2.D. Webhook réponses entrantes (tunnel inversé)
- [ ] Prévoir l'URL publique qui recevra les réponses (« OUI ») :
      `https://prospects.nmf-agence.fr/api/twilio/inbound` (la route sera codée ensuite).
- [ ] La renseigner dans Twilio : Messaging Service → Integration → *Incoming messages webhook*.
- [ ] Sécuriser via la **signature Twilio** (`X-Twilio-Signature`) → nécessite `TWILIO_AUTH_TOKEN` (déjà là).

### 2.E. Budget / quotas
- [ ] Mettre un **plafond de dépense** + alerte (Console → Billing → Usage triggers).
- Ordres de grandeur à valider le jour J (tarifs Twilio variables) :
  - SMS FR ≈ quelques centimes/SMS · WhatsApp template ≈ tarif « conversation » Meta.
  - Pour un blast de 200 démos/jour → estimer le coût mensuel avant de scaler.

---

## 3. Sites démo LIVE `/demo/{id}` — prérequis hors code

C'est le **pivot central** (quick win #1) : sans page démo publique, ni la relance WhatsApp ni
le tunnel inversé n'ont de lien à envoyer. À faire **en premier**.

Hors code, il faut décider / préparer :
- [ ] **Le sous-domaine public** : `prospects.nmf-agence.fr` (cf. §4).
- [ ] **Décision d'exposition des données** : une page `/demo/{id}` publique affiche nom du prospect,
      avis Google, téléphone. → Acter que ces données (déjà publiques sur Google Maps) peuvent être
      ré-affichées, et prévoir une mention + un moyen de retrait (cf. §8 RGPD).
- [ ] **Pas d'index Google** sur ces pages démo (éviter le duplicate / le référencement subi) :
      décision SEO = `noindex` (sera posé côté code, mais c'est une décision produit à acter ici).
- [ ] **Identité visuelle** : logo NMF + téléphone pour le footer « Site créé par NMF Agence »
      (quick win #3). Fournir le **logo (SVG/PNG)** et le **numéro à afficher**.

---

## 4. Domaine & DNS

- [ ] Dans le registrar de `nmf-agence.fr`, créer un enregistrement **CNAME**
      `prospects` → `cname.vercel-dns.com` (valeur exacte donnée par Vercel à l'ajout du domaine).
- [ ] Dans Vercel → projet → Settings → Domains → ajouter `prospects.nmf-agence.fr`.
- [ ] Attendre la propagation + le certificat HTTPS auto (quelques minutes à 1 h).
- [ ] Vérifier que `https://prospects.nmf-agence.fr/login` répond (app principale)
      et préparer le fait que `https://prospects.nmf-agence.fr/demo/<id>` sera **public**.

---

## 5. Script d'appel généré par IA (Claude Haiku) — prérequis

Quick support #6. Hors code :
- [ ] Créer une **clé API Anthropic** (console.anthropic.com → API Keys).
      → deviendra `ANTHROPIC_API_KEY`.
- [ ] Mettre un **budget mensuel** + alerte sur le compte Anthropic.
- [ ] Acter le **modèle** : `claude-haiku-4-5` (quasi gratuit, suffisant pour un pitch).
- [ ] Valider le **cadre de prompt** (ton commercial, longueur ~5 phrases, données injectées :
      nom, métier, ville, note Google, rapport concurrents). → décision produit, pas de code ici.

---

## 6. Transcription d'appel (Whisper) — priorité basse (1 mois+)

À **ne pas faire maintenant**, juste anticipé :
- [ ] Choisir : **OpenAI Whisper API** (clé `OPENAI_API_KEY`, simple) **vs** Whisper auto-hébergé sur le VPS (gratuit mais à maintenir).
- [ ] Vérifier la **conformité enregistrement d'appel** (consentement obligatoire en France — annonce de début d'appel). Décision légale à acter avant toute implémentation.

---

## 7. Variables d'environnement — récapitulatif à fournir

À renseigner dans **Vercel → Settings → Environment Variables** (et `.env.local` pour le dev) :

| Variable | Source | Pour |
|---|---|---|
| `AUTH_PASSWORD` | choisi par toi | déjà en place |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | déjà en place |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | déjà en place |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (Settings → API) | écritures serveur (consents/envois) — **secret** |
| `TWILIO_ACCOUNT_SID` | Twilio | SMS + WhatsApp |
| `TWILIO_AUTH_TOKEN` | Twilio | SMS + WhatsApp + signature webhook — **secret** |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio Messaging Service | SMS / blast |
| `TWILIO_WHATSAPP_FROM` | Twilio (`whatsapp:+33…`) | relance WhatsApp |
| `PUBLIC_BASE_URL` | `https://prospects.nmf-agence.fr` | construire les liens `/demo/{id}` |
| `ANTHROPIC_API_KEY` | Anthropic | script d'appel IA — **secret** |
| `OPENAI_API_KEY` *(plus tard)* | OpenAI | transcription Whisper — **secret** |

> Marquer tous les *secret* comme **non `NEXT_PUBLIC_`** : ils ne doivent jamais partir au navigateur.

---

## 8. Conformité (à acter avant d'envoyer le 1er message)

Envoyer du SMS/WhatsApp commercial en France = obligations réelles :

- [ ] **Opt-out SMS obligatoire** : tout SMS marketing doit contenir « STOP au xxxxx ».
      Géré par l'Advanced Opt-Out du Messaging Service (§2.B) — **à activer**.
- [ ] **Base légale RGPD** : prospects B2B (artisans/sociétés) → intérêt légitime possible,
      mais il faut **journaliser** les envois et permettre l'opposition. → table `message_log` + `opt_out` (§9).
- [ ] **Mention émetteur** : identifier NMF Agence dans le 1er message.
- [ ] **WhatsApp** : respecter les **templates approuvés** + la fenêtre 24 h (§2.C). Pas de spam libre.
- [ ] **Pages `/demo`** : mention « données issues de Google Maps, retrait sur simple demande » + contact.
- [ ] **Enregistrement d'appel (Whisper, plus tard)** : annonce + consentement obligatoires.

---

## 9. Supabase — ce qu'il faut préparer (mise en place data)

Hors code applicatif, mais à exécuter dans Supabase (SQL editor) avant le câblage :
- [ ] Récupérer la **`service_role key`** (écritures serveur sécurisées).
- [ ] Prévoir 2 tables (le SQL sera fourni avec le code, mais le besoin est acté ici) :
  - `message_log` : `id, prospect_id, channel (sms|whatsapp), template, status, twilio_sid, created_at`.
  - `opt_out` : `phone, reason, created_at` (anti-renvoi + preuve RGPD).
- [ ] Décider de la **politique RLS** sur ces tables (par défaut : accès serveur uniquement via service_role).

---

## 10. Séquencement recommandé (ordre de mise en place)

Du plus structurant au plus accessoire — chaque étape débloque la suivante :

1. **Domaine `prospects.nmf-agence.fr`** (§4) + logo/numéro NMF (§3) → débloque les pages démo.
2. **Pages `/demo/{id}` publiques** (code, mais dépend du domaine) → débloque tout envoi de lien.
3. **Twilio WhatsApp** (§2.C, option sandbox d'abord) → relance auto quick win #2.
4. **Anthropic** (§5) → script d'appel IA dans la CallModal (indépendant, peut se faire en //).
5. **Twilio SMS + Messaging Service + webhook entrant** (§2.B/2.D) → tunnel inversé #5.
6. **Tables Supabase + conformité opt-out** (§8/§9) → obligatoire avant le 1er blast de masse.
7. *(Plus tard)* **Whisper** (§6).

---

## 11. Checklist « prête à coder » (ce que je te demanderai)

Quand tu auras avancé, fournis-moi :
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (ou API Key), `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Le **sous-domaine** actif (`prospects.nmf-agence.fr` joignable en HTTPS)
- [ ] Le **logo NMF** + le **numéro de téléphone** à afficher en footer démo
- [ ] La **décision** SMS : Sender ID alphanumérique « NMF » **ou** numéro long FR (recommandé pour recevoir les « OUI »)
- [ ] Les **templates WhatsApp** soumis/approuvés côté Meta

→ Dès que ces valeurs existent, je câble le code (routes `/demo`, client Twilio, webhook, script IA, logging) sans rien te redemander.
