# Roadmap & Vision produit

> Session `/innovate` du 2026-06-01 — transformer le tracker de prospection (scraping Google Maps + enrichissement SIRENE + analyse concurrents + maquettes) en **machine à conversion** : des sites démo *live* par prospect, envoyés automatiquement, et n'appeler que ceux qui ont déjà vu leur futur site.

**Pitch unifié :** *« Pas un CRM de prospection — une usine qui fabrique 100 sites démo personnalisés par jour, les envoie automatiquement, et ne te met au téléphone qu'avec des gens qui ont déjà vu leur futur site. »*

---

## 🟢 Quick wins (1-2 j)

### 1. Sites démo LIVE (au lieu des PNG)
Chaque maquette devient une page publique : `prospects.nmf-agence.fr/demo/{id}`, affichant le vrai nom du prospect, ses avis Google et son téléphone.
- ~80 % du code existe déjà.
- Rendre `/maquette` public (route non auth-walled) + servir les 7 templates en page live au lieu d'un screenshot PNG.

> **Impact :** le moment où le prospect *voit* son site live pendant l'appel, tu n'es plus un démarcheur à froid mais « le gars qui a déjà fait leur site ».

### 2. Relance WhatsApp auto
Statut `no_answer` / « à rappeler » ⇒ envoi auto d'un WhatsApp contenant le lien démo.
- `whatsAppUrl()` injecte le lien `/demo/{id}` dans le template de message.

> **Impact :** le prospect voit son site avant de rappeler ; tu appelles quelqu'un déjà chaud.

### 3. Footer NMF sur chaque démo
« Site créé par NMF Agence » + téléphone, discret, sur chaque template de démo.

> **Impact :** quand le prospect partage le lien (comptable, associé), le branding NMF circule gratuitement. Boucle virale intégrée.

---

## 🎯 Stratégique (2-7 j)

### 4. Score d'opportunité — ✅ FAIT (2026-06-01)
Implémenté dans `app/lib/opportunity.ts`. Score 0-100 = probabilité d'achat :
- Visibilité (mauvaise note / pas de site) · 35
- Âge de la boîte · 20
- Âge du dirigeant · 20
- Effectif · 15
- RGE · 10

Tri par défaut + chip 🔥 (chaud / tiède / froid) avec raisons en tooltip.
Distribution actuelle : **66 chauds / 674 tièdes / 213 froids**.

> **Impact :** appeler les 20 plus chauds, pas 200 à l'aveugle → 10x le taux de conversion par heure d'appel.

### 5. Tunnel inversé (inbound au lieu de cold call)
Générer 200 démos en batch ⇒ blast SMS/WhatsApp de masse : *« Votre site est prêt, regardez : [lien]. Intéressé ? Répondez OUI. »* ⇒ n'appeler que ceux qui répondent.
- Besoin : génération batch des démos + API SMS (Brevo / Twilio).

> **Impact :** les prospects s'auto-qualifient ; plus de temps brûlé sur les « non ».

---

## 🧰 Support

### 6. Script d'appel généré par IA
Ouverture de la CallModal ⇒ Claude Haiku (quasi gratuit) génère un pitch personnalisé à partir des champs prospect + rapport concurrents :
> *« Je vois que Plomberie Martin a 3,2★/8 avis quand [concurrent] en a 120, et vous n'avez pas de site. J'ai déjà fait une maquette… »*

> **Impact :** chaque appel démarre avec le bon angle, appuyé sur la donnée, sans improvisation.

### 7. Transcription d'appel → auto-remplissage *(priorité basse, 1 mois+)*
Whisper transcrit l'appel, remplit les notes, détecte le sentiment, suggère le statut suivant. Zéro saisie entre deux appels.

---

## 🔜 Next step
Explorer l'écosystème **API data.gouv** pour de l'enrichissement complémentaire avant de lancer les chantiers ci-dessus.

---

## Checklist

- [ ] **Sites démo live** `/demo/{id}` (pivot central — quick win #1)
- [ ] **Relance WhatsApp auto** avec lien démo (quick win #2)
- [ ] **Footer NMF** sur les templates de démo (quick win #3)
- [ ] **Tunnel inversé** : génération batch + blast SMS (Brevo / Twilio)
- [ ] **Script d'appel IA** (Claude Haiku) dans la CallModal
- [ ] **Transcription d'appel** (Whisper) — priorité basse
- [ ] Explorer les API **data.gouv** pour enrichissement complémentaire
- [x] Score d'opportunité ✅ 2026-06-01
