# Redesign Agenda — Liquid Glass, 3 vues, instantané — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `/agenda` en calendrier liquid glass (clair + sombre), avec 3 vues (Semaine/Mois/Liste) et un affichage instantané (cache stale-while-revalidate), sans rien casser de la sync Google Calendar / fiche prospect / création-suppression.

**Architecture :** On extrait la logique pure (dates, plages) dans `app/lib/calendarDates.ts` (testée), on crée un hook `useCalendarEvents` (cache localStorage + revalidation + mutations optimistes), on découpe les vues dans `app/agenda/views/`, et on refond `app/agenda/page.tsx` en coquille (segmented control + navigation + style verre). Style verre via classes CSS basées sur les variables de thème existantes.

**Tech Stack :** Next.js (App Router, client components), React, TypeScript, Tailwind + variables CSS de thème, tests `node:test` lancés via `tsx` (`npx tsx --test`), `npx tsc --noEmit` pour le typecheck.

**Référence design :** `docs/superpowers/specs/2026-06-17-agenda-redesign-liquid-glass-design.md`. Règles `impeccable` (register product) : pas de side-stripe, accent = états, contraste ≥ 4.5:1, glass localisé, motion 150–250 ms + `prefers-reduced-motion`, skeleton (pas de spinner).

---

## File Structure

- **Create** `app/lib/calendarDates.ts` — helpers purs : `startOfWeek`, `addDays`, `sameDay`, `monthGrid`, `rangeForView`, `dayKeyOf`. Testable.
- **Create** `app/lib/calendarDates.test.ts` — tests node:test.
- **Create** `app/lib/useCalendarEvents.ts` — hook données : cache localStorage stale-while-revalidate, prefetch, mutations optimistes.
- **Create** `app/lib/eventCache.ts` — fonctions PURES de cache (lecture/écriture/merge par plage). Testable.
- **Create** `app/lib/eventCache.test.ts` — tests node:test.
- **Create** `app/agenda/views/WeekView.tsx` — grille horaire restylée (réutilise `layoutDay`).
- **Create** `app/agenda/views/MonthView.tsx` — grille mois 6×7.
- **Create** `app/agenda/views/ListView.tsx` — liste chronologique groupée par jour.
- **Create** `app/agenda/eventLayout.ts` — `layoutDay` (déplacé depuis page.tsx) + utilisé par WeekView. Testable.
- **Create** `app/agenda/eventLayout.test.ts` — tests node:test pour les chevauchements.
- **Create** `app/agenda/calendar-glass.css` (ou classes dans `app/globals.css`) — classes `.glass-panel`, `.glass-event` + variantes d'état, basées sur variables de thème.
- **Modify** `app/agenda/page.tsx` — devient la coquille (state vue/période, segmented control, navigation, rendu de la vue active, modale création, popover détail, CallModal).
- **Reuse (inchangé)** `app/lib/googleCalendar.ts`, `app/api/calendar/events/route.ts`, `app/api/calendar/events/[id]/route.ts`, `app/components/CallModal.tsx`.

---

## Task 1 : Helpers de dates purs

**Files:**
- Create: `app/lib/calendarDates.ts`
- Test: `app/lib/calendarDates.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfWeek, addDays, sameDay, monthGrid, rangeForView, dayKeyOf } from "./calendarDates";

test("startOfWeek: lundi comme premier jour", () => {
  // mer 18 juin 2026 -> lundi 15 juin 2026
  const mon = startOfWeek(new Date(2026, 5, 18));
  assert.equal(mon.getFullYear(), 2026);
  assert.equal(mon.getMonth(), 5);
  assert.equal(mon.getDate(), 15);
});

test("addDays / sameDay", () => {
  const d = new Date(2026, 5, 18);
  assert.ok(sameDay(addDays(d, 0), d));
  assert.equal(addDays(d, 3).getDate(), 21);
});

test("monthGrid: 42 jours, commence un lundi, couvre le mois", () => {
  const grid = monthGrid(new Date(2026, 5, 1)); // juin 2026
  assert.equal(grid.length, 42);
  assert.equal((grid[0].getDay() + 6) % 7, 0); // lundi
  assert.ok(grid.some((d) => d.getMonth() === 5 && d.getDate() === 30));
});

test("rangeForView: semaine = 7 j; mois borné au grid; liste = ~60 j", () => {
  const ref = new Date(2026, 5, 18);
  const wk = rangeForView("week", ref);
  assert.equal(Math.round((wk.to.getTime() - wk.from.getTime()) / 86400000), 7);
  const mo = rangeForView("month", ref);
  assert.ok(mo.to.getTime() - mo.from.getTime() >= 41 * 86400000);
  const li = rangeForView("list", ref);
  assert.ok(li.to.getTime() - li.from.getTime() >= 59 * 86400000);
});

test("dayKeyOf stable", () => {
  assert.equal(dayKeyOf(new Date(2026, 5, 18)), "2026-5-18");
});
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx tsx --test app/lib/calendarDates.test.ts`
Expected: FAIL (`Cannot find module './calendarDates'`).

