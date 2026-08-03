# Extension Chrome — Trame DM Instagram

Side panel qui affiche la trame DM du prospect ouvert sur instagram.com,
insère le message dans le champ (l'humain envoie), et journalise l'envoi
détecté dans l'app (quota, stade, relance).

## Installation (Chrome / Edge / Brave)

1. `chrome://extensions` → activer le **mode développeur**.
2. « Charger l'extension non empaquetée » → choisir ce dossier `extension/`.
3. Clic droit sur l'icône → **Options** :
   - URL de l'app : `https://<ton-domaine-vercel>` (ou `http://localhost:3000`)
   - EXT_TOKEN : la valeur de `EXT_TOKEN` du `.env` de l'app (Vercel + `.env.local`).
4. Ouvrir instagram.com, cliquer l'icône → le panel s'ouvre.

## Règles encodées

- L'extension **n'envoie jamais** : elle écrit dans le champ, tu envoies.
- Journalisation idempotente par (prospect, étape, jour Paris) : une double
  détection ne consomme pas deux crédits de chauffe.
- Compte émetteur apparié au compte Instagram connecté ; sans correspondance
  dans `ig_accounts`, rien n'est journalisé tant que tu n'as pas choisi.
- Les plafonds restent arbitrés par l'app (`POST /api/instagram/dm` → 429).

## Quand Instagram casse la détection

Tout le couplage DOM vit dans `detect.js` (4 fonctions). Réparer là, puis :
`node --test extension/detect.test.mjs`

## Tests

`node --test extension/*.test.mjs`

## Firefox (préparé, non activé)

Le manifest déclare déjà `background.scripts` et `sidebar_action`. Reste la
signature Mozilla (une extension non signée ne survit pas au redémarrage) —
hors périmètre tant que le besoin n'existe pas.
