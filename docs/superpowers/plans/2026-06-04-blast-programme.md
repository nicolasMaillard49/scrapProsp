# Blast SMS programmé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Pas de test runner dans ce repo** → vérification = `npx tsc --noEmit` + `npm run build` + contrôle runtime (convention des plans précédents). Pas de tests unitaires à écrire.

**Goal:** Permettre de programmer depuis `/sms` un envoi SMS (date/heure + nombre de prospects) qui part automatiquement à l'heure dite via un cron VPS.

**Architecture:** Table `scheduled_blasts` (source de vérité). La logique d'envoi de `/api/blast` est extraite dans `app/lib/blast.ts::runBlast` et réutilisée par un endpoint moteur `/api/cron/run-blasts`, appelé chaque minute par un cron VPS (protégé par `CRON_SECRET`). UI cliente dans `/sms` pour créer/annuler les envois, avec aperçu coût + solde Twilio.

**Tech Stack:** Next.js 15 App Router, Supabase JS, Twilio SDK, Tailwind v4, lucide-react, `pg` (migration).

---

### Task 1 : Migration table `scheduled_blasts`

**Files:**
- Create: `supabase/migration-005-scheduled-blasts.sql`
- Create: `scripts/apply-migration-005.mjs`
- Modify: `package.json` (script `migrate:005`)

- [ ] **Step 1 : Écrire le SQL**

`supabase/migration-005-scheduled-blasts.sql` :
```sql
-- Journal des envois programmés (blast SMS planifié, déclenché par cron VPS).
create table if not exists scheduled_blasts (
  id           uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,                 -- échéance (UTC ; saisie en heure de Paris)
  limit_count  int not null check (limit_count > 0),  -- nb de prospects à viser
  status       text not null default 'pending',       -- pending | running | done | failed | canceled
  result       jsonb,                                  -- {sent, failed, totalSegments, pool, targeted, error?}
  created_at   timestamptz not null default now(),
  executed_at  timestamptz
);

create index if not exists idx_scheduled_blasts_due on scheduled_blasts (status, scheduled_at);

-- Realtime (comme prospects/sms_messages). Ignore l'erreur si déjà publiée.
do $$ begin
  alter publication supabase_realtime add table scheduled_blasts;
exception when others then null;
end $$;
```

- [ ] **Step 2 : Écrire le script d'application** (calque exact de `scripts/apply-migration-004.mjs`)

`scripts/apply-migration-005.mjs` :
```js
// Applique supabase/migration-005-scheduled-blasts.sql.
// DDL impossible via les clés API → connexion Postgres directe.
// Requiert SUPABASE_DB_URL (mode Session) dans l'environnement ou .env.local.
//   node scripts/apply-migration-005.mjs

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ SUPABASE_DB_URL manquant dans .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  console.log("✓ Connecté à Postgres");
  const sql = readFileSync(resolve(ROOT, "supabase", "migration-005-scheduled-blasts.sql"), "utf-8");
  await client.query(sql);
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'scheduled_blasts'",
  );
  console.log(`✓ Migration 005 appliquée — table scheduled_blasts (${rows[0].n} colonnes)`);
} catch (err) {
  console.error("❌ Échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 3 : Ajouter le script npm** dans `package.json` (section `scripts`) :
```json
"migrate:005": "node scripts/apply-migration-005.mjs",
```

- [ ] **Step 4 : Appliquer la migration**

Pré-requis : `SUPABASE_DB_URL` dans `.env.local` (connection string Session, récupérable dans le vault Obsidian `prospects-tracker.md` ou Supabase → Settings → Database). Format :
`postgresql://postgres.<ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`

Run: `node scripts/apply-migration-005.mjs`
Expected: `✓ Migration 005 appliquée — table scheduled_blasts (7 colonnes)`

- [ ] **Step 5 : Commit**
```bash
git add supabase/migration-005-scheduled-blasts.sql scripts/apply-migration-005.mjs package.json
git commit -m "feat(blast): table scheduled_blasts + script migration 005"
```

---

### Task 2 : Extraire la logique d'envoi dans `app/lib/blast.ts`