- [ ] **Step 3: Implémenter `calendarDates.ts`**

```ts
/** Helpers de dates purs pour l'agenda (lundi = premier jour). */
export type CalendarView = "week" | "month" | "list";

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (out.getDay() + 6) % 7; // lundi = 0
  out.setDate(out.getDate() - day);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 42 jours (6 semaines) couvrant le mois de `d`, commençant un lundi. */
export function monthGrid(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Plage [from, to) à charger pour une vue donnée, ancrée sur `ref`. */
export function rangeForView(view: CalendarView, ref: Date): { from: Date; to: Date } {
  if (view === "week") {
    const from = startOfWeek(ref);
    return { from, to: addDays(from, 7) };
  }
  if (view === "month") {
    const grid = monthGrid(ref);
    return { from: grid[0], to: addDays(grid[41], 1) };
  }
  // list : 60 jours glissants à partir d'aujourd'hui (ref ignoré pour rester "à venir")
  const from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return { from, to: addDays(from, 60) };
}
```

- [ ] **Step 4: Lancer les tests et vérifier le succès**

Run: `npx tsx --test app/lib/calendarDates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/calendarDates.ts app/lib/calendarDates.test.ts
git commit -m "feat(agenda): helpers de dates purs (semaine/mois/liste) + tests"
```

---

## Task 2 : Layout des chevauchements (extraction + tests)

**Files:**
- Create: `app/agenda/eventLayout.ts` (déplace `layoutDay` depuis `page.tsx`)
- Test: `app/agenda/eventLayout.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutDay } from "./eventLayout";
import type { CalendarEvent } from "../lib/googleCalendar";

const ev = (id: string, s: string, e: string): CalendarEvent => ({
  id, title: id, start: s, end: e, allDay: false, location: null, description: null, htmlLink: null, prospectId: null,
});

test("deux RDV qui se chevauchent => 2 colonnes", () => {
  const map = layoutDay([
    ev("a", "2026-06-18T09:00:00", "2026-06-18T10:00:00"),
    ev("b", "2026-06-18T09:30:00", "2026-06-18T10:30:00"),
  ]);
  assert.equal(map.get("a")!.cols, 2);
  assert.equal(map.get("b")!.cols, 2);
  assert.notEqual(map.get("a")!.col, map.get("b")!.col);
});

test("deux RDV disjoints => 1 colonne chacun", () => {
  const map = layoutDay([
    ev("a", "2026-06-18T09:00:00", "2026-06-18T09:30:00"),
    ev("b", "2026-06-18T11:00:00", "2026-06-18T11:30:00"),
  ]);
  assert.equal(map.get("a")!.cols, 1);
  assert.equal(map.get("b")!.cols, 1);
});
```

- [ ] **Step 2: Lancer le test et vérifier l'échec**

Run: `npx tsx --test app/agenda/eventLayout.test.ts`
Expected: FAIL (`Cannot find module './eventLayout'`).

- [ ] **Step 3: Créer `eventLayout.ts`** (copier le corps de `layoutDay` actuellement dans `app/agenda/page.tsx:62-96`, en tête de fichier l'import du type)

```ts
import type { CalendarEvent } from "../lib/googleCalendar";

/** Répartit les événements qui se chevauchent en colonnes côte à côte. */
export function layoutDay(events: CalendarEvent[]): Map<string, { col: number; cols: number }> {
  const MIN_DUR = 15 * 60_000;
  const items = events
    .map((e) => {
      const start = new Date(e.start).getTime();
      return { e, start, end: Math.max(new Date(e.end).getTime(), start + MIN_DUR) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out = new Map<string, { col: number; cols: number }>();
  let cluster: { item: (typeof items)[number]; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const p of cluster) out.set(p.item.e.id, { col: p.col, cols: colEnds.length });
    cluster = [];
    colEnds = [];
  };

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end);
    } else {
      colEnds[col] = item.end;
    }
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Lancer le test et vérifier le succès**

Run: `npx tsx --test app/agenda/eventLayout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/agenda/eventLayout.ts app/agenda/eventLayout.test.ts
git commit -m "refactor(agenda): extrait layoutDay dans eventLayout.ts + tests"
```

---

## Task 3 : Cache d'événements pur (stale-while-revalidate)

**Files:**
- Create: `app/lib/eventCache.ts`
- Test: `app/lib/eventCache.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEvents, eventsInRange } from "./eventCache";
import type { CalendarEvent } from "./googleCalendar";

