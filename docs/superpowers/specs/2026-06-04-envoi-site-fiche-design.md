# Envoi « livraison du site » depuis la fiche prospect — Design

> 2026-06-04 — Bouton dans la fiche (CallModal) pour envoyer un SMS unitaire « voici le site que j'ai fait pour vous » (ton chaleureux, pas de prospection à froid), avec aperçu + confirmation. Distinct du blast de prospection.

## Décisions actées

- **Message** : ton proche, prénom du dirigeant, **sans mention STOP** (clients consentants ; le Messaging Service Twilio gère l'opt-out STOP au niveau infra de toute façon). Avec accents (coût négligeable en unitaire).
- **UX** : clic → **aperçu** du message réel (texte + segments) → 2e clic **confirme** l'envoi.
- **Statut** : après envoi, le prospect passe en `sms_sent` (déjà géré côté serveur par `markProspectSmsSent`, qui n'écrase pas positif/négatif/called). La fiche se rafraîchit via le **realtime** Supabase de `useProspects`.

## Architecture

Réutilise le socle existant : `/api/sms` envoie déjà à des ids précis, logge dans `sms_messages` et bascule en `sms_sent`. On ajoute juste un **2e template** et un **aperçu**.

### 1. Message — `app/lib/sms.ts`

Nouvelle fonction `deliverySmsMsg(p: SmsProspect, demoLink: string): string` :

```
Salut {Prénom}, c'est Nicolas de NMF Agence. Voici le site que je vous ai préparé : {demoLink} — dites-moi ce que vous en pensez !
```

- Prénom via `ownerSalutation` adaptée (« Salut Alexis ») ; sans prénom → « Bonjour, ».
- Pas de ligne STOP.

### 2. Endpoint — `app/api/sms/route.ts`

- Accepte `template?: 'sales' | 'delivery'` (défaut `'sales'` → le blast et l'existant ne changent pas).
- Sélectionne `salesSmsMsg` ou `deliverySmsMsg` selon `template`.
- Ajoute `message` (le texte) dans chaque objet `results` → permet l'aperçu côté client (source de vérité serveur, pas de duplication du template).

### 3. Fiche — `app/components/CallModal.tsx`

Bouton **« Envoyer le site par SMS »** (sous la grille WhatsApp/Tel) :

1. **État `idle`** : bouton violet. Clic → `POST /api/sms { ids:[id], template:'delivery', dryRun:true }`.
2. **État `preview`** : encart montrant `results[0].message` + `segments` + coût estimé ; bouton « Envoyer » + « Annuler ».
3. **Clic Envoyer** → `POST /api/sms { ids:[id], template:'delivery' }` (réel). Succès → toast/encart « SMS envoyé », statut passe en `sms_sent` (realtime). Erreur → message rouge.

État local au composant : `smsState: 'idle'|'preview'|'sending'|'sent'|'error'`, `smsPreview`, `smsError`. Réinitialisé à la fermeture / changement de prospect.

## Hors scope (YAGNI)

- Édition libre du message dans la fiche (template fixe pour l'instant).
- Choix du template depuis l'UI du blast (le blast reste `sales`).

## Fichiers

| Fichier | Changement |
|---|---|
| `app/lib/sms.ts` | + `deliverySmsMsg()` |
| `app/api/sms/route.ts` | param `template`, `message` dans `results` |
| `app/components/CallModal.tsx` | bouton + aperçu + envoi |

## Critères de succès

- Depuis la fiche, clic → aperçu du vrai message (avec prénom + lien court) + nb segments.
- Confirmation → SMS reçu, ligne `outbound` dans `sms_messages` (visible dans `/sms`), prospect en `sms_sent`.
- Le blast de prospection (`template` absent → `sales`) est inchangé.
