# Google Calendar — setup du compte de service (une fois, ~5 min)

L'intégration agenda (page `/agenda`, création de RDV depuis la fiche, rappels
Telegram) passe par un **compte de service** Google : pas d'OAuth, pas de
consentement à renouveler. Le compte robot reçoit un accès en écriture à TON
agenda, c'est tout.

## 1. Créer le compte de service

1. [console.cloud.google.com](https://console.cloud.google.com) → créer un
   projet (ex. `scrapprosp-agenda`).
2. « API et services » → « Bibliothèque » → activer **Google Calendar API**.
3. « API et services » → « Identifiants » → « Créer des identifiants » →
   **Compte de service**. Nom libre, aucun rôle requis → Terminé.
4. Clique sur le compte créé → onglet **Clés** → « Ajouter une clé » →
   « Créer une clé » → **JSON**. Un fichier se télécharge : il contient
   `client_email` et `private_key`.

## 2. Partager ton agenda avec le compte de service

Dans [Google Calendar](https://calendar.google.com) (web) :
Paramètres → ton agenda (colonne de gauche) → « Partager avec des personnes
spécifiques » → Ajouter → colle le `client_email`
(`xxx@yyy.iam.gserviceaccount.com`) → autorisation
« **Apporter des modifications aux événements** ».

## 3. Variables d'environnement

Trois variables, tirées du JSON téléchargé :

```bash
GOOGLE_SA_EMAIL=xxx@yyy.iam.gserviceaccount.com
# La private_key du JSON, avec ses \n littéraux, entre guillemets :
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ…\n-----END PRIVATE KEY-----\n"
# L'ID de ton agenda = ton adresse Gmail (ou l'ID dans les paramètres de l'agenda)
GOOGLE_CALENDAR_ID=ton.email@gmail.com
```

À renseigner à **trois endroits** :

| Où | Fichier | Sert à |
|---|---|---|
| Local | `.env.local` | dev (`npm run dev`) |
| Vercel | Settings → Environment Variables | la page `/agenda` + création RDV en prod |
| VPS | `/home/deploy/scrapProsp/vps/radar.env` | les rappels Telegram (`agenda-notify.mjs`) |

Astuce : copie la `private_key` telle quelle depuis le JSON (avec les `\n`),
le code les convertit en vrais retours à la ligne.

## 4. Vérifier

- Ouvre `/agenda` : la grille de la semaine doit afficher tes événements.
- Crée un RDV depuis une fiche prospect (onglet « Caler un RDV ») : il
  apparaît dans Google Calendar sans ouvrir d'onglet.
- VPS : `node agenda-notify.mjs` à la main → le résumé du jour arrive sur
  Telegram (si tu as des RDV aujourd'hui). Le cron tourne ensuite toutes les
  10 min (6h-22h) : résumé du matin à ~7h + rappel ~1 h avant chaque RDV.

## Notes

- Les événements créés par l'app ont le compte de service comme organisateur,
  mais vivent dans TON agenda — visibles partout (mobile, web).
- Tant que les variables ne sont pas posées : la page `/agenda` affiche le
  guide de setup, le formulaire RDV retombe sur l'ancien comportement (onglet
  Google Calendar prérempli), et le cron VPS ne fait rien. Rien ne casse.