const ev = (id: string, s: string): CalendarEvent => ({
  id, title: id, start: s, end: s, allDay: false, location: null, description: null, htmlLink: null, prospectId: null,
});

test("mergeEvents: dédupe par id, le plus récent gagne", () => {
  const a = [ev("1", "2026-06-18T09:00:00")];
  const b = [{ ...ev("1", "2026-06-18T10:00:00") }, ev("2", "2026-06-19T09:00:00")];
  const out = mergeEvents(a, b);
  assert.equal(out.length, 2);
  assert.equal(out.find((e) => e.id === "1")!.start, "2026-06-18T10:00:00");
});

test("eventsInRange: filtre sur [from,to)", () => {
  const all = [ev("1", "2026-06-18T09:00:00"), ev("2", "2026-07-01T09:00:00")];
  const out = eventsInRange(all, new Date(2026, 5, 17), new Date(2026, 5, 20));
  assert.deepEqual(out.map((e) => e.id), ["1"]);
});
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx tsx --test app/lib/eventCache.test.ts`
Expected: FAIL (`Cannot find module './eventCache'`).

- [ ] **Step 3: Implémenter `eventCache.ts`**

```ts
import type { CalendarEvent } from "./googleCalendar";

/** Fusionne deux listes d'événements, dédupe par id (b écrase a). */
export function mergeEvents(a: CalendarEvent[], b: CalendarEvent[]): CalendarEvent[] {
  const map = new Map<string, CalendarEvent>();
  for (const e of a) map.set(e.id, e);
  for (const e of b) map.set(e.id, e);
  return [...map.values()];
}

/** Événements dont le début tombe dans [from, to). */
export function eventsInRange(all: CalendarEvent[], from: Date, to: Date): CalendarEvent[] {
  const lo = from.getTime();
  const hi = to.getTime();
  return all.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= lo && t < hi;
  });
}
```

- [ ] **Step 4: Lancer les tests et vérifier le succès**

Run: `npx tsx --test app/lib/eventCache.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/eventCache.ts app/lib/eventCache.test.ts
git commit -m "feat(agenda): cache d'evenements pur (merge + filtre par plage) + tests"
```

---

## Task 4 : Hook `useCalendarEvents` (cache localStorage + revalidation)

**Files:**
- Create: `app/lib/useCalendarEvents.ts`

> Pas de test unitaire (hook navigateur + I/O) : vérifié par typecheck + e2e manuel (Task 9).

- [ ] **Step 1: Implémenter le hook**

```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "./googleCalendar";
import { mergeEvents, eventsInRange } from "./eventCache";

const LS_KEY = "pt.agenda.events.v1";

type Status = "configured" | "unconfigured" | "auth";

function loadCache(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
  } catch {
    return [];
  }
}
function saveCache(events: CalendarEvent[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events.slice(0, 2000)));
  } catch {
    /* quota : on ignore */
  }
}

/**
 * Source d'événements instantanée : sert d'abord le cache, revalide en fond.
 * `from`/`to` bornent la plage demandée par la vue ; on fetch toujours la
 * plage demandée mais on garde un cache global fusionné pour l'instantanéité.
 */