**Files:**
- Create: `app/lib/blast.ts`
- Modify: `app/api/blast/route.ts` (devient un wrapper)

- [ ] **Step 1 : Créer `app/lib/blast.ts`** (déplace la logique de `/api/blast`, comportement identique)

```ts
import { supabase } from "./supabase";
import { twilioClient, twilioConfigured, messagingServiceSid } from "./twilio";
import { toE164, salesSmsMsg, smsSegments } from "./sms";
import { shortCode } from "./links";
import { logOutboundSms, markProspectSmsSent } from "./smsLog";

export interface BlastResult {
  pool: number;
  targeted: number;
  sent: number;
  failed: number;
  totalSegments: number;
  results: Array<{ id: string; name: string; ok: boolean; to?: string; segments?: number; sid?: string; error?: string }>;
}

/** Erreur métier du blast (mappée en code HTTP par les routes). */
export class BlastError extends Error {
  constructor(public code: "OUT_OF_WINDOW" | "TWILIO_UNCONFIGURED", message: string) {
    super(message);
  }
}

export interface RunBlastOpts {
  limit?: number | null;
  offset?: number;
  force?: boolean;
  dryRun?: boolean;
  base: string; // base publique pour les liens démo (ex. https://prospects.nmf-agence.com)
}

/** Heure de Paris (gère l'heure d'été via Intl) -> { hour, day(0=dim) }. */
function parisNow(): { hour: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", weekday: "short", hour12: false });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 1;
  return { hour, day };
}

/**
 * Blast de prospection : sélection todo + mobiles uniques, garde-fou légal Paris
 * (8h-20h hors dimanche, sauf force), envoi via Messaging Service, journalisation
 * + bascule prospect en sms_sent + statusCallback. Lève BlastError sur garde-fou.
 */
export async function runBlast(opts: RunBlastOpts): Promise<BlastResult> {
  const { limit = null, offset = 0, force = false, dryRun = false, base } = opts;

  if (!dryRun && !force) {
    const { hour, day } = parisNow();
    if (day === 0 || hour < 8 || hour >= 20) {
      throw new BlastError("OUT_OF_WINDOW", `Hors créneau légal (8h-20h Paris, hors dimanche). Heure Paris: ${hour}h, jour: ${day}.`);
    }
  }
  if (!dryRun && !twilioConfigured) {
    throw new BlastError("TWILIO_UNCONFIGURED", "Twilio non configuré");
  }

  // Sélection : todo, mobiles uniques (ordre stable par id)
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("prospects")
      .select("id, name, metier, ville, phone, dirigeant_prenom, dirigeant_nom")
      .eq("status", "todo")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < 1000) break;
  }

  const seen = new Set<string>();
  const cibles = rows.filter((p) => {
    const e164 = toE164(p.phone as string);
    if (!e164 || seen.has(e164)) return false;
    seen.add(e164);
    return true;
  });

  let lot = cibles.slice(offset);
  if (limit != null) lot = lot.slice(0, limit);

  const client = dryRun ? null : twilioClient();
  const results: BlastResult["results"] = [];

  for (const p of lot) {
    const to = toE164(p.phone as string);
    const link = `${base}/d/${shortCode(p.id as string)}`;
    const message = salesSmsMsg(
      {
        name: p.name as string,
        metier: p.metier as string,
        ville: p.ville as string,
        dirigeant_prenom: p.dirigeant_prenom as string | null,
        dirigeant_nom: p.dirigeant_nom as string | null,
      },
      link,
    );
    const segments = smsSegments(message);
    if (!to) {
      results.push({ id: p.id as string, name: p.name as string, ok: false, error: "Numéro non mobile" });
      continue;
    }
    if (dryRun) {
      results.push({ id: p.id as string, name: p.name as string, ok: true, to, segments });
      continue;
    }
    try {
      const msg = await client!.messages.create({ messagingServiceSid, to, body: message, statusCallback: `${base}/api/sms/status` });
      await logOutboundSms({ prospectId: p.id as string, to, body: message, segments, sid: msg.sid });
      await markProspectSmsSent(p.id as string);
      results.push({ id: p.id as string, name: p.name as string, ok: true, to, segments, sid: msg.sid });
    } catch (e) {
      results.push({ id: p.id as string, name: p.name as string, ok: false, to, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const totalSegments = results.reduce((n, r) => n + (r.ok ? r.segments ?? 0 : 0), 0);
  return { pool: cibles.length, targeted: lot.length, sent, failed: results.length - sent, totalSegments, results };
}
```

