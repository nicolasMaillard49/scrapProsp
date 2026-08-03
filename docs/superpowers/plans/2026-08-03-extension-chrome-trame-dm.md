# Extension Chrome — Trame DM sur Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un side panel Chrome qui affiche la trame DM personnalisée du prospect Instagram à l'écran, insère le message dans le champ, et journalise l'envoi détecté dans l'app.

**Architecture:** Extension mince (MV3, side panel) : l'app Next.js reste la seule source de vérité (`instagramDmSequence`, `nextStepFor`, quotas). Nouvelle route `GET /api/instagram/trame` + auth par en-tête `x-ext-token` (le cookie `SameSite=Lax` ne voyage pas depuis `chrome-extension://`). Toute la fragilité DOM d'Instagram est isolée dans `extension/detect.js`. Le réseau passe exclusivement par le service worker (`background.js`) — les content scripts sont soumis au CORS de la page.

**Tech Stack:** Next.js (routes API existantes) · Supabase · extension MV3 vanilla JS (aucun bundler) · tests `node --test` + `tsx` + jsdom (fixtures DOM).

**Spec:** `docs/superpowers/specs/2026-08-03-extension-chrome-trame-dm-design.md`

## Global Constraints

- **L'extension n'envoie JAMAIS un DM** : aucun clic programmatique sur « Envoyer ». Elle écrit dans le champ, l'humain envoie.
- Manifest à **double déclaration** (Chrome + Firefox) : `background.service_worker` + `background.scripts`, `side_panel` + `sidebar_action`. Namespace `chrome.*` partout, jamais `browser.*`. Le seul appel spécifique Chrome (`chrome.sidePanel.setPanelBehavior`) est gardé par `if (chrome.sidePanel)`.
- Fichiers extension en **script classique CJS-compatible** (pas de modules ES — les content scripts MV3 se chargent en scope partagé via l'ordre du manifest). Export de test : `if (typeof module !== "undefined") module.exports = …`.
- Repo en CommonJS (pas de `"type": "module"`). Tests lib app : `node --import tsx --test app/lib/<f>.test.ts`. Tests extension : `node --test extension/*.test.mjs`.
- `EXT_TOKEN` absent/vide ⇒ la branche d'auth extension est **morte** (401), jamais un laissez-passer.
- Commits en français, style du repo (`feat(instagram): …`), signés `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Windows : `git add` + `git commit` via Bash tool avec heredoc `git commit -F - <<'EOF'`.

## File Structure

```
app/lib/extAuth.ts              (create)  décision d'auth pure, testée
app/lib/extAuth.test.ts         (create)
app/lib/igTrame.ts              (create)  construction pure de la réponse trame
app/lib/igTrame.test.ts         (create)
app/api/instagram/trame/route.ts (create) wrapper IO de igTrame
middleware.ts                   (modify)  branche x-ext-token avant le cookie
.env.example                    (modify)  EXT_TOKEN
extension/manifest.json         (create)  double déclaration Chrome/Firefox
extension/background.js         (create)  réseau + armement + idempotence
extension/util.js               (create)  dedupeKey/shouldLog purs, testés
extension/util.test.mjs         (create)
extension/detect.js             (create)  SEUL module couplé au DOM Instagram
extension/detect.test.mjs       (create)  fixtures jsdom
extension/content.js            (create)  observation SPA + insertion + watchSend
extension/sidepanel.html        (create)
extension/sidepanel.js          (create)
extension/options.html          (create)
extension/options.js            (create)
extension/README.md             (create)  installation + smoke test
```

---

### Task 1: Auth par en-tête `x-ext-token`

**Files:**
- Create: `app/lib/extAuth.ts`
- Test: `app/lib/extAuth.test.ts`
- Modify: `middleware.ts` (branche avant le contrôle cookie, après les routes ouvertes)
- Modify: `.env.example`

**Interfaces:**
- Produces: `isExtRequestAllowed(pathname: string, header: string | null, secret: string | undefined): boolean` — consommée par `middleware.ts` uniquement.

- [ ] **Step 1: Write the failing test**

```ts
// app/lib/extAuth.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isExtRequestAllowed } from "./extAuth";

test("extAuth: token exact sur /api/instagram/ → autorisé", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "s3cret", "s3cret"), true);
  assert.equal(isExtRequestAllowed("/api/instagram/dm", "s3cret", "s3cret"), true);
});

test("extAuth: EXT_TOKEN absent ou vide = branche MORTE, jamais un laissez-passer", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "", ""), false);
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "x", undefined), false);
  // Même un en-tête vide face à un secret vide ne passe pas.
  assert.equal(isExtRequestAllowed("/api/instagram/trame", null, ""), false);
});