export function useCalendarEvents() {
  const [all, setAll] = useState<CalendarEvent[]>(() => (typeof window !== "undefined" ? loadCache() : []));
  const [revalidating, setRevalidating] = useState(false);
  const [coldLoading, setColdLoading] = useState(all.length === 0);
  const [status, setStatus] = useState<Status>("configured");
  const [staleError, setStaleError] = useState(false);
  const seq = useRef(0);

  const fetchRange = useCallback(async (from: Date, to: Date) => {
    const s = ++seq.current;
    setRevalidating(true);
    setStaleError(false);
    try {
      const res = await fetch(`/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (s !== seq.current) return;
      if (res.status === 401) return setStatus("auth");
      if (res.status === 501) { setStatus("unconfigured"); setColdLoading(false); return; }
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (s !== seq.current) return;
      setStatus("configured");
      setAll((prev) => {
        // on remplace la fenêtre [from,to) par le résultat frais, on garde le reste du cache
        const outside = prev.filter((e) => {
          const t = new Date(e.start).getTime();
          return t < from.getTime() || t >= to.getTime();
        });
        const merged = mergeEvents(outside, json.events ?? []);
        saveCache(merged);
        return merged;
      });
    } catch {
      if (s === seq.current) setStaleError(true);
    } finally {
      if (s === seq.current) { setRevalidating(false); setColdLoading(false); }
    }
  }, []);

  const addEvent = useCallback((e: CalendarEvent) => {
    setAll((prev) => { const m = mergeEvents(prev, [e]); saveCache(m); return m; });
  }, []);
  const removeEvent = useCallback((id: string) => {
    setAll((prev) => { const m = prev.filter((x) => x.id !== id); saveCache(m); return m; });
  }, []);

  return { all, eventsInRange, fetchRange, addEvent, removeEvent, revalidating, coldLoading, status, staleError };
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add app/lib/useCalendarEvents.ts
git commit -m "feat(agenda): hook useCalendarEvents (cache localStorage + revalidation + mutations optimistes)"
```

---

## Task 5 : Styles verre (CSS)

**Files:**
- Modify: `app/globals.css` (ajouter les classes verre en fin de fichier)

> Vérifié visuellement (Task 9) ; pas de test unitaire CSS.

- [ ] **Step 1: Ajouter les classes verre**

Coller en fin de `app/globals.css`. Les couleurs s'appuient sur le thème : opacités neutres en sombre, surfaces blanches translucides en clair (via `:root` / `.dark`). Ajuster les variables si déjà présentes.

```css
/* ── Agenda · Liquid glass ─────────────────────────────────────────── */
.glass-panel {
  position: relative;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
  -webkit-backdrop-filter: blur(24px) saturate(165%);
  backdrop-filter: blur(24px) saturate(165%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 18px 50px rgba(0, 0, 0, 0.45);
}
:root:not(.dark) .glass-panel {
  border-color: rgba(255, 255, 255, 0.85);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 18px 50px rgba(70, 55, 130, 0.16);
}
.glass-amb { position: relative; isolation: isolate; }
.glass-amb::before {
  content: ""; position: absolute; inset: -30%; z-index: -1; filter: blur(8px);
  background:
    radial-gradient(38% 38% at 22% 18%, rgba(139, 92, 246, 0.4), transparent 70%),
    radial-gradient(42% 42% at 82% 72%, rgba(217, 70, 239, 0.32), transparent 70%);
}
.glass-event {
  position: relative; overflow: hidden; border-radius: 10px;
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  backdrop-filter: blur(12px) saturate(180%);
  transition: box-shadow .18s ease, transform .18s ease;
}
.glass-event::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 42%;
  background: linear-gradient(rgba(255, 255, 255, 0.32), transparent); pointer-events: none;
}
/* États (accent = état, jamais déco). Variantes sombre par défaut, clair surchargé. */
.ev-normal { background: linear-gradient(160deg, rgba(139,92,246,.30), rgba(139,92,246,.12)); border: 1px solid rgba(167,139,250,.5); color: #f5f3ff; box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 6px 16px rgba(124,58,237,.32); }
.ev-now    { background: linear-gradient(160deg, rgba(217,70,239,.34), rgba(217,70,239,.14)); border: 1px solid rgba(240,171,252,.55); color: #fdf2f8; box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 6px 16px rgba(217,70,239,.34); }
.ev-past   { background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.025)); border: 1px solid rgba(255,255,255,.1); color: #9ca3af; }
:root:not(.dark) .ev-normal { background: linear-gradient(160deg, rgba(139,92,246,.20), rgba(139,92,246,.09)); border-color: rgba(139,92,246,.4); color: #5b21b6; box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 5px 14px rgba(124,58,237,.18); }
:root:not(.dark) .ev-now    { background: linear-gradient(160deg, rgba(217,70,239,.18), rgba(217,70,239,.08)); border-color: rgba(217,70,239,.4); color: #86198f; box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 5px 14px rgba(217,70,239,.18); }
:root:not(.dark) .ev-past   { background: linear-gradient(160deg, rgba(255,255,255,.66), rgba(255,255,255,.4)); border-color: rgba(0,0,0,.07); color: #9ca3af; }
@media (prefers-reduced-motion: reduce) {
  .glass-event { transition: none; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-panel { background: var(--color-surface); }
  .glass-event.ev-normal, .glass-event.ev-now, .glass-event.ev-past { backdrop-filter: none; }
}
```

- [ ] **Step 2: Vérifier le build CSS (typecheck global suffit ici)**

Run: `npx tsc --noEmit`
Expected: EXIT 0 (le CSS n'affecte pas le typecheck ; confirme juste que rien d'autre n'a cassé).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(agenda): classes liquid glass (panneau + evenements par etat, clair/sombre, reduced-motion)"
```

---

## Task 6 : `WeekView` (grille restylée verre)

**Files:**
- Create: `app/agenda/views/WeekView.tsx`

> Vue extraite du corps actuel de `page.tsx` (grille heures + colonnes + ligne now + double-clic), restylée avec `.glass-event` (plus de side-stripe). Props : événements du jour déjà indexés, callbacks.

- [ ] **Step 1: Créer le composant**

```tsx
"use client";
import { useRef } from "react";
import type { CalendarEvent } from "../../lib/googleCalendar";
import { sameDay, addDays, startOfWeek, dayKeyOf } from "../../lib/calendarDates";
import { layoutDay } from "../eventLayout";

const DAY_START = 7, DAY_END = 21, HOUR_PX = 52;
const GRID_H = (DAY_END - DAY_START) * HOUR_PX;
const DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function WeekView({
  weekStart, now, byDay, onOpen, onCreateAt,
}: {
  weekStart: Date;
  now: Date;
  byDay: Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>;
  onOpen: (e: CalendarEvent) => void;
  onCreateAt: (d: Date) => void;
}) {
  const nowRef = useRef<HTMLDivElement | null>(null);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* En-têtes jours */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: "52px repeat(7,1fr)" }}>
            <div />
            {weekDays.map((d, i) => {
              const today = sameDay(d, now);
              return (
                <div key={i} className={`px-2 py-2.5 text-center ${today ? "bg-violet-500/10 rounded-t-lg" : ""}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${today ? "text-violet-500 font-bold" : "text-neutral-500"}`}>{DAYS[i]}</div>
                  <div className={`text-lg font-mono-num ${today ? "text-violet-500 font-bold" : "text-[var(--color-text-primary)]"}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {/* Corps */}
          <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7,1fr)" }}>
            <div className="relative" style={{ height: GRID_H }}>
              {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                <div key={i} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-neutral-400 dark:text-neutral-600 font-mono-num" style={{ top: i * HOUR_PX }}>
                  {i > 0 ? `${DAY_START + i}h` : ""}
                </div>
              ))}
            </div>
            {weekDays.map((d, di) => {
              const today = sameDay(d, now);
              const dayEvents = byDay.get(dayKeyOf(d))?.timed ?? [];
              const lay = layoutDay(dayEvents);
              return (
                <div
                  key={di}
                  className={`relative border-l border-white/5 ${today ? "bg-violet-500/[0.04]" : di >= 5 ? "bg-[var(--color-surface-2)]/30" : ""}`}
                  style={{ height: GRID_H }}
                  onDoubleClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const half = Math.min(Math.max(Math.floor((e.clientY - rect.top) / (HOUR_PX / 2)), 0), (DAY_END - DAY_START) * 2 - 1);
                    const def = new Date(d);
                    def.setHours(DAY_START + Math.floor(half / 2), (half % 2) * 30, 0, 0);
                    onCreateAt(def);
                  }}
                  title="Double-clic : nouveau RDV"
                >
                  {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-white/5" style={{ top: i * HOUR_PX }} />
                  ))}
                  {today && now.getHours() >= DAY_START && now.getHours() < DAY_END && (
                    <div ref={nowRef} className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: (now.getHours() - DAY_START + now.getMinutes() / 60) * HOUR_PX }}>
                      <div className="h-[2px] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,.7)]" />
                      <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px]" />
                    </div>
                  )}
                  {dayEvents.map((e) => {
                    const start = new Date(e.start), end = new Date(e.end);
                    const startH = start.getHours() + start.getMinutes() / 60;
                    const endH = end.getHours() + end.getMinutes() / 60;
                    const top = Math.min(Math.max(0, (startH - DAY_START) * HOUR_PX), GRID_H - 26);
                    const height = Math.min(Math.max(26, (Math.min(endH, DAY_END) - Math.max(startH, DAY_START)) * HOUR_PX - 2), GRID_H - top - 2);
                    const l = lay.get(e.id) ?? { col: 0, cols: 1 };
                    const w = 96 / l.cols;
                    const past = end.getTime() < now.getTime();
                    const ongoing = !past && start.getTime() <= now.getTime();
                    const cls = past ? "ev-past" : ongoing ? "ev-now" : "ev-normal";
                    return (
                      <button key={e.id} onClick={() => onOpen(e)} title={`${e.title} · ${fmtTime(start)}–${fmtTime(end)}`}
                        className={`glass-event ${cls} absolute px-1.5 py-1 text-left hover:z-20 hover:shadow-lg`}
                        style={{ top, height, left: `${2 + l.col * w}%`, width: `calc(${w}% - 2px)` }}>
                        <div className="text-[11px] font-semibold leading-tight truncate">{e.title}</div>
                        <div className="text-[10px] font-mono-num opacity-80">{fmtTime(start)}{height > 38 ? ` – ${fmtTime(end)}` : ""}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add app/agenda/views/WeekView.tsx
git commit -m "feat(agenda): WeekView en liquid glass (sans side-stripe)"
```

---

## Task 7 : `MonthView` et `ListView`

**Files:**
- Create: `app/agenda/views/MonthView.tsx`
- Create: `app/agenda/views/ListView.tsx`

- [ ] **Step 1: Créer `MonthView.tsx`**

```tsx
"use client";
import type { CalendarEvent } from "../../lib/googleCalendar";
import { monthGrid, sameDay, dayKeyOf } from "../../lib/calendarDates";

const DOW = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function MonthView({
  refDate, now, byDay, onOpen, onPickDay,
}: {
  refDate: Date;
  now: Date;
  byDay: Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>;
  onOpen: (e: CalendarEvent) => void;
  onPickDay: (d: Date) => void;
}) {
  const grid = monthGrid(refDate);
  const month = refDate.getMonth();
  return (
    <div className="glass-panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/10">
        {DOW.map((d) => <div key={d} className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-neutral-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const evs = byDay.get(dayKeyOf(d))?.timed ?? [];
          const today = sameDay(d, now);
          const dim = d.getMonth() !== month;
          return (
            <button key={i} onClick={() => onPickDay(d)}
              className={`min-h-[96px] text-left p-1.5 border-l border-t border-white/5 align-top hover:bg-violet-500/5 transition ${dim ? "opacity-40" : ""}`}>
              <div className={`text-xs font-mono-num mb-1 ${today ? "text-violet-500 font-bold" : "text-[var(--color-text-secondary)]"}`}>{d.getDate()}</div>
              <div className="space-y-1">
                {evs.slice(0, 3).map((e) => {
                  const start = new Date(e.start);
                  const past = new Date(e.end).getTime() < now.getTime();
                  return (
                    <div key={e.id} onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}
                      className={`glass-event ${past ? "ev-past" : "ev-normal"} px-1.5 py-0.5 text-[10px] truncate`}>
                      <span className="font-mono-num opacity-80 mr-1">{fmtTime(start)}</span>{e.title}
                    </div>
                  );
                })}
                {evs.length > 3 && <div className="text-[9px] text-neutral-500 pl-1">+{evs.length - 3} autres</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer `ListView.tsx`**

```tsx
"use client";
import type { CalendarEvent } from "../../lib/googleCalendar";
import { sameDay, dayKeyOf } from "../../lib/calendarDates";

const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default function ListView({
  events, now, onOpen,
}: {
  events: CalendarEvent[];
  now: Date;
  onOpen: (e: CalendarEvent) => void;
}) {
  const upcoming = events
    .filter((e) => !e.allDay && new Date(e.end).getTime() >= Date.now())
    .sort((a, b) => a.start.localeCompare(b.start));

  if (upcoming.length === 0) {
    return <div className="glass-panel p-10 text-center text-sm text-neutral-500">Aucun RDV à venir. Double-clique un créneau en vue Semaine pour en créer un.</div>;
  }

  // Groupe par jour
  const groups: { key: string; date: Date; items: CalendarEvent[] }[] = [];
  for (const e of upcoming) {
    const d = new Date(e.start);
    const key = dayKeyOf(d);
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, date: d, items: [] }; groups.push(g); }
    g.items.push(e);
  }

  return (
    <div className="glass-panel p-3 space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 px-1 ${sameDay(g.date, now) ? "text-violet-500" : "text-neutral-500"}`}>
            {sameDay(g.date, now) ? "Aujourd'hui" : fmtDay(g.date)}
          </h3>
          <div className="space-y-1">
            {g.items.map((e) => {
              const start = new Date(e.start);
              const ongoing = start.getTime() <= now.getTime() && new Date(e.end).getTime() >= now.getTime();
              return (
                <button key={e.id} onClick={() => onOpen(e)}
                  className={`glass-event ${ongoing ? "ev-now" : "ev-normal"} w-full text-left px-3 py-2 flex items-center gap-3`}>
                  <span className="font-mono-num text-xs opacity-80 shrink-0">{fmtTime(start)}</span>
                  <span className="text-sm font-medium truncate">{e.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add app/agenda/views/MonthView.tsx app/agenda/views/ListView.tsx
git commit -m "feat(agenda): vues Mois et Liste en liquid glass"
```

---

## Task 8 : Refonte de la coquille `page.tsx`

**Files:**
- Modify: `app/agenda/page.tsx`

> On remplace : (a) le `useState/useEffect` de fetch par `useCalendarEvents`, (b) la grille inline par `<WeekView/> <MonthView/> <ListView/>`, (c) on ajoute le segmented control de vue (persisté) + navigation dépendant de la vue. On CONSERVE `CallModal`, `CreateEventModal`, `SetupPanel`, le détail (popover), `matchProspect`, la suppression optimiste.

- [ ] **Step 1: Brancher le hook + l'état de vue/période**

Remplacer les états de données et `fetchEvents` par :

```tsx
import { useCalendarEvents } from "../lib/useCalendarEvents";
import { rangeForView, startOfWeek, addDays, dayKeyOf, type CalendarView } from "../lib/calendarDates";
import WeekView from "./views/WeekView";
import MonthView from "./views/MonthView";
import ListView from "./views/ListView";

// dans le composant :
const [view, setView] = useState<CalendarView>("week");
const [refDate, setRefDate] = useState(() => new Date());
const { all, fetchRange, addEvent, removeEvent, revalidating, coldLoading, status, staleError } = useCalendarEvents();

// vue persistée
useEffect(() => {
  try { const v = localStorage.getItem("pt.agenda.view"); if (v === "week" || v === "month" || v === "list") setView(v); } catch {}
}, []);
useEffect(() => { try { localStorage.setItem("pt.agenda.view", view); } catch {} }, [view]);

// revalidation + prefetch quand vue/période change
useEffect(() => {
  const { from, to } = rangeForView(view, refDate);
  fetchRange(from, to);
  if (view === "week") { fetchRange(addDays(from, -7), from); fetchRange(to, addDays(to, 7)); }
}, [view, refDate, fetchRange]);
```

- [ ] **Step 2: Indexer les événements par jour (depuis le cache `all`)**

```tsx
const byDay = useMemo(() => {
  const map = new Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>();
  for (const e of all) {
    const d = e.allDay ? new Date(`${e.start}T00:00`) : new Date(e.start);
    const key = dayKeyOf(d);
    let b = map.get(key);
    if (!b) { b = { allDay: [], timed: [] }; map.set(key, b); }
    (e.allDay ? b.allDay : b.timed).push(e);
  }
  for (const b of map.values()) b.timed.sort((a, c) => a.start.localeCompare(c.start));
  return map;
}, [all]);

const weekStart = useMemo(() => startOfWeek(refDate), [refDate]);
```

- [ ] **Step 3: Rendu — segmented control + navigation + vue active + skeleton**

```tsx
{status === "unconfigured" ? <SetupPanel /> : (
  <div className="glass-amb px-3 md:px-6 py-4">
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {/* Segmented control */}
      <div className="flex gap-0.5 p-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        {(["week","month","list"] as CalendarView[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs rounded-md transition ${view === v ? "bg-violet-600/20 text-violet-600 dark:text-violet-200 font-semibold" : "text-[var(--color-text-secondary)]"}`}>
            {v === "week" ? "Semaine" : v === "month" ? "Mois" : "Liste"}
          </button>
        ))}
      </div>
      {/* Navigation période */}
      <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden ml-auto">
        <button onClick={() => setRefDate((d) => addDays(d, view === "month" ? -30 : -7))} className="p-2 hover:bg-[var(--color-surface-2)]">‹</button>
        <button onClick={() => setRefDate(new Date())} className="px-3 py-2 text-sm">Aujourd'hui</button>
        <button onClick={() => setRefDate((d) => addDays(d, view === "month" ? 30 : 7))} className="p-2 hover:bg-[var(--color-surface-2)]">›</button>
      </div>
      {revalidating && <span className="text-[10px] text-neutral-500">maj…</span>}
      {staleError && <span className="text-[10px] text-amber-600">màj impossible</span>}
    </div>

    {coldLoading ? (
      <div className="glass-panel p-2 space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-[56px]" />)}</div>
    ) : view === "week" ? (
      <WeekView weekStart={weekStart} now={now} byDay={byDay} onOpen={setSelected} onCreateAt={(d) => { setCreateDefault(d); setCreateOpen(true); }} />
    ) : view === "month" ? (
      <MonthView refDate={refDate} now={now} byDay={byDay} onOpen={setSelected} onPickDay={(d) => { setRefDate(d); setView("week"); }} />
    ) : (
      <ListView events={all} now={now} onOpen={setSelected} />
    )}
  </div>
)}
```

- [ ] **Step 4: Adapter création / suppression aux mutations optimistes**

- Dans `CreateEventModal.onCreated`, faire en sorte que le POST renvoie l'événement créé puis `addEvent(created)` au lieu de `fetchEvents()`. (La route POST renvoie déjà `toEvent`.) Si la route ne renvoie pas l'événement au front, fallback : `fetchRange(rangeForView(view, refDate))`.
- Dans `handleDelete`, remplacer `setEvents((prev) => prev.filter(...))` par `removeEvent(ev.id)`.
- `status === "auth"` → `window.location.assign("/login?from=/agenda")` (via un `useEffect` sur `status`).

```tsx
useEffect(() => { if (status === "auth") window.location.assign("/login?from=/agenda"); }, [status]);
```

- [ ] **Step 5: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 6: Commit**

```bash
git add app/agenda/page.tsx
git commit -m "feat(agenda): coquille 3 vues + segmented control + cache instantane (liquid glass)"
```

---

## Task 9 : Vérification e2e manuelle + lint

**Files:** aucun (vérification)

- [ ] **Step 1: Lancer le dev et vérifier**

Run: `npm run dev` puis ouvrir `/agenda`.
Vérifier :
- Retour sur la page / changement de semaine déjà visitée = **instantané** (pas de spinner).
- Bascule **Semaine / Mois / Liste** OK ; clic jour en Mois → Semaine sur ce jour.
- RDV : aujourd'hui (violet), en cours (fuchsia), passé (gris) ; pas de barre latérale.
- **Mode clair ET sombre** lisibles (ThemeToggle).
- Créer un RDV (apparaît tout de suite) ; supprimer (disparaît tout de suite).
- Ouvrir un RDV lié à un prospect → `CallModal` s'ouvre.
- Mobile : vue Liste lisible.

- [ ] **Step 2: Lint + typecheck final**

Run: `npm run build` (ou `npx next lint && npx tsc --noEmit`)
Expected: build OK, 0 erreur de type.

- [ ] **Step 3: Commit éventuel des correctifs**

```bash
git add -A && git commit -m "fix(agenda): ajustements post-verification e2e"
```

---

## Self-review (couverture spec)

- Liquid glass clair+sombre → Tasks 5,6,7,8 ✓
- 3 vues (Semaine/Mois/Liste) → Tasks 6,7,8 ✓
- Instantané (cache stale-while-revalidate + prefetch) → Tasks 3,4,8 ✓
- Pas de side-stripe / accent=états / contraste → Task 5 (classes) ✓
- Skeleton (pas spinner) / reduced-motion → Tasks 5,8 ✓
- Conserve sync GCal / fiche prospect / création-suppression → Task 8 ✓
- Détail en popover : Task 8 garde le détail ; le passage modale→popover est un raffinement à faire dans le rendu du détail (conserver la modale existante est acceptable si le popover ajoute trop de risque — décision à l'implémentation, noté dans le spec).
- Tests purs (dates, layout, cache) → Tasks 1,2,3 ✓
```