- [ ] **Step 2 : Réécrire `app/api/blast/route.ts`** en wrapper (même réponse JSON qu'avant)

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/app/lib/supabase";
import { runBlast, BlastError } from "@/app/lib/blast";

function demoBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  return env ? env.replace(/\/$/, "") : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  let body: { limit?: number; offset?: number; dryRun?: boolean; force?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    const r = await runBlast({
      limit: typeof body.limit === "number" ? body.limit : null,
      offset: typeof body.offset === "number" ? body.offset : 0,
      dryRun: body.dryRun === true,
      force: body.force === true,
      base: demoBase(req),
    });
    return NextResponse.json({ dryRun: body.dryRun === true, ...r, results: r.results.slice(0, 5) });
  } catch (e) {
    if (e instanceof BlastError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "OUT_OF_WINDOW" ? 423 : 503 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit` → exit 0. Tester en dryRun que le comportement est inchangé :
Run: `node scripts/blast-sms.mjs --limit 1`
Expected: `1 ok, 0 ko` (dryRun, rien envoyé).

- [ ] **Step 4 : Commit**
```bash
git add app/lib/blast.ts app/api/blast/route.ts
git commit -m "refactor(blast): extraction runBlast dans app/lib/blast.ts"
```

---

### Task 3 : API `/api/scheduled-blasts` (create / list / cancel)

**Files:**
- Create: `app/api/scheduled-blasts/route.ts`
- Create: `app/api/scheduled-blasts/[id]/route.ts`

- [ ] **Step 1 : Créer `app/api/scheduled-blasts/route.ts`** (POST = créer, GET = lister)

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { data, error } = await supabase
    .from("scheduled_blasts")
    .select("id, scheduled_at, limit_count, status, result, created_at, executed_at")
    .order("scheduled_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blasts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  let body: { scheduledAt?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const limit = Number(body.limit);
  const at = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!Number.isInteger(limit) || limit <= 0) {
    return NextResponse.json({ error: "Nombre de prospects invalide" }, { status: 400 });
  }
  if (!at || Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Date/heure invalide" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("scheduled_blasts")
    .insert({ scheduled_at: at.toISOString(), limit_count: limit, status: "pending" })
    .select("id, scheduled_at, limit_count, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blast: data });
}
```

- [ ] **Step 2 : Créer `app/api/scheduled-blasts/[id]/route.ts`** (DELETE = annuler un `pending`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });
  const { id } = await params;
  const { data, error } = await supabase
    .from("scheduled_blasts")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Introuvable ou déjà lancé" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit` → exit 0.

- [ ] **Step 4 : Commit**
```bash
git add app/api/scheduled-blasts/
git commit -m "feat(blast): API scheduled-blasts (create/list/cancel)"
```

---

### Task 4 : Moteur cron `/api/cron/run-blasts` + middleware + env

**Files:**
- Create: `app/api/cron/run-blasts/route.ts`
- Modify: `middleware.ts`
- Modify: `.env.example`

- [ ] **Step 1 : Créer `app/api/cron/run-blasts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { runBlast, BlastError } from "@/app/lib/blast";

/** Base publique pour les liens démo (env obligatoire en prod). */
function demoBase(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DEMO_BASE_URL;
  return env ? env.replace(/\/$/, "") : req.nextUrl.origin;
}

/**
 * Moteur des blasts programmés. Appelé chaque minute par le cron VPS.
 * Auth : en-tête x-cron-secret == CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("scheduled_blasts")
    .select("id, limit_count")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = demoBase(req);
  const ran: Array<{ id: string; sent?: number; failed?: number; error?: string }> = [];

  for (const job of due ?? []) {
    // Claim atomique : seul le tick qui passe pending->running exécute (anti-double-envoi).
    const { data: claimed } = await supabase
      .from("scheduled_blasts")
      .update({ status: "running" })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const r = await runBlast({ limit: job.limit_count, base });
      await supabase
        .from("scheduled_blasts")
        .update({ status: "done", executed_at: new Date().toISOString(), result: { sent: r.sent, failed: r.failed, totalSegments: r.totalSegments, pool: r.pool, targeted: r.targeted } })
        .eq("id", job.id);
      ran.push({ id: job.id, sent: r.sent, failed: r.failed });
    } catch (e) {
      const msg = e instanceof BlastError ? e.message : e instanceof Error ? e.message : String(e);
      await supabase
        .from("scheduled_blasts")
        .update({ status: "failed", executed_at: new Date().toISOString(), result: { error: msg } })
        .eq("id", job.id);
      ran.push({ id: job.id, error: msg });
    }
  }

  return NextResponse.json({ ran, count: ran.length });
}
```

- [ ] **Step 2 : Exempter le cron dans `middleware.ts`** — ajouter après la ligne `pathname === "/api/sms/status" ||` :
```ts
    pathname === "/api/cron/run-blasts" ||
```

- [ ] **Step 3 : Documenter la variable dans `.env.example`** — ajouter :
```
# Secret partagé pour le déclencheur cron des blasts programmés (en-tête x-cron-secret)
CRON_SECRET=
```

- [ ] **Step 4 : Vérifier** `npx tsc --noEmit` → exit 0.

- [ ] **Step 5 : Commit**
```bash
git add app/api/cron/run-blasts/route.ts middleware.ts .env.example
git commit -m "feat(blast): moteur cron run-blasts (claim atomique) + exemption middleware"
```

---

### Task 5 : `/api/twilio/balance` (aperçu solde)

**Files:**
- Create: `app/api/twilio/balance/route.ts`

- [ ] **Step 1 : Créer la route**

```ts
import { NextResponse } from "next/server";
import { twilioClient, twilioConfigured } from "@/app/lib/twilio";

/** Solde du compte Twilio (pour l'aperçu coût/solde dans /sms). */
export async function GET() {
  if (!twilioConfigured) return NextResponse.json({ error: "Twilio non configuré" }, { status: 503 });
  try {
    const bal = await twilioClient().balance.fetch();
    return NextResponse.json({ balance: parseFloat(bal.balance), currency: bal.currency });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2 : Vérifier** `npx tsc --noEmit` → exit 0.

- [ ] **Step 3 : Commit**
```bash
git add app/api/twilio/balance/
git commit -m "feat(blast): endpoint solde Twilio"
```

---

### Task 6 : UI — panneau « Programmer un envoi » dans `/sms`

**Files:**
- Create: `app/sms/ScheduleBlastPanel.tsx`
- Modify: `app/sms/page.tsx` (import + insertion du panneau)

- [ ] **Step 1 : Créer `app/sms/ScheduleBlastPanel.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Send, Trash2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

const COST_PER_SMS = 0.399; // message actuel ~5 segments × 0,0798 $

interface ScheduledBlast {
  id: string;
  scheduled_at: string;
  limit_count: number;
  status: "pending" | "running" | "done" | "failed" | "canceled";
  result: { sent?: number; failed?: number; error?: string } | null;
  executed_at: string | null;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CLS: Record<ScheduledBlast["status"], string> = {
  pending: "text-sky-300 bg-sky-950/30 border-sky-900/40",
  running: "text-violet-300 bg-violet-950/30 border-violet-900/40",
  done: "text-emerald-300 bg-emerald-950/30 border-emerald-900/40",
  failed: "text-rose-300 bg-rose-950/40 border-rose-900/50",
  canceled: "text-neutral-400 bg-neutral-800/40 border-neutral-700/50",
};

export default function ScheduleBlastPanel() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(50);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState("18:00");
  const [balance, setBalance] = useState<number | null>(null);
  const [list, setList] = useState<ScheduledBlast[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/scheduled-blasts");
    const json = await res.json();
    if (res.ok) setList(json.blasts ?? []);
  }, []);

  useEffect(() => {
    loadList();
    fetch("/api/twilio/balance").then((r) => r.json()).then((j) => { if (typeof j.balance === "number") setBalance(j.balance); }).catch(() => {});
  }, [loadList]);

  // Realtime : MAJ de la liste quand un job change (cron qui exécute, etc.)
  useEffect(() => {
    if (!supabaseConfigured) return;
    const ch = supabase
      .channel("scheduled-blasts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_blasts" }, () => loadList())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadList]);

  const scheduledAt = useMemo(() => new Date(`${date}T${time}`), [date, time]);
  const estCost = count * COST_PER_SMS;
  const outOfWindow = useMemo(() => {
    const d = scheduledAt;
    return d.getDay() === 0 || d.getHours() < 8 || d.getHours() >= 20;
  }, [scheduledAt]);
  const overBudget = balance != null && estCost > balance;

  const submit = useCallback(async () => {
    setSubmitting(true);
    setInfo(null);
    try {
      const res = await fetch("/api/scheduled-blasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString(), limit: count }),
      });
      const json = await res.json();
      if (!res.ok) setInfo(json.error || `Erreur ${res.status}`);
      else { setInfo(`Programmé : ${count} prospects le ${fmt(scheduledAt.toISOString())}.`); await loadList(); }
    } finally {
      setSubmitting(false);
    }
  }, [scheduledAt, count, loadList]);

  const cancel = useCallback(async (id: string) => {
    await fetch(`/api/scheduled-blasts/${id}`, { method: "DELETE" });
    await loadList();
  }, [loadList]);

  const pending = list.filter((b) => b.status === "pending" || b.status === "running");

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] mb-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-neutral-200">
        <span className="flex items-center gap-2 font-medium"><CalendarClock className="w-4 h-4 text-violet-400" /> Programmer un envoi</span>
        <span className="flex items-center gap-2 text-xs text-neutral-500">
          {pending.length > 0 && <span>{pending.length} programmé{pending.length > 1 ? "s" : ""}</span>}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-neutral-400">Prospects
              <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="mt-1 block w-24 rounded-lg bg-neutral-900 border border-[var(--color-border)] px-2 py-1.5 text-sm text-neutral-100" />
            </label>
            <label className="text-xs text-neutral-400">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 block rounded-lg bg-neutral-900 border border-[var(--color-border)] px-2 py-1.5 text-sm text-neutral-100" />
            </label>
            <label className="text-xs text-neutral-400">Heure
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="mt-1 block rounded-lg bg-neutral-900 border border-[var(--color-border)] px-2 py-1.5 text-sm text-neutral-100" />
            </label>
            <button onClick={submit} disabled={submitting || outOfWindow}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Programmer
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-neutral-400">Coût estimé : <span className={overBudget ? "text-rose-300" : "text-neutral-200"}>~{estCost.toFixed(2)} $</span></span>
            {balance != null && <span className="text-neutral-400">Solde Twilio : <span className="text-neutral-200">{balance.toFixed(2)} $</span></span>}
            {overBudget && <span className="flex items-center gap-1 text-rose-300"><AlertTriangle className="w-3 h-3" /> Coût &gt; solde</span>}
            {outOfWindow && <span className="flex items-center gap-1 text-amber-300"><AlertTriangle className="w-3 h-3" /> Hors créneau légal (8h-20h, hors dimanche)</span>}
          </div>

          {info && <div className="text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20 text-violet-200">{info}</div>}

          {list.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {list.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 text-xs rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md border ${STATUS_CLS[b.status]}`}>{b.status}</span>
                    <span className="text-neutral-300">{b.limit_count} prospects</span>
                    <span className="text-neutral-500">{fmt(b.scheduled_at)}</span>
                    {b.status === "done" && b.result && <span className="text-emerald-300">{b.result.sent} envoyés</span>}
                    {b.status === "failed" && b.result?.error && <span className="text-rose-300">{b.result.error}</span>}
                  </div>
                  {b.status === "pending" && (
                    <button onClick={() => cancel(b.id)} className="flex items-center gap-1 text-neutral-500 hover:text-rose-300" title="Annuler">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Intégrer dans `app/sms/page.tsx`** — ajouter l'import en haut (après les imports lucide/supabase existants) :
```tsx
import ScheduleBlastPanel from "./ScheduleBlastPanel";
```
puis insérer le composant juste après le bloc `{/* Stats */}` (avant le bloc `{info && …}`), sur sa propre ligne :
```tsx
      <ScheduleBlastPanel />
```

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit` → exit 0, puis `npm run build` → exit 0 (route `/sms` + nouvelles routes API générées).

- [ ] **Step 4 : Commit**
```bash
git add app/sms/ScheduleBlastPanel.tsx app/sms/page.tsx
git commit -m "feat(blast): panneau Programmer un envoi dans /sms (coût, solde, annulation)"
```

---

### Task 7 : Doc de mise en place du cron VPS

**Files:**
- Modify: `DEPLOY.md` (section « Blast programmé »)

- [ ] **Step 1 : Ajouter à la fin de `DEPLOY.md`**

````markdown
## Blast programmé (cron VPS)

1. Définir un secret partagé identique dans **Vercel** (Production → Environment Variables) et sur le **VPS** :
   - Vercel : `CRON_SECRET=<valeur-aléatoire-longue>` (puis redeploy).
2. Sur le VPS, ajouter au crontab (`crontab -e`) — déclenche le moteur chaque minute :
   ```cron
   * * * * * curl -s -X POST https://prospects.nmf-agence.com/api/cron/run-blasts -H "x-cron-secret: VOTRE_CRON_SECRET" >> /var/log/blast-cron.log 2>&1
   ```
3. Test : `curl -i -X POST https://prospects.nmf-agence.com/api/cron/run-blasts` → **401** (pas de secret).
   Avec le bon en-tête → `{ "ran": [...], "count": n }`.
4. Les envois se créent depuis `/sms` → « Programmer un envoi ». Le cron exécute ceux dont l'heure est passée.
````

- [ ] **Step 2 : Commit**
```bash
git add DEPLOY.md
git commit -m "docs: mise en place du cron VPS pour les blasts programmés"
```

---

### Task 8 : Vérification finale + push

- [ ] **Step 1 : Build complet** — `npx tsc --noEmit` (exit 0) puis `npm run build` (exit 0).
- [ ] **Step 2 : Test runtime de bout en bout** (en local `npm run dev` ou en prod après déploiement) :
  - Ouvrir `/sms` → « Programmer un envoi » → programmer `1` prospect à `maintenant + 2 min`.
  - Vérifier la ligne `pending` dans la liste + le solde Twilio affiché.
  - Appeler manuellement le moteur : `curl -X POST <base>/api/cron/run-blasts -H "x-cron-secret: <secret>"`.
  - Vérifier le passage `pending → done`, `result.sent`, et la nouvelle ligne dans `sms_messages` (page /sms).
  - Vérifier `401` sans secret.
- [ ] **Step 3 : Push**
```bash
git push origin main
```
- [ ] **Step 4 : MAJ vault** `Obsidian/Cerveau/Projets/prospects-tracker.md` (feature livrée : table `scheduled_blasts`, endpoints, cron VPS, panneau /sms) + commit/push du vault.

---

## Self-Review

**Couverture spec :**
- Table `scheduled_blasts` → Task 1 ✓
- Refacto `runBlast` → Task 2 ✓
- API create/list/cancel → Task 3 ✓
- Moteur cron + secret + middleware → Task 4 ✓
- Solde Twilio → Task 5 ✓
- UI panneau + aperçu + liste + annulation + realtime → Task 6 ✓
- Doc cron VPS → Task 7 ✓
- Vérif + push + vault → Task 8 ✓

**Cohérence des types :** `BlastResult`, `BlastError("OUT_OF_WINDOW"|"TWILIO_UNCONFIGURED")`, `runBlast(opts)`, `scheduled_blasts` colonnes (`limit_count`, `scheduled_at`, `status`, `result`) — identiques entre Tasks 2, 4 et 6. La route `[id]` DELETE et le composant utilisent le même nom de table et de statuts (`pending|running|done|failed|canceled`).

**Placeholders :** aucun — chaque step contient le code réel. Garde-fou légal, claim atomique, validation d'entrée explicités.

**Hors scope respecté :** pas de récurrence, pas de toggle message, pas d'offset UI, pas de retry auto.