test("extAuth: mauvais token ou en-tête manquant → refusé", () => {
  assert.equal(isExtRequestAllowed("/api/instagram/trame", "faux", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/api/instagram/trame", null, "s3cret"), false);
});

test("extAuth: portée bornée à /api/instagram/ — rien d'autre", () => {
  assert.equal(isExtRequestAllowed("/api/sms", "s3cret", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/api/eligibilite/create", "s3cret", "s3cret"), false);
  assert.equal(isExtRequestAllowed("/instagram", "s3cret", "s3cret"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test app/lib/extAuth.test.ts`
Expected: FAIL (module `./extAuth` introuvable)

- [ ] **Step 3: Write minimal implementation**

```ts
// app/lib/extAuth.ts
/**
 * Auth de l'extension Chrome — en-tête `x-ext-token` contre EXT_TOKEN.
 *
 * Le cookie `prospects-auth` est en SameSite=Lax : une requête émise depuis
 * l'origine chrome-extension:// est cross-site, Chrome ne le joint pas. On
 * reprend donc le motif des crons (x-cron-secret) : un en-tête custom, non
 * forgeable par un site tiers → aucune surface CSRF nouvelle.
 *
 * Portée volontairement bornée à /api/instagram/ : le token ne donne accès
 * à rien d'autre. Secret absent/vide = branche morte (refus), jamais un
 * laissez-passer.
 */
export function isExtRequestAllowed(
  pathname: string,
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!pathname.startsWith("/api/instagram/")) return false;
  return header === secret;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test app/lib/extAuth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Brancher le middleware**

Dans `middleware.ts` : ajouter l'import en tête, puis la branche **juste avant** `const auth = req.cookies.get(COOKIE_NAME);` (ligne ~64) — après la whitelist des routes ouvertes, avant le contrôle cookie :

```ts
import { isExtRequestAllowed } from "@/app/lib/extAuth";
```

```ts
  // Extension Chrome (side panel trame DM) : en-tête x-ext-token, borné à
  // /api/instagram/. Cf. app/lib/extAuth.ts pour le pourquoi (SameSite=Lax).
  if (isExtRequestAllowed(pathname, req.headers.get("x-ext-token"), process.env.EXT_TOKEN)) {
    return NextResponse.next();
  }
```

Dans `.env.example`, sous le bloc `CRON_SECRET` :

```bash
# Secret partagé avec l'extension Chrome « trame DM » (en-tête x-ext-token,
# portée /api/instagram/ uniquement). Vide = extension désactivée.
EXT_TOKEN=
```

- [ ] **Step 6: Vérifier typecheck + suite complète**

Run: `node node_modules/typescript/bin/tsc --noEmit` puis `node --import tsx --test app/lib/*.test.ts`
Expected: 0 erreur TS ; tous les tests passent (115 = 111 + 4)

- [ ] **Step 7: Commit**

```bash
git add app/lib/extAuth.ts app/lib/extAuth.test.ts middleware.ts .env.example
git commit -F - <<'EOF'
feat(instagram): auth extension par en-tete x-ext-token (borne a /api/instagram/)

Le cookie prospects-auth est en SameSite=Lax : invisible depuis une origine
chrome-extension://. Motif x-cron-secret repris : en-tete custom non
forgeable, secret vide = branche morte.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Lib pure `igTrame` — construction de la réponse

**Files:**
- Create: `app/lib/igTrame.ts`
- Test: `app/lib/igTrame.test.ts`

**Interfaces:**
- Consumes: `instagramDmSequence(p, demoLink)` et `detectMetier(a, b)`, `firstNameOf(fullName)` de `app/lib/instagram.ts` ; `nextStepFor(stage)` de `app/lib/igPipeline.ts` ; `shortCode(id)` de `app/lib/links.ts`.
- Produces (consommé par Task 3) :

```ts
export interface TrameProspect {
  id: string; username: string; full_name: string | null;
  bio: string | null; category: string | null; metier: string | null;
  ville: string | null; booking_platform: string | null;
  profession_ia: string | null; stage: string | null; status: string;
  followers: number | null; reply_count: number | null;
  next_followup_at: string | null; score_tier: string | null;
}
export interface TrameStep { step: string; title: string; text: string }
export interface TramePayload {
  prospect: TrameProspect | null;
  steps: TrameStep[];
  nextStep: string | null;
}
export function buildTrame(prospect: TrameProspect | null, origin: string): TramePayload;
```

- [ ] **Step 1: Write the failing test**

```ts
// app/lib/igTrame.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrame, type TrameProspect } from "./igTrame";

const laura: TrameProspect = {
  id: "a1b2c3d4-0000-0000-0000-000000000000",
  username: "laura_x", full_name: "Laura Dupont",
  bio: "Institut de beauté à Angers", category: "Beauty salon",
  metier: "estheticienne", ville: "Angers", booking_platform: "Planity",
  profession_ia: null, stage: "presentation", status: "contacted",
  followers: 1240, reply_count: 1, next_followup_at: null, score_tier: "hot",
};

test("igTrame: prospect connu → 12 étapes personnalisées + nextStep depuis le stade", () => {
  const t = buildTrame(laura, "https://prospects.nmf-agence.com");
  assert.equal(t.prospect?.username, "laura_x");
  assert.equal(t.steps.length, 12); // M1..M9 + R1..R3
  assert.equal(t.nextStep, "M5"); // presentation → M5 (nextStepFor)
  // Personnalisation réelle : le prénom apparaît dans l'accroche.
  const m1 = t.steps.find((s) => s.step === "M1")!;
  assert.match(m1.text, /Laura/);
  // Le lien de démo (M9 questionnaire n'en a pas ; il passe par le param
  // demoLink de la séquence) est construit sur /di/ + les 8 premiers chars.
  // On vérifie au moins qu'aucune étape ne contient "undefined".
  for (const s of t.steps) assert.ok(!s.text.includes("undefined"), s.step);
});

test("igTrame: sequence close (call_booke / perdu / questionnaire) → nextStep null", () => {
  assert.equal(buildTrame({ ...laura, stage: "call_booke" }, "").nextStep, null);
  assert.equal(buildTrame({ ...laura, stage: "perdu" }, "").nextStep, null);
  assert.equal(buildTrame({ ...laura, stage: "questionnaire_envoye" }, "").nextStep, null);
});

test("igTrame: prospect inconnu → trame générique, nextStep M1, prospect null", () => {
  const t = buildTrame(null, "https://x.test");
  assert.equal(t.prospect, null);
  assert.equal(t.steps.length, 12);
  assert.equal(t.nextStep, "M1");
  const m1 = t.steps.find((s) => s.step === "M1")!;
  assert.ok(m1.text.length > 10);
});

test("igTrame: metierEff — profession_ia prime, puis category+bio, puis metier", () => {
  // profession_ia précise → utilisée dans l'accroche (« vous étiez <noun> »)
  const withIa = buildTrame({ ...laura, profession_ia: "prothésiste ongulaire" }, "");
  assert.match(withIa.steps[0].text, /prothésiste ongulaire/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test app/lib/igTrame.test.ts`
Expected: FAIL (module `./igTrame` introuvable)

- [ ] **Step 3: Write minimal implementation**

```ts
// app/lib/igTrame.ts
// Construction PURE de la réponse « trame » servie à l'extension Chrome.
// Une seule source de vérité : instagramDmSequence — la même que la page
// /instagram (PipelineCard, TrameDM). Si une formulation change dans l'app,
// l'extension la sert à la requête suivante, sans republication.

import { instagramDmSequence, detectMetier, firstNameOf } from "./instagram";
import { nextStepFor } from "./igPipeline";
import { shortCode } from "./links";

export interface TrameProspect {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  category: string | null;
  metier: string | null;
  ville: string | null;
  booking_platform: string | null;
  profession_ia: string | null;
  stage: string | null;
  status: string;
  followers: number | null;
  reply_count: number | null;
  next_followup_at: string | null;
  score_tier: string | null;
}

export interface TrameStep {
  step: string;
  title: string;
  text: string;
}

export interface TramePayload {
  prospect: TrameProspect | null;
  steps: TrameStep[];
  nextStep: string | null;
}

/** Colonnes à sélectionner dans instagram_prospects pour ce payload. */
export const TRAME_COLUMNS =
  "id,username,full_name,bio,category,metier,ville,booking_platform,profession_ia,stage,status,followers,reply_count,next_followup_at,score_tier";

export function buildTrame(prospect: TrameProspect | null, origin: string): TramePayload {
  if (!prospect) {
    return {
      prospect: null,
      steps: instagramDmSequence({ metier: "", ville: "" }, ""),
      nextStep: "M1",
    };
  }
  // Même cascade que PipelineCard (app/instagram/page.tsx) : la profession IA
  // précise prime, puis la détection catégorie+bio, puis le métier stocké.
  const metierEff =
    detectMetier(prospect.profession_ia, null) ||
    detectMetier(prospect.category, `${prospect.username} ${prospect.bio ?? ""}`) ||
    prospect.metier ||
    "";
  const link = origin ? `${origin.replace(/\/$/, "")}/di/${shortCode(prospect.id)}` : "";
  return {
    prospect,
    steps: instagramDmSequence(
      {
        metier: metierEff,
        ville: prospect.ville ?? "",
        bookingPlatform: prospect.booking_platform,
        firstName: firstNameOf(prospect.full_name),
        professionIa: prospect.profession_ia,
      },
      link,
    ),
    nextStep: nextStepFor(prospect.stage),
  };
}
```

Note : si le test « profession_ia prime » échoue parce que `instagramDmSequence` met la profession IA en minuscules dans l'accroche, ajuster l'assertion (`/prothésiste ongulaire/i` est déjà insensible à la casse) — ne PAS modifier `instagramDmSequence`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test app/lib/igTrame.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/igTrame.ts app/lib/igTrame.test.ts
git commit -F - <<'EOF'
feat(instagram): lib pure igTrame — payload trame pour l'extension

Meme cascade metierEff que PipelineCard, meme instagramDmSequence, meme
nextStepFor : une seule source de verite, l'extension ne duplique rien.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Route `GET /api/instagram/trame`

**Files:**
- Create: `app/api/instagram/trame/route.ts`

**Interfaces:**
- Consumes: `buildTrame`, `TRAME_COLUMNS`, `TrameProspect` (Task 2) ; `getAccountsWithCounters(now)` de `app/lib/igCockpit.ts` (rend `{ id, username, status, started_at, notes, caps: { daily, day }, sentDay }[]`).
- Produces (consommé par `extension/background.js`, Task 7) — réponse JSON :

```jsonc
{
  "prospect": { /* TrameProspect */ } | null,
  "steps": [{ "step": "M1", "title": "…", "text": "…" }, …],
  "nextStep": "M5" | null,
  "accounts": [{ "id": "uuid", "username": "nmf.agence", "sentDay": 12,
                 "daily": 50, "canSend": true }]
}
```

- [ ] **Step 1: Write the route**

```ts
// app/api/instagram/trame/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { buildTrame, TRAME_COLUMNS, type TrameProspect } from "@/app/lib/igTrame";
import { getAccountsWithCounters } from "@/app/lib/igCockpit";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/trame?username=<u>
 * Unique source de données de l'extension Chrome (side panel trame DM).
 * Prospect inconnu → prospect:null + trame générique (le panneau propose
 * l'ajout). Auth : cookie OU en-tête x-ext-token (middleware).
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const username = (req.nextUrl.searchParams.get("username") ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

  try {
    const [prospectRes, accounts] = await Promise.all([
      username
        ? supabase.from("instagram_prospects").select(TRAME_COLUMNS).ilike("username", username).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getAccountsWithCounters(new Date()),
    ]);
    if (prospectRes.error) return NextResponse.json({ error: prospectRes.error.message }, { status: 500 });

    const payload = buildTrame((prospectRes.data as TrameProspect | null) ?? null, req.nextUrl.origin);
    return NextResponse.json({
      ...payload,
      accounts: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        sentDay: a.sentDay,
        daily: a.caps.daily,
        canSend: a.caps.daily > 0 && a.sentDay < a.caps.daily,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Vérifier typecheck + build**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3: Test manuel de la route (dev + token)**

Ajouter `EXT_TOKEN=test-local` à `.env.local`, lancer `npm run dev`, puis :

```bash
curl -s -H "x-ext-token: test-local" "http://localhost:3000/api/instagram/trame?username=laura_bullededouceur" | head -c 600
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/instagram/trame?username=x"   # sans token ni cookie
curl -s -o /dev/null -w "%{http_code}" -H "x-ext-token: faux" "http://localhost:3000/api/instagram/trame?username=x"
```

Expected: 1er appel → JSON avec `prospect`, `steps` (12), `nextStep`, `accounts` ; 2e et 3e → `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/instagram/trame/route.ts
git commit -F - <<'EOF'
feat(instagram): route GET /api/instagram/trame pour l'extension

Prospect par username (ilike) + trame construite par igTrame + comptes
emetteurs avec compteurs du jour. Prospect inconnu : trame generique.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Squelette de l'extension — manifest, options, background minimal

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/options.html`, `extension/options.js`
- Create: `extension/background.js` (version minimale, enrichie en Task 7)
- Create: `extension/sidepanel.html` (placeholder, remplacé en Task 8)

**Interfaces:**
- Produces: `chrome.storage.local` clés `appUrl` (string, ex. `https://prospects.nmf-agence.com`) et `extToken` (string) — consommées par `background.js` (Task 7).

- [ ] **Step 1: Write manifest.json**

```jsonc
// extension/manifest.json  (retirer ces commentaires — JSON strict)
{
  "manifest_version": 3,
  "name": "NMF — Trame DM Instagram",
  "version": "0.1.0",
  "description": "Affiche la trame DM du prospect à l'écran, insère le message, journalise l'envoi. N'envoie jamais.",
  "permissions": ["storage", "tabs", "sidePanel"],
  "host_permissions": ["https://www.instagram.com/*", "https://*.nmf-agence.com/*", "http://localhost:3000/*"],
  "background": {
    "service_worker": "background.js",
    "scripts": ["background.js"]
  },
  "content_scripts": [
    {
      "matches": ["https://www.instagram.com/*"],
      "js": ["detect.js", "content.js"],
      "run_at": "document_idle"
    }
  ],
  "side_panel": { "default_path": "sidepanel.html" },
  "sidebar_action": { "default_panel": "sidepanel.html", "default_title": "Trame DM" },
  "options_ui": { "page": "options.html", "open_in_tab": false },
  "action": { "default_title": "Trame DM" }
}
```

Note : `detect.js` et `content.js` n'existent pas encore — créer deux fichiers vides à ce stade pour que le chargement ne casse pas (contenu en Tasks 5-6).

- [ ] **Step 2: Write options page**

```html
<!-- extension/options.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <style>
    body { font: 13px system-ui; padding: 16px; width: 340px; color: #1e293b; }
    label { display: block; font-weight: 600; margin: 12px 0 4px; }
    input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
    button { margin-top: 14px; padding: 7px 14px; border: 0; border-radius: 6px; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }
    #status { margin-left: 8px; color: #059669; }
  </style>
</head>
<body>
  <h3>Trame DM — réglages</h3>
  <label for="appUrl">URL de l'app</label>
  <input id="appUrl" placeholder="https://prospects.nmf-agence.com" />
  <label for="extToken">EXT_TOKEN</label>
  <input id="extToken" type="password" placeholder="le secret EXT_TOKEN du .env" />
  <button id="save">Enregistrer</button><span id="status"></span>
  <script src="options.js"></script>
</body>
</html>
```

```js
// extension/options.js
const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["appUrl", "extToken"]).then(({ appUrl, extToken }) => {
  if (appUrl) $("appUrl").value = appUrl;
  if (extToken) $("extToken").value = extToken;
});

$("save").addEventListener("click", async () => {
  const appUrl = $("appUrl").value.trim().replace(/\/$/, "");
  const extToken = $("extToken").value.trim();
  await chrome.storage.local.set({ appUrl, extToken });
  $("status").textContent = "Enregistré ✓";
  setTimeout(() => ($("status").textContent = ""), 1500);
});
```

- [ ] **Step 3: Write minimal background + placeholder sidepanel**

```js
// extension/background.js — v. minimale (réseau en Task 7)
// Chrome : le clic sur l'icône ouvre le side panel. Gardé : Firefox n'a pas
// chrome.sidePanel (il a sidebar_action, déclaratif, rien à faire ici).
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
```

```html
<!-- extension/sidepanel.html — placeholder (UI réelle en Task 8) -->
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /></head>
<body><p style="font: 13px system-ui; padding: 12px;">Trame DM — en construction.</p>
<script src="sidepanel.js"></script></body></html>
```

```js
// extension/sidepanel.js — placeholder (Task 8)
```

Créer aussi `extension/detect.js` et `extension/content.js` **vides** (référencés par le manifest).

- [ ] **Step 4: Smoke test de chargement**

Chrome → `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → dossier `extension/`.
Expected: aucune erreur de manifest ; clic sur l'icône → le side panel s'ouvre sur « en construction » ; clic droit sur l'icône → Options → saisir URL + token → « Enregistré ✓ » persiste après réouverture.

- [ ] **Step 5: Commit**

```bash
git add extension/
git commit -F - <<'EOF'
feat(extension): squelette MV3 — manifest double declaration, options, panel

Manifest Chrome+Firefox (service_worker+scripts, side_panel+sidebar_action),
options EXT_TOKEN/URL en storage.local, side panel placeholder.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: `detect.js` — le seul module couplé au DOM d'Instagram

**Files:**
- Modify: `extension/detect.js` (créé vide en Task 4)
- Test: `extension/detect.test.mjs`
- Modify: `package.json` (devDependency `jsdom`)

**Interfaces:**
- Produces (global `NMFDetect`, consommé par `content.js` en Task 6) :

```js
NMFDetect.currentUsername(loc, doc)   // → string|null  pseudo de la conv/du profil
NMFDetect.composerNode(doc)           // → Element|null  contenteditable du champ
NMFDetect.loggedInAccount(doc)        // → string|null   pseudo du compte connecté
NMFDetect.watchSend(node, cb)         // → () => void    cb() quand rempli → vide ; rend un unwatch
```

Toutes rendent `null` (ou un no-op) quand rien ne matche — **jamais d'exception**.

- [ ] **Step 1: Installer jsdom**

Run: `npm install --save-dev jsdom`
Expected: ajouté à `devDependencies`, install OK.

- [ ] **Step 2: Write the failing tests (fixtures jsdom)**

```js
// extension/detect.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import NMFDetect from "./detect.js";

const dom = (html, url = "https://www.instagram.com/") => new JSDOM(html, { url });

test("currentUsername: page profil → pseudo depuis l'URL (stratégie la plus stable)", () => {
  const d = dom("<body></body>", "https://www.instagram.com/laura_x/");
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), "laura_x");
  // Les routes réservées ne sont PAS des profils.
  for (const p of ["direct/inbox", "explore", "reels", "accounts/edit", "p/abc123"]) {
    const r = dom("<body></body>", `https://www.instagram.com/${p}/`);
    assert.equal(NMFDetect.currentUsername(r.window.location, r.window.document), null, p);
  }
});

test("currentUsername: conversation DM → pseudo depuis le lien de profil du header", () => {
  const d = dom(
    `<body><header>
       <a role="link" href="/laura_x/"><img alt="Photo de profil de laura_x" /></a>
       <div>Laura Dupont</div>
     </header></body>`,
    "https://www.instagram.com/direct/t/1234567890/",
  );
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), "laura_x");
});

test("currentUsername: conversation sans header reconnaissable → null, sans jeter", () => {
  const d = dom("<body><div>rien</div></body>", "https://www.instagram.com/direct/t/999/");
  assert.equal(NMFDetect.currentUsername(d.window.location, d.window.document), null);
});

test("composerNode: contenteditable avec aria-label Message → trouvé ; sinon null", () => {
  const ok = dom(`<body><div contenteditable="true" aria-label="Message" role="textbox"></div></body>`);
  assert.ok(NMFDetect.composerNode(ok.window.document));
  const ko = dom(`<body><div>pas de champ</div></body>`);
  assert.equal(NMFDetect.composerNode(ko.window.document), null);
});

test("loggedInAccount: lien de nav vers son propre profil (img alt « photo de profil ») → pseudo", () => {
  const d = dom(
    `<body><nav><a href="/nmf.agence/"><img alt="Photo de profil de nmf.agence" /></a></nav></body>`,
  );
  assert.equal(NMFDetect.loggedInAccount(d.window.document), "nmf.agence");
  const vide = dom("<body></body>");
  assert.equal(NMFDetect.loggedInAccount(vide.window.document), null);
});

test("watchSend: déclenche quand le champ passe de rempli à vide, une seule fois", async () => {
  const d = dom(`<body><div contenteditable="true" aria-label="Message">brouillon</div></body>`);
  const node = NMFDetect.composerNode(d.window.document);
  let fired = 0;
  const unwatch = NMFDetect.watchSend(node, () => fired++, { intervalMs: 5, win: d.window });
  await new Promise((r) => setTimeout(r, 20)); // encore rempli → rien
  assert.equal(fired, 0);
  node.textContent = "";
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 1);
  node.textContent = "re-rempli"; node.textContent = "";
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 1, "one-shot : une détection par armement");
  unwatch();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test extension/detect.test.mjs`
Expected: FAIL (NMFDetect vide)

- [ ] **Step 4: Write implementation**

```js
// extension/detect.js
// ══════════════════════════════════════════════════════════════════════
// SEUL module couplé au DOM d'Instagram. Quand Instagram change son front,
// c'est ICI (et uniquement ici) qu'on répare. Chaque fonction essaie ses
// stratégies de la plus stable (URL, ARIA) à la plus fragile (arborescence),
// et rend null sans jamais jeter.
// Script classique (pas un module ES) : content scripts MV3 en scope partagé.
// ══════════════════════════════════════════════════════════════════════

const NMFDetect = (() => {
  // Segments de premier niveau qui ne sont PAS des profils.
  const RESERVED = new Set([
    "direct", "explore", "reels", "reel", "stories", "p", "accounts",
    "about", "developer", "legal", "session", "challenge", "graphql",
  ]);

  const clean = (s) => (s || "").replace(/^@/, "").trim().toLowerCase() || null;

  /** Pseudo depuis un href de profil ("/laura_x/" → "laura_x"). */
  function usernameFromHref(href) {
    const m = /^\/([A-Za-z0-9._]{2,30})\/?$/.exec(href || "");
    if (!m || RESERVED.has(m[1].toLowerCase())) return null;
    return clean(m[1]);
  }

  /** Pseudo du profil ou de la conversation ouverte. */
  function currentUsername(loc, doc) {
    try {
      const path = loc.pathname;
      // 1. Page profil : le pseudo est dans l'URL — la stratégie la plus stable.
      const direct = usernameFromHref(path);
      if (direct) return direct;
      // 2. Conversation (/direct/t/…) : lien de profil dans le header.
      if (/^\/direct\/t\//.test(path)) {
        const header = doc.querySelector("header");
        if (header) {
          for (const a of header.querySelectorAll("a[href]")) {
            const u = usernameFromHref(a.getAttribute("href"));
            if (u) return u;
          }
          // 3. Repli : alt de l'avatar « Photo de profil de <pseudo> ».
          const img = header.querySelector("img[alt]");
          const m = /photo de profil de (@?[A-Za-z0-9._]+)/i.exec(img?.getAttribute("alt") || "");
          if (m) return clean(m[1]);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Le contenteditable du champ de message. */
  function composerNode(doc) {
    try {
      return (
        doc.querySelector('div[contenteditable="true"][aria-label]') ||
        doc.querySelector('div[contenteditable="true"][role="textbox"]') ||
        null
      );
    } catch {
      return null;
    }
  }

  /** Pseudo du compte Instagram CONNECTÉ (lien nav vers son propre profil). */
  function loggedInAccount(doc) {
    try {
      const scopes = [doc.querySelector("nav"), doc].filter(Boolean);
      for (const scope of scopes) {
        for (const a of scope.querySelectorAll("a[href]")) {
          const alt = a.querySelector("img[alt]")?.getAttribute("alt") || "";
          if (/photo de profil|profile photo|profile picture/i.test(alt)) {
            const u = usernameFromHref(a.getAttribute("href"));
            if (u) return u;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Appelle cb() UNE fois quand le champ passe de rempli à vide (= envoyé).
   * Polling léger plutôt que MutationObserver : Instagram remplace parfois le
   * nœud entier à l'envoi, l'observer se retrouverait orphelin.
   */
  function watchSend(node, cb, opts = {}) {
    if (!node) return () => {};
    const intervalMs = opts.intervalMs ?? 300;
    const win = opts.win || (typeof window !== "undefined" ? window : null);
    if (!win) return () => {};
    let wasFilled = (node.textContent || "").trim().length > 0;
    let done = false;
    const id = win.setInterval(() => {
      if (done) return;
      const filled = (node.textContent || "").trim().length > 0;
      if (wasFilled && !filled) {
        done = true;
        win.clearInterval(id);
        try { cb(); } catch { /* le callback ne doit pas tuer le poll suivant */ }
      }
      wasFilled = filled;
    }, intervalMs);
    return () => { done = true; win.clearInterval(id); };
  }

  return { currentUsername, composerNode, loggedInAccount, watchSend, usernameFromHref };
})();

// Export de test (node) — inerte dans le navigateur.
if (typeof module !== "undefined") module.exports = NMFDetect;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test extension/detect.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add extension/detect.js extension/detect.test.mjs package.json package-lock.json
git commit -F - <<'EOF'
feat(extension): detect.js — la fragilite DOM Instagram isolee et testee

4 fonctions (pseudo courant, composer, compte connecte, detection d'envoi),
strategies de la plus stable (URL, ARIA) a la plus fragile, null sans jeter.
Fixtures jsdom : le seul fichier a reparer quand Instagram change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: `content.js` — observation SPA, insertion, détection d'envoi

**Files:**
- Modify: `extension/content.js` (créé vide en Task 4)

**Interfaces:**
- Consumes: global `NMFDetect` (Task 5, chargé avant lui par le manifest).
- Produces (messages runtime, consommés par background Task 7 / sidepanel Task 8) :
  - émet `{ type: "ig:prospect", username: string|null, account: string|null }` à chaque changement de conversation/profil ;
  - émet `{ type: "ig:sent" }` quand l'envoi est détecté (après armement) ;
  - reçoit `{ type: "ig:insert", text: string }` → répond `{ ok: boolean, reason?: "no-composer" }` et arme `watchSend`.

- [ ] **Step 1: Write content.js**

```js
// extension/content.js
// Observation de la SPA Instagram + insertion + détection d'envoi.
// AUCUN fetch ici (CORS de la page) : tout le réseau vit dans background.js.
// AUCUN clic programmatique sur « Envoyer » — l'humain envoie.

(() => {
  let lastAnnounced = "";
  let unwatch = () => {};

  /** Annonce le contexte courant (pseudo affiché + compte connecté). */
  function announce() {
    const username = NMFDetect.currentUsername(location, document);
    const account = NMFDetect.loggedInAccount(document);
    const key = `${username}|${account}`;
    if (key === lastAnnounced) return;
    lastAnnounced = key;
    chrome.runtime.sendMessage({ type: "ig:prospect", username, account }).catch(() => {});
  }

  // Instagram est une SPA : pas de rechargement entre conversations. On
  // surveille l'URL (léger) et on re-scanne peu après le changement, le temps
  // que le header de la conversation soit rendu.
  let lastHref = "";
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(announce, 800);
      setTimeout(announce, 2500); // 2e passe : header parfois lent à monter
    }
  }, 500);
  announce();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "ig:insert") {
      const node = NMFDetect.composerNode(document);
      if (!node) {
        sendResponse({ ok: false, reason: "no-composer" });
        return;
      }
      // Insertion via execCommand : Instagram (React/Lexical) ignore une
      // écriture directe de textContent — execCommand passe par le pipeline
      // d'édition du navigateur, que l'éditeur écoute.
      node.focus();
      const sel = window.getSelection();
      sel.selectAllChildren(node);
      document.execCommand("insertText", false, msg.text);
      // Arme la détection d'envoi (one-shot). Ré-armer remplace l'ancienne.
      unwatch();
      unwatch = NMFDetect.watchSend(node, () => {
        chrome.runtime.sendMessage({ type: "ig:sent" }).catch(() => {});
      });
      sendResponse({ ok: true });
    }
    // Le sidepanel peut demander un re-scan explicite (à son ouverture).
    if (msg?.type === "ig:rescan") {
      lastAnnounced = "";
      announce();
      sendResponse({ ok: true });
    }
  });
})();
```

- [ ] **Step 2: Vérifier au chargement réel**

Recharger l'extension (`chrome://extensions` → ↻), ouvrir `instagram.com`, ouvrir la console de la page → onglet « Sources » : `content.js` et `detect.js` listés sous l'extension ; aucune erreur console au chargement ni en naviguant profil → DM.

Expected: pas d'erreur ; (la preuve fonctionnelle complète arrive avec le panel, Task 8).

- [ ] **Step 3: Commit**

```bash
git add extension/content.js
git commit -F - <<'EOF'
feat(extension): content.js — observation SPA, insertion execCommand, watchSend

Annonce {username, account} a chaque navigation, insere via execCommand
(seule ecriture que l'editeur React d'Instagram percoit), arme la detection
d'envoi one-shot. Zero fetch, zero clic programmatique.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: `background.js` — réseau, armement, idempotence

**Files:**
- Modify: `extension/background.js` (minimal depuis Task 4)
- Create: `extension/util.js`
- Test: `extension/util.test.mjs`
- Modify: `extension/manifest.json` (si besoin : rien à ajouter — `storage` déjà permis)

**Interfaces:**
- Consumes: route Task 3 (`GET {appUrl}/api/instagram/trame?username=…`, en-tête `x-ext-token`) ; route existante `POST {appUrl}/api/instagram/dm` `{ prospect_id, account_id, step }` → 200 `{ ok, prospect, counters }` / 429 `{ error }`.
- Consumes (messages) : `ig:prospect`, `ig:sent` (content, Task 6) ; `ig:get-trame`, `ig:arm`, `ig:sent-manual` (sidepanel, Task 8).
- Produces (messages vers sidepanel) : `ig:prospect-changed { username, account }`, `ig:logged { ok, error?, counters? }`.
- Produces (`extension/util.js`, global `NMFUtil` + export CJS) :

```js
NMFUtil.dedupeKey(prospectId, step, now)            // → "sent:<id>:<step>:<YYYY-MM-DD>" (jour Paris)
NMFUtil.shouldLog(sentKeys, key)                    // → boolean (true si pas déjà journalisé)
NMFUtil.prune(sentKeys, max = 200)                  // → sentKeys tronqué aux plus récents
```

- [ ] **Step 1: Write the failing tests (util)**

```js
// extension/util.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import NMFUtil from "./util.js";

test("dedupeKey: cle par (prospect, step, jour Paris)", () => {
  const d = new Date("2026-08-03T10:00:00+02:00");
  assert.equal(NMFUtil.dedupeKey("abc", "M5", d), "sent:abc:M5:2026-08-03");
  // 23h30 Paris un 3 août = même jour Paris, même clé (pas le jour UTC).
  const soir = new Date("2026-08-03T23:30:00+02:00"); // 21:30 UTC
  assert.equal(NMFUtil.dedupeKey("abc", "M5", soir), "sent:abc:M5:2026-08-03");
});

test("shouldLog: une double detection ne journalise qu'une fois", () => {
  const keys = [];
  const k = NMFUtil.dedupeKey("abc", "M5", new Date());
  assert.equal(NMFUtil.shouldLog(keys, k), true);
  keys.push(k);
  assert.equal(NMFUtil.shouldLog(keys, k), false);
});

test("prune: garde les plus recents, borne la taille", () => {
  const keys = Array.from({ length: 250 }, (_, i) => `k${i}`);
  const pruned = NMFUtil.prune(keys, 200);
  assert.equal(pruned.length, 200);
  assert.equal(pruned[0], "k50");
  assert.equal(pruned[199], "k249");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test extension/util.test.mjs`
Expected: FAIL (util.js absent)

- [ ] **Step 3: Write util.js**

```js
// extension/util.js — helpers PURS du background (testés sous node).
const NMFUtil = (() => {
  /** Jour civil Europe/Paris — les quotas de l'app comptent en heure française. */
  function parisDay(now) {
    return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(now); // YYYY-MM-DD
  }
  function dedupeKey(prospectId, step, now) {
    return `sent:${prospectId}:${step}:${parisDay(now)}`;
  }
  function shouldLog(sentKeys, key) {
    return !sentKeys.includes(key);
  }
  function prune(sentKeys, max = 200) {
    return sentKeys.length <= max ? sentKeys : sentKeys.slice(sentKeys.length - max);
  }
  return { dedupeKey, shouldLog, prune };
})();
if (typeof module !== "undefined") module.exports = NMFUtil;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test extension/util.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Write background.js complet**

```js
// extension/background.js
// TOUT le réseau de l'extension vit ici : émis du service worker, couvert par
// host_permissions → ni CORS ni préflight. Les content scripts n'appellent rien.
importScripts("util.js");

if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

/** Réglages saisis dans les options. */
async function settings() {
  const { appUrl, extToken } = await chrome.storage.local.get(["appUrl", "extToken"]);
  return { appUrl: appUrl || "", extToken: extToken || "" };
}

async function api(path, init = {}) {
  const { appUrl, extToken } = await settings();
  if (!appUrl || !extToken) return { status: 0, json: { error: "Extension non configurée (options : URL + EXT_TOKEN)." } };
  try {
    const res = await fetch(`${appUrl}${path}`, {
      ...init,
      headers: { "x-ext-token": extToken, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, json: { error: `App injoignable : ${e.message}` } };
  }
}

// ── Armement : posé par le sidepanel à « Insérer », consommé à « ig:sent ».
// storage.session : survit à la mort du service worker (MV3), meurt avec le
// navigateur — exactement la durée de vie d'une session de prospection.
async function getArmed() {
  const { armed } = await chrome.storage.session.get("armed");
  return armed || null;
}
async function setArmed(armed) {
  await chrome.storage.session.set({ armed });
}

/** Journalise un envoi, idempotent par (prospect, step, jour Paris). */
async function logSend(armed) {
  const { sentKeys = [] } = await chrome.storage.local.get("sentKeys");
  const key = NMFUtil.dedupeKey(armed.prospectId, armed.step, new Date());
  if (!NMFUtil.shouldLog(sentKeys, key)) {
    return { ok: true, deduped: true }; // double détection : déjà compté
  }
  const { status, json } = await api("/api/instagram/dm", {
    method: "POST",
    body: JSON.stringify({ prospect_id: armed.prospectId, account_id: armed.accountId, step: armed.step }),
  });
  if (status === 200 && json.ok) {
    await chrome.storage.local.set({ sentKeys: NMFUtil.prune([...sentKeys, key]) });
    return { ok: true, counters: json.counters };
  }
  return { ok: false, error: json.error || `Erreur ${status}` };
}

const broadcast = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      // content.js : la conversation/le profil affiché a changé.
      case "ig:prospect":
        await chrome.storage.session.set({ current: { username: msg.username, account: msg.account } });
        broadcast({ type: "ig:prospect-changed", username: msg.username, account: msg.account });
        sendResponse({ ok: true });
        break;
      // sidepanel : donne-moi la trame de ce pseudo (ou le contexte courant).
      case "ig:get-trame": {
        const { current } = await chrome.storage.session.get("current");
        const username = msg.username ?? current?.username ?? "";
        const { status, json } = await api(`/api/instagram/trame?username=${encodeURIComponent(username)}`);
        sendResponse({ status, data: json, context: current || null });
        break;
      }
      // sidepanel : « Insérer » cliqué — pose l'armement puis insère via content.
      case "ig:arm": {
        await setArmed({ prospectId: msg.prospectId, accountId: msg.accountId, step: msg.step });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ ok: false, reason: "no-tab" }); break; }
        const r = await chrome.tabs.sendMessage(tab.id, { type: "ig:insert", text: msg.text }).catch(() => null);
        sendResponse(r ?? { ok: false, reason: "no-content-script" });
        break;
      }
      // content.js : envoi détecté → journalise avec l'armement en cours.
      case "ig:sent": {
        const armed = await getArmed();
        if (!armed) { sendResponse({ ok: false, reason: "not-armed" }); break; }
        await setArmed(null); // consommé : une détection par armement
        const result = await logSend(armed);
        broadcast({ type: "ig:logged", ...result });
        sendResponse(result);
        break;
      }
      // sidepanel : filet manuel (« Envoyé ») — même chemin, même idempotence.
      case "ig:sent-manual": {
        await setArmed(null);
        const result = await logSend({ prospectId: msg.prospectId, accountId: msg.accountId, step: msg.step });
        broadcast({ type: "ig:logged", ...result });
        sendResponse(result);
        break;
      }
      default:
        sendResponse({ ok: false, reason: "unknown" });
    }
  })();
  return true; // réponse asynchrone
});
```

Note Firefox (event page, pas de `importScripts` dans un contexte window) : le manifest charge `background.scripts: ["background.js"]` — remplacer alors `importScripts("util.js")` par une déclaration double : `"scripts": ["util.js", "background.js"]` dans le manifest **et** garder `importScripts` sous garde :

```js
if (typeof importScripts === "function" && typeof NMFUtil === "undefined") importScripts("util.js");
```

Mettre à jour le manifest en conséquence : `"background": { "service_worker": "background.js", "scripts": ["util.js", "background.js"] }`.

- [ ] **Step 6: Vérifier au chargement + suite tests extension**

Run: `node --test extension/*.test.mjs` → PASS (9 tests).
Recharger l'extension : `chrome://extensions` → « Voir les vues » → service worker → console sans erreur.

- [ ] **Step 7: Commit**

```bash
git add extension/util.js extension/util.test.mjs extension/background.js extension/manifest.json
git commit -F - <<'EOF'
feat(extension): background — reseau, armement storage.session, idempotence

GET trame / POST dm avec x-ext-token depuis le service worker (pas de CORS).
Armement pose a l'insertion, consomme a l'envoi detecte (one-shot, survit a
la mort du SW). Idempotence par (prospect, step, jour Paris), testee.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Side panel — l'UI de la trame

**Files:**
- Modify: `extension/sidepanel.html` (remplace le placeholder)
- Modify: `extension/sidepanel.js` (remplace le placeholder)

**Interfaces:**
- Consumes (messages, Task 7) : `ig:get-trame` → `{ status, data: { prospect, steps, nextStep, accounts }, context }` ; `ig:arm` ; `ig:sent-manual` ; broadcasts `ig:prospect-changed`, `ig:logged`.
- Règles spec § 8 : compte apparié par pseudo → imposé ; aucun match → **rien n'est journalisé** tant qu'un compte n'est pas choisi ; compte au plafond → insertion permise, journalisation avertie (429 rendu par l'app).

- [ ] **Step 1: Write sidepanel.html**

```html
<!-- extension/sidepanel.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: light dark; }
    body { font: 13px/1.45 system-ui; margin: 0; padding: 10px 12px; color: light-dark(#1e293b, #e2e8f0); background: light-dark(#fff, #0f172a); }
    h1 { font-size: 14px; margin: 0 0 2px; }
    .muted { color: light-dark(#64748b, #94a3b8); font-size: 11.5px; }
    .warn { color: #d97706; font-size: 11.5px; }
    .err { color: #e11d48; font-size: 12px; }
    select { width: 100%; margin-top: 4px; padding: 4px; }
    .step { border: 1px solid light-dark(#e2e8f0, #334155); border-radius: 8px; padding: 8px; margin-top: 8px; }
    .step.next { border-color: #4f46e5; box-shadow: 0 0 0 1px #4f46e533; }
    .step .head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
    .step .tag { font-weight: 700; color: #4f46e5; font-size: 11px; }
    .step.relance .tag { color: light-dark(#64748b, #94a3b8); }
    .step .now { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #4f46e5; }
    .step p { margin: 4px 0 6px; white-space: pre-line; font-size: 12px; }
    .step button { font: 600 11px system-ui; padding: 4px 8px; border-radius: 6px; border: 1px solid light-dark(#cbd5e1, #475569); background: none; color: inherit; cursor: pointer; }
    .step button.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
    #fallback { display: none; margin-top: 10px; padding: 8px; border: 1px solid #d97706; border-radius: 8px; }
    #fallback button { width: 100%; padding: 6px; font-weight: 700; background: #d97706; border: 0; border-radius: 6px; color: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <h1 id="title">Trame DM</h1>
  <div id="sub" class="muted">Ouvre une conversation Instagram…</div>
  <div id="account"></div>
  <div id="error" class="err"></div>
  <div id="fallback">
    <div class="warn">Envoi non détecté. Si tu as bien envoyé le message :</div>
    <button id="manualSent">Envoyé — journaliser</button>
  </div>
  <div id="steps"></div>
  <script src="sidepanel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write sidepanel.js**

```js
// extension/sidepanel.js
// UI de la trame. État minimal : la trame affichée + l'armement local (pour
// le filet manuel). Le vrai état (quota, stade) vit dans l'app — on refetch.
const $ = (id) => document.getElementById(id);

let state = {
  username: null,      // pseudo affiché sur instagram.com
  igAccount: null,     // pseudo du compte Instagram connecté (détecté)
  data: null,          // { prospect, steps, nextStep, accounts }
  accountId: null,     // compte émetteur retenu pour journaliser
  lastArm: null,       // { prospectId, accountId, step } — filet manuel
  fallbackTimer: null,
};

const STAGE_LABEL = {
  accroche: "Accroche envoyée", presentation: "Présentation", connexion: "Connexion",
  douleur: "Douleur", appel_propose: "Appel proposé", questionnaire_envoye: "Questionnaire envoyé",
  call_booke: "Call booké ✓", perdu: "Perdu",
};

async function refresh(username) {
  const r = await chrome.runtime.sendMessage({ type: "ig:get-trame", username });
  if (!r || r.status === 0) { $("error").textContent = r?.data?.error || "Extension non configurée."; return; }
  if (r.status === 401) { $("error").textContent = "401 — EXT_TOKEN invalide (options de l'extension / .env de l'app)."; return; }
  if (r.status !== 200) { $("error").textContent = r.data?.error || `Erreur ${r.status}`; return; }
  $("error").textContent = "";
  state.username = username ?? r.context?.username ?? null;
  state.igAccount = r.context?.account ?? state.igAccount;
  state.data = r.data;
  // § 8 : compte émetteur DÉTECTÉ — apparié par pseudo, sinon choix explicite.
  const match = r.data.accounts.find((a) => a.username === state.igAccount);
  state.accountId = match ? match.id : null;
  render();
}

function render() {
  const { data, username } = state;
  if (!data) return;
  const p = data.prospect;
  $("title").textContent = p ? `@${p.username}` : username ? `@${username} (hors base)` : "Trame générique";
  $("sub").textContent = p
    ? `${STAGE_LABEL[p.stage] ?? "Jamais contacté"} · ${p.metier ?? "métier ?"} · ${p.ville ?? "ville ?"}`
    : username
      ? "Compte inconnu de la base — trame générique, rien ne sera journalisé."
      : "Aucune conversation détectée — trame générique.";
  renderAccount();
  renderSteps();
}

function renderAccount() {
  const { data, igAccount, accountId } = state;
  const el = $("account");
  const match = data.accounts.find((a) => a.id === accountId);
  if (match) {
    const full = !match.canSend;
    el.innerHTML = `<div class="${full ? "warn" : "muted"}">Émetteur : @${match.username} — ${match.sentDay}/${match.daily} aujourd'hui${full ? " · PLAFOND : la journalisation sera refusée (429)" : ""}</div>`;
    return;
  }
  // Aucun match : choix explicite obligatoire (§ 8 — jamais deviné).
  el.innerHTML = `<div class="warn">Compte connecté${igAccount ? ` @${igAccount}` : ""} non déclaré dans l'app — choisis l'émetteur :</div>
    <select id="accountSelect"><option value="">— choisir —</option>
    ${data.accounts.map((a) => `<option value="${a.id}">@${a.username} (${a.sentDay}/${a.daily})</option>`).join("")}</select>`;
  $("accountSelect").addEventListener("change", (e) => { state.accountId = e.target.value || null; render(); });
}

function renderSteps() {
  const { data, accountId } = state;
  const p = data.prospect;
  $("steps").innerHTML = data.steps.map((s) => {
    const isNext = s.step === data.nextStep;
    const relance = s.step.startsWith("R");
    return `<div class="step ${isNext ? "next" : ""} ${relance ? "relance" : ""}">
      <div class="head"><span class="tag">${s.step} · ${s.title}</span>${isNext ? '<span class="now">à envoyer</span>' : ""}</div>
      <p>${s.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
      <button data-copy="${s.step}">Copier</button>
      ${p ? `<button class="primary" data-insert="${s.step}" ${accountId ? "" : 'title="Choisis un émetteur pour journaliser — l\'insertion reste possible"'}>Insérer</button>` : ""}
    </div>`;
  }).join("");

  for (const b of document.querySelectorAll("[data-copy]")) {
    b.addEventListener("click", () => {
      const s = data.steps.find((x) => x.step === b.dataset.copy);
      navigator.clipboard.writeText(s.text);
      b.textContent = "Copié ✓"; setTimeout(() => (b.textContent = "Copier"), 1200);
    });
  }
  for (const b of document.querySelectorAll("[data-insert]")) {
    b.addEventListener("click", () => insert(b.dataset.insert));
  }
}

async function insert(step) {
  const { data, accountId } = state;
  const p = data.prospect;
  const s = data.steps.find((x) => x.step === step);
  if (!p || !s) return;
  // Sans émetteur : on insère quand même (copier-coller assisté), mais on
  // n'arme PAS la journalisation — § 8, jamais deviné.
  if (!accountId) {
    await chrome.runtime.sendMessage({ type: "ig:arm", prospectId: p.id, accountId: "", step, text: s.text })
      .then(() => chrome.storage.session.set({ armed: null })); // désarme aussitôt
    $("error").textContent = "Inséré SANS journalisation (aucun émetteur choisi).";
    return;
  }
  const r = await chrome.runtime.sendMessage({ type: "ig:arm", prospectId: p.id, accountId, step, text: s.text });
  if (!r?.ok) {
    $("error").textContent = r?.reason === "no-composer"
      ? "Champ de message introuvable — ouvre la conversation, ou copie-colle."
      : "Onglet Instagram introuvable.";
    return;
  }
  $("error").textContent = "";
  state.lastArm = { prospectId: p.id, accountId, step };
  // Filet § 7 : si aucun ig:logged sous 5 s après l'envoi supposé, bouton manuel.
  clearTimeout(state.fallbackTimer);
  state.fallbackTimer = setTimeout(() => { $("fallback").style.display = "block"; }, 5000);
}

$("manualSent").addEventListener("click", async () => {
  if (!state.lastArm) return;
  const r = await chrome.runtime.sendMessage({ type: "ig:sent-manual", ...state.lastArm });
  if (r?.ok) { $("fallback").style.display = "none"; refresh(state.username); }
  else $("error").textContent = r?.error || "Journalisation refusée.";
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ig:prospect-changed") {
    $("fallback").style.display = "none";
    clearTimeout(state.fallbackTimer);
    state.igAccount = msg.account ?? state.igAccount;
    refresh(msg.username);
  }
  if (msg?.type === "ig:logged") {
    clearTimeout(state.fallbackTimer);
    $("fallback").style.display = "none";
    if (msg.ok) refresh(state.username); // stade avancé → nextStep suivant surligné
    else { $("error").textContent = msg.error || "Journalisation refusée."; $("fallback").style.display = "block"; }
  }
});

// Au montage : demande un re-scan au content script puis charge le contexte.
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "ig:rescan" }).catch(() => {});
  refresh(null);
})();
```

- [ ] **Step 3: Vérification fonctionnelle sur Instagram réel**

Recharger l'extension. Sur `instagram.com`, ouvrir une conversation d'un prospect **présent en base** :
1. Le panel affiche `@pseudo`, son stade, l'étape `nextStep` encadrée « à envoyer » — comparer avec la vue pipeline de l'app (même prospect, même étape attendue).
2. « Copier » → colle le bon texte.
3. « Insérer » → le texte apparaît dans le champ Instagram. **Ne pas envoyer** → au bout de ~5 s le bandeau « Envoi non détecté » apparaît (filet OK). Vider le champ à la main déclenche `ig:sent` → journalisation : vérifier dans l'app que le stade a avancé et le compteur du jour +1.
4. Recommencer sur le même step le même jour → le panel refetch, `deduped` : le compteur ne bouge PAS (idempotence).
5. Profil hors base → « hors base », trame générique, pas de bouton Insérer avec journalisation.

Si l'étape 1 échoue (pseudo non détecté) : ajuster les stratégies dans `detect.js` **uniquement**, relancer `node --test extension/detect.test.mjs` après ajustement.

- [ ] **Step 4: Commit**

```bash
git add extension/sidepanel.html extension/sidepanel.js
git commit -F - <<'EOF'
feat(extension): side panel — trame personnalisee, etape courante, filet manuel

Prospect + stade + 12 messages avec nextStep surligne. Compte emetteur
apparie par pseudo, sinon choix explicite (jamais devine) ; plafond signale.
Insertion armee, filet « Envoye » a 5 s, refetch apres journalisation.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: README, .gitignore build, vérification finale

**Files:**
- Create: `extension/README.md`
- Modify: aucun autre (vérifications globales)

- [ ] **Step 1: Write README**

```markdown
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
```

- [ ] **Step 2: Vérification globale**

Run:
```bash
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test app/lib/*.test.ts app/lib/**/*.test.ts
node --test extension/*.test.mjs
npm run build
```
Expected: 0 erreur TS · tous les tests app (119 = 111 + 4 extAuth + 4 igTrame) · 9 tests extension · build OK.

- [ ] **Step 3: Commit + push (Vercel déploie la route et le middleware)**

```bash
git add extension/README.md
git commit -F - <<'EOF'
docs(extension): README — installation, regles encodees, reparation detect.js

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
git push origin main
```

- [ ] **Step 4: Configuration prod (action Nicolas, à rappeler à la fin)**

- Générer un secret : `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
- L'ajouter en `EXT_TOKEN` : `.env.local` **et** Vercel (Production) → redéployer.
- Le saisir dans les options de l'extension avec l'URL prod.

---

## Self-Review (fait à l'écriture)

- **Spec § 3** (auth token, borné, branche morte) → Task 1. **§ 4** (route, payload, inconnu → générique) → Tasks 2-3. **§ 5** (structure, réseau au background, double manifest) → Tasks 4, 7. **§ 6** (detect.js, 4 fonctions, replis, fixtures) → Task 5. **§ 7** (flux, filet 5 s, idempotence) → Tasks 6-8. **§ 8** (compte détecté, jamais deviné, plafond signalé) → Tasks 7-8. **§ 9** (garde-fous : aucun envoi auto — aucun code ne clique) → transversal, vérifié Task 8 Step 3. **§ 10** (tests) → Tasks 1, 2, 5, 7. **§ 11** hors périmètre respecté (pas de signature Firefox, pas de Store).
- « Ajouter aux prospects » (spec § 4, prospect inconnu) : le panel affiche « hors base » sans bouton d'ajout — **écart assumé et signalé** : l'ajout depuis l'extension exigerait la résolution du profil (source RapidAPI) ; à traiter séparément si le besoin se confirme à l'usage. Le panel reste utilisable (trame générique + copier).
- Types cohérents : `TramePayload`/`TRAME_COLUMNS` (Task 2) consommés tels quels en Task 3 ; messages `ig:*` identiques entre Tasks 6, 7, 8 ; `accounts[].canSend/sentDay/daily` (Task 3) consommés en Task 8.
```
