# Supabase Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace localStorage with Supabase for persistent, multi-device, real-time prospect tracking.

**Architecture:** Supabase JS client used directly in React components. All prospect data + call history stored in Supabase. Realtime subscriptions for live sync across devices. Auth unchanged (cookie + middleware).

**Tech Stack:** Supabase JS v2, Next.js 15 (App Router), React 19, TypeScript

---

### Task 1: Install Supabase + Configure Environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env`
- Modify: `.gitignore` (verify `.env` is ignored)

**Step 1: Install Supabase client**

Run: `cd D:/projets/scrapProsp && npm install @supabase/supabase-js`

**Step 2: Update `.env.example`**

Add these lines after the existing `AUTH_PASSWORD` line:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Step 3: Update `.env`**

Add the same Supabase vars with real values (user must create a Supabase project first and paste credentials here).

**Step 4: Verify `.gitignore`**

Ensure `.env` (not `.env.example`) is in `.gitignore`. It already has `.env*.local` but we need plain `.env` too.

**Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: install @supabase/supabase-js and add env vars"
```

---

### Task 2: Create SQL Migration File

**Files:**
- Create: `supabase/migration.sql`

**Step 1: Write the migration SQL**

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Prospects table: combines CSV data + prospection state
CREATE TABLE prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  metier          text,
  phone           text NOT NULL,
  ville           text,
  departement     text,
  region          text,
  region_label    text,
  rating          numeric,
  reviews         integer,
  hours_status    text,
  address         text,
  maps_url        text UNIQUE,
  siret           text,
  company_created_at date,
  age_years       numeric,
  legal_status    text,
  naf_code        text,
  -- Prospection state (formerly in localStorage)
  status          text NOT NULL DEFAULT 'todo',
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_region ON prospects(region);

-- Call history: one row per call
CREATE TABLE calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  called_at   timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL,
  duration    integer,
  note        text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_calls_prospect ON calls(prospect_id);
CREATE INDEX idx_calls_called_at ON calls(called_at DESC);

-- Auto-update updated_at on prospects
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
```

**Step 2: Commit**

```bash
git add supabase/migration.sql
git commit -m "chore: add Supabase SQL migration for prospects + calls tables"
```

**Step 3: Run migration**

User must run this SQL in Supabase Dashboard > SQL Editor. Alternatively, if using Supabase CLI: `supabase db push`.

---

### Task 3: Create Supabase Client Singleton

**Files:**
- Create: `app/lib/supabase.ts`

**Step 1: Write the client module**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 2: Commit**

```bash
git add app/lib/supabase.ts
git commit -m "feat: add Supabase client singleton"
```

---

### Task 4: Create Data Migration Script

**Files:**
- Create: `scripts/migrate-to-supabase.mjs`

This script:
1. Reads the 4 CSV files from `public/`
2. Parses them with PapaParse
3. Reads `public/state-seed.json` for existing state (if any)
4. Upserts all prospects into Supabase
5. Migrates call history from state-seed into the `calls` table

**Step 1: Write the migration script**

```javascript
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import Papa from "papaparse";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const manifest = JSON.parse(readFileSync("public/manifest.json", "utf-8"));

// Load state-seed if it exists
let stateSeed = {};
if (existsSync("public/state-seed.json")) {
  try {
    stateSeed = JSON.parse(readFileSync("public/state-seed.json", "utf-8"));
    console.log(`Loaded state-seed.json with ${Object.keys(stateSeed).length} entries`);
  } catch {}
}

// Parse all CSVs
const allProspects = [];
for (const region of manifest.regions) {
  const csvPath = `public${region.csv}`;
  const csv = readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  for (const row of parsed.data) {
    if (!row.name || !row.phone) continue;
    allProspects.push({
      ...row,
      region: row.region || region.key,
      region_label: row.region_label || region.label,
    });
  }
}

console.log(`Parsed ${allProspects.length} prospects from CSVs`);

// Transform for DB insert
const dbRows = allProspects.map((p) => {
  const state = stateSeed[p.maps_url];
  return {
    name: p.name,
    metier: p.metier || null,
    phone: p.phone,
    ville: p.ville || null,
    departement: p.departement || null,
    region: p.region || null,
    region_label: p.region_label || null,
    rating: p.rating ? Number(p.rating.replace(",", ".")) || null : null,
    reviews: p.reviews ? parseInt(p.reviews, 10) || null : null,
    hours_status: p.hours_status || null,
    address: p.address || null,
    maps_url: p.maps_url || null,
    siret: p.siret || null,
    company_created_at: p.created_at || null,
    age_years: p.age_years ? Number(p.age_years) || null : null,
    legal_status: p.legal_status || null,
    naf_code: p.naf_code || null,
    status: state?.status || "todo",
    notes: state?.notes || "",
  };
});

// Upsert prospects in batches of 100
const BATCH = 100;
let inserted = 0;
for (let i = 0; i < dbRows.length; i += BATCH) {
  const batch = dbRows.slice(i, i + BATCH);
  const { error } = await supabase
    .from("prospects")
    .upsert(batch, { onConflict: "maps_url" });
  if (error) {
    console.error(`Error at batch ${i}:`, error.message);
  } else {
    inserted += batch.length;
  }
}
console.log(`Upserted ${inserted} prospects`);

// Migrate call history
const stateEntries = Object.entries(stateSeed);
let callCount = 0;
for (const [mapsUrl, state] of stateEntries) {
  if (!state.callHistory?.length) continue;

  // Find prospect ID
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id")
    .eq("maps_url", mapsUrl)
    .single();

  if (!prospect) continue;

  const callRows = state.callHistory.map((h) => ({
    prospect_id: prospect.id,
    called_at: h.at,
    status: h.status,
    duration: h.duration || null,
    note: h.note || null,
  }));

  const { error } = await supabase.from("calls").insert(callRows);
  if (error) {
    console.error(`Error migrating calls for ${mapsUrl}:`, error.message);
  } else {
    callCount += callRows.length;
  }
}
console.log(`Migrated ${callCount} call history entries`);
console.log("Migration complete!");
```

**Step 2: Commit**

```bash
git add scripts/migrate-to-supabase.mjs
git commit -m "feat: add data migration script (CSV + state-seed -> Supabase)"
```

**Step 3: Run migration**

```bash
cd D:/projets/scrapProsp
node --env-file=.env scripts/migrate-to-supabase.mjs
```

Expected output:
```
Loaded state-seed.json with N entries
Parsed 460 prospects from CSVs
Upserted 460 prospects
Migrated X call history entries
Migration complete!
```

---

### Task 5: Update Types

**Files:**
- Modify: `app/lib/types.ts`

Replace the entire file. The key changes:
- `Prospect` now matches the DB row (numeric rating/reviews, uuid id, status/notes inline)
- `ProspectState` interface is removed (status/notes are now on Prospect)
- `Call` replaces the inline callHistory array
- `RegionEntry` / `Manifest` are removed (no more manifest.json)

**Step 1: Rewrite types.ts**

```typescript
export type Status = "todo" | "called" | "positive" | "negative" | "no_answer";

export interface Prospect {
  id: string;
  name: string;
  metier: string;
  phone: string;
  ville: string;
  departement: string;
  region: string;
  region_label: string | null;
  rating: number | null;
  reviews: number | null;
  hours_status: string | null;
  address: string | null;
  maps_url: string;
  siret: string | null;
  company_created_at: string | null;
  age_years: number | null;
  legal_status: string | null;
  naf_code: string | null;
  status: Status;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined from calls table
  calls?: Call[];
}

export interface Call {
  id: string;
  prospect_id: string;
  called_at: string;
  status: Status;
  duration: number | null;
  note: string | null;
  created_at: string;
}
```

**Step 2: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat: update types to match Supabase schema"
```

---

### Task 6: Create useProspects Hook

**Files:**
- Create: `app/lib/useProspects.ts`

This hook:
- Fetches all prospects + their calls on mount
- Subscribes to Supabase Realtime for both tables
- Provides functions: `updateStatus`, `updateNotes`, `addCall`, `resetProspect`, `importProspects`
- Returns: `{ prospects, regions, loaded, updateStatus, updateNotes, addCall, resetProspect, importProspects }`

**Step 1: Write the hook**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { Call, Prospect, Status } from "./types";

export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  // --- Initial fetch ---
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*, calls(*)")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load prospects:", error.message);
        setLoaded(true);
        return;
      }
      setProspects(data as Prospect[]);
      setLoaded(true);
      loadedRef.current = true;
    })();
  }, []);

  // --- Realtime subscriptions ---
  useEffect(() => {
    const channel = supabase
      .channel("prospects-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prospects" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newP = payload.new as Prospect;
            setProspects((prev) => {
              if (prev.some((p) => p.id === newP.id)) return prev;
              return [...prev, { ...newP, calls: [] }];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Prospect;
            setProspects((prev) =>
              prev.map((p) =>
                p.id === updated.id ? { ...p, ...updated, calls: p.calls } : p
              )
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setProspects((prev) => prev.filter((p) => p.id !== old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        (payload) => {
          const newCall = payload.new as Call;
          setProspects((prev) =>
            prev.map((p) =>
              p.id === newCall.prospect_id
                ? { ...p, calls: [...(p.calls || []), newCall] }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Mutations ---
  const updateStatus = useCallback(
    async (prospectId: string, status: Status, duration?: number) => {
      // Optimistic update
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, status } : p))
      );

      const { error: updateError } = await supabase
        .from("prospects")
        .update({ status })
        .eq("id", prospectId);

      if (updateError) console.error("updateStatus:", updateError.message);

      // Insert call record if not resetting to todo
      if (status !== "todo") {
        const { data: call, error: callError } = await supabase
          .from("calls")
          .insert({
            prospect_id: prospectId,
            status,
            duration: duration ?? null,
            called_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (callError) {
          console.error("addCall:", callError.message);
        } else if (call) {
          // Optimistic: add call to local state (realtime will also fire but we dedupe)
          setProspects((prev) =>
            prev.map((p) =>
              p.id === prospectId
                ? { ...p, calls: [...(p.calls || []), call as Call] }
                : p
            )
          );
        }
      }
    },
    []
  );

  const updateNotes = useCallback(async (prospectId: string, notes: string) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, notes } : p))
    );
    const { error } = await supabase
      .from("prospects")
      .update({ notes })
      .eq("id", prospectId);
    if (error) console.error("updateNotes:", error.message);
  }, []);

  const resetProspect = useCallback(async (prospectId: string) => {
    setProspects((prev) =>
      prev.map((p) =>
        p.id === prospectId ? { ...p, status: "todo" as Status, notes: "" } : p
      )
    );
    const { error } = await supabase
      .from("prospects")
      .update({ status: "todo", notes: "" })
      .eq("id", prospectId);
    if (error) console.error("resetProspect:", error.message);
  }, []);

  const importProspects = useCallback(
    async (rows: Array<Record<string, string>>) => {
      const dbRows = rows
        .filter((r) => r.name && r.phone)
        .map((r) => ({
          name: r.name,
          metier: r.metier || null,
          phone: r.phone,
          ville: r.ville || null,
          departement: r.departement || null,
          region: r.region || "import",
          region_label: r.region_label || null,
          rating: r.rating ? Number(r.rating.replace(",", ".")) || null : null,
          reviews: r.reviews ? parseInt(r.reviews, 10) || null : null,
          hours_status: r.hours_status || null,
          address: r.address || null,
          maps_url: r.maps_url || null,
          siret: r.siret || null,
          company_created_at: r.created_at || null,
          age_years: r.age_years ? Number(r.age_years) || null : null,
          legal_status: r.legal_status || null,
          naf_code: r.naf_code || null,
        }));

      const { data, error } = await supabase
        .from("prospects")
        .upsert(dbRows, { onConflict: "maps_url" })
        .select("*, calls(*)");

      if (error) {
        console.error("importProspects:", error.message);
        return 0;
      }

      // Merge into local state
      if (data) {
        setProspects((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          for (const p of data as Prospect[]) byId.set(p.id, p);
          return Array.from(byId.values());
        });
      }
      return dbRows.length;
    },
    []
  );

  // --- Derived: distinct regions ---
  const regions = Array.from(
    new Map(
      prospects
        .filter((p) => p.region)
        .map((p) => [p.region, { key: p.region, label: p.region_label || p.region }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  return {
    prospects,
    regions,
    loaded,
    updateStatus,
    updateNotes,
    resetProspect,
    importProspects,
  };
}
```

**Step 2: Commit**

```bash
git add app/lib/useProspects.ts
git commit -m "feat: add useProspects hook with Supabase CRUD + realtime"
```

---

### Task 7: Update sirene.ts for New Types

**Files:**
- Modify: `app/lib/sirene.ts:1-64`

The functions use `Prospect` type. With the new types, `created_at` is now `company_created_at`, `rating`/`reviews` are already numeric, and `age_years` is already a number. Update the functions.

**Step 1: Update sirene.ts**

Change imports and function signatures. Key changes:
- `yearsSince` receives `company_created_at` (was `created_at`)
- `ageYears`: use `p.company_created_at` instead of `p.created_at`, `p.age_years` is already a number (no `Number()` parse needed)

```typescript
import type { Prospect } from "./types";

export function yearsSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

export function isRadie(p: Prospect): boolean {
  return p.legal_status === "radie";
}

export function ageYears(p: Prospect): number | null {
  const live = yearsSince(p.company_created_at);
  if (live !== null) return live;
  return p.age_years ?? null;
}

export function isJeune(p: Prospect, threshold = 5): boolean {
  const a = ageYears(p);
  return a !== null && a < threshold;
}
```

Leave `ageBadge` and `AgeBadgeInfo` unchanged (they work with `number | null` already).

**Step 2: Commit**

```bash
git add app/lib/sirene.ts
git commit -m "fix: update sirene.ts for new Prospect type (company_created_at)"
```

---

### Task 8: Update openNow.ts for New Types

**Files:**
- Modify: `app/lib/openNow.ts:31-35`

The `isOpenNow` function uses `Pick<Prospect, "hours_status">`. Since `hours_status` is now `string | null` instead of `string | undefined`, this still works — no changes needed.

No action required for this task. Skip to Task 9.

---

### Task 9: Rewrite page.tsx — Data Layer

**Files:**
- Modify: `app/page.tsx`

This is the biggest change. The strategy: replace localStorage + CSV loading with `useProspects()` hook, and adapt all references from `states[p.maps_url]` keying to using `p.status`/`p.notes` directly on the prospect object.

**Step 1: Update imports (lines 1-22)**

Replace:
```typescript
import Papa from "papaparse";
import type { Manifest, Prospect, ProspectState, Status } from "./lib/types";
```
With:
```typescript
import Papa from "papaparse";
import type { Prospect, Status } from "./lib/types";
import { useProspects } from "./lib/useProspects";
```

**Step 2: Remove STORAGE_KEY constant (line 23)**

Delete: `const STORAGE_KEY = "prospects-tracker-state-v2";`

**Step 3: Replace state declarations and data loading (lines 33-116)**

Replace the state declarations and the three useEffects (localStorage read, CSV load, localStorage write) with the hook:

```typescript
function HomeInner() {
  const toast = useToast();
  const {
    prospects,
    regions,
    loaded,
    updateStatus,
    updateNotes,
    resetProspect,
    importProspects,
  } = useProspects();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [metierFilter, setMetierFilter] = useState<"all" | "plombier" | "electricien">("all");
  const [villeFilter, setVilleFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [hideRadie, setHideRadie] = useState(true);
  const [jeuneOnly, setJeuneOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"reviews" | "reviews-asc" | "rating" | "name" | "age-asc" | "age-desc">("reviews");
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusStart, setFocusStart] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [callTarget, setCallTarget] = useState<Prospect | null>(null);
  const [callTab, setCallTab] = useState<"call" | "rdv">("call");
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
```

Remove:
- The `states` useState
- The `loaded` useState (comes from hook)
- The `regions` useState (comes from hook)
- The `scrapeDate` useState (no longer needed, use `now` directly)
- The localStorage read useEffect (lines 64-112)
- The localStorage write useEffect (lines 114-116)

**Step 4: Replace state accessor pattern throughout**

The old pattern was: `states[p.maps_url]?.status || "todo"` and `states[p.maps_url]?.notes || ""`

New pattern: `p.status` and `p.notes` (these are directly on the Prospect object now)

Similarly, the old `callHistory` was `states[p.maps_url]?.callHistory`, now it's `p.calls`.

Search and replace throughout page.tsx:
- `states[p.maps_url]?.status || "todo"` → `p.status`
- `states[p.maps_url]?.notes || ""` → `p.notes`
- `states[p.maps_url]` → `{ status: p.status, notes: p.notes }` (where full ProspectState was used)
- `const state = states[p.maps_url] || { status: "todo" as Status, notes: "" }` → `const state = p` (since status/notes are on prospect)

**Step 5: Replace mutation functions (lines 118-157)**

Remove `updateNote`, `setStatus`, `resetState`, `setStatusWithRdv` functions.

Replace with wrappers around the hook functions. The key difference: the hook uses `prospect.id` (uuid) instead of `maps_url` as the key.

```typescript
  const handleUpdateNote = (prospectId: string, notes: string) => {
    updateNotes(prospectId, notes);
  };

  const handleSetStatus = (prospectId: string, status: Status, duration?: number) => {
    updateStatus(prospectId, status, duration);
  };

  const handleResetState = (prospectId: string) => {
    resetProspect(prospectId);
    toast.push("info", "Statut reinitialisé");
  };

  const promptRdvFor = (p: Prospect) => {
    setCallTarget(p);
    setCallTab("rdv");
  };

  const setStatusWithRdv = (p: Prospect, status: Status) => {
    const wasNotPositive = p.status !== "positive";
    handleSetStatus(p.id, status);
    if (status === "positive" && wasNotPositive) {
      toast.push("success", `${p.name} marque positif`);
      setTimeout(() => promptRdvFor(p), 400);
    }
  };
```

**Step 6: Update enriched/stats/filtering memos**

In the `enriched` memo, `stats` memo, and `filtered` memo, replace all `states[p.maps_url]?.status || "todo"` with `p.status`.

For `enriched` (line 159):
```typescript
const enriched = useMemo(
  () => prospects.map((p) => ({ p, _age: ageYears(p), _radie: isRadie(p), _jeune: isJeune(p) })),
  [prospects],
);
```
This stays the same since `ageYears`/`isRadie`/`isJeune` use the Prospect type.

For `stats` (line 164):
```typescript
const s = { ... };
for (const e of pool) {
  const st = e.p.status;  // was: states[e.p.maps_url]?.status || "todo"
  s[st]++;
  ...
}
```
Remove `states` from the dependency array.

For `filtered` (line 183):
```typescript
const st = p.status;  // was: states[p.maps_url]?.status || "todo"
```
Remove `states` from the dependency array.

**Step 7: Update rating/reviews comparisons**

Since `rating` is now `number | null` (not a string), update sort comparisons:

```typescript
if (sortBy === "reviews") return (b.p.reviews ?? 0) - (a.p.reviews ?? 0);
if (sortBy === "reviews-asc") return (a.p.reviews ?? 0) - (b.p.reviews ?? 0);
if (sortBy === "rating") return (b.p.rating ?? 0) - (a.p.rating ?? 0);
```

Also in the template, `p.rating` display needs `String(p.rating)` or template literal since it's now a number:
```typescript
// Old: {p.rating}
// New: {p.rating}  — JSX handles numbers fine, no change needed
// Old: p.rating?.replace(",", ".") — remove the replace, it's already a number
```

**Step 8: Remove snapshot-related code (lines 260-302)**

Delete:
- `snapshotBusy` state
- `pushStateSnapshot` function
- `downloadStateJson` function
- The "Sync" button in the header (lines 386-394)

**Step 9: Update export function (lines 304-321)**

Update to use `p.status` directly:

```typescript
const exportCsv = () => {
  const rows = filtered.map((p) => ({
    name: p.name,
    metier: p.metier,
    phone: p.phone,
    ville: p.ville,
    departement: p.departement,
    region: p.region,
    region_label: p.region_label,
    rating: p.rating,
    reviews: p.reviews,
    address: p.address,
    maps_url: p.maps_url,
    status: statusConfig[p.status].label,
    notes: p.notes,
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.push("success", `Export CSV de ${rows.length} prospects`);
};
```

**Step 10: Update import function (lines 323-337)**

Replace the in-memory CSV import with the hook's `importProspects`:

```typescript
const importCsv = async (file: File) => {
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const count = await importProspects(parsed.data);
  toast.push("success", `${count} prospects ajoutes / fusionnes`);
};
```

**Step 11: Update all ID references from maps_url to id**

Throughout the render, change all occurrences of:
- `p.maps_url` as key prop → `p.id` (or keep `p.maps_url` as React key since it's unique too — either works)
- `setStatus(p.maps_url, ...)` → `handleSetStatus(p.id, ...)`
- `updateNote(p.maps_url, ...)` → `handleUpdateNote(p.id, ...)`
- `resetState(p.maps_url)` → `handleResetState(p.id)`

For `state` variable in render loops, change from:
```typescript
const state = states[p.maps_url] || { status: "todo" as Status, notes: "" };
```
To just using `p` directly:
```typescript
const cfg = statusConfig[p.status];
```
And replace `state.status` with `p.status`, `state.notes` with `p.notes`.

**Step 12: Update regions display (lines 398-425)**

The regions now come from the hook as `{ key, label }[]` (not `RegionEntry` with totals). Update:

```typescript
{regions.length > 1 && (
  <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
    <button
      onClick={() => { setRegionFilter("all"); setVilleFilter("all"); }}
      className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition ${
        regionFilter === "all"
          ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
          : "bg-[var(--color-surface)]/50 border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
      }`}
    >
      <Globe className="w-3 h-3 inline mr-1" />
      Toutes ({prospects.length})
    </button>
    {regions.map((r) => {
      const count = prospects.filter((p) => p.region === r.key).length;
      return (
        <button
          key={r.key}
          onClick={() => { setRegionFilter(r.key); setVilleFilter("all"); }}
          className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition ${
            regionFilter === r.key
              ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
              : "bg-[var(--color-surface)]/50 border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
          }`}
        >
          {r.label} <span className="text-neutral-600">({count})</span>
        </button>
      );
    })}
  </div>
)}
```

**Step 13: Update scrapeDate references**

`scrapeDate` was used in `isOpenNow(p, now, scrapeDate)` and `openLabel(p, now, scrapeDate)`. Since we no longer have a CSV scrape date, pass `now` for both:

```typescript
const isOpen = isOpenNow(p, now, now);
```

And in `openLabel`:
```typescript
openLabel(p, now, now)
```

**Step 14: Update footer (line 815)**

Change:
```typescript
<span>Stockage local · {Object.keys(states).length} interactions enregistrees</span>
```
To:
```typescript
<span>Supabase · {prospects.filter(p => p.status !== "todo").length} interactions enregistrees</span>
```

**Step 15: Update "Tout reinitialiser" (lines 816-826)**

This cleared localStorage. Now it would need to reset all prospects in DB — probably too dangerous. Either remove the button or make it clear all local filters only:

```typescript
<button
  onClick={() => {
    if (confirm("Reinitialiser tous les filtres ?")) {
      resetFilters();
      toast.push("info", "Filtres reinitialises");
    }
  }}
  className="flex items-center gap-1 hover:text-rose-400 transition"
>
  <Trash2 className="w-3 h-3" /> Reinitialiser les filtres
</button>
```

**Step 16: Update FocusMode props (lines 830-838)**

Change:
```typescript
<FocusMode
  open={focusOpen}
  prospects={filtered}
  initialIndex={focusStart}
  onClose={() => setFocusOpen(false)}
  onSetStatus={handleSetStatus}
  onUpdateNote={handleUpdateNote}
/>
```

Remove the `states` prop — FocusMode will read status/notes from the prospect directly.

**Step 17: Update CallModal props (lines 840-877)**

Change to pass prospect directly (which now contains status, notes, calls):
```typescript
<CallModal
  open={!!callTarget}
  prospect={callTarget}
  isOpen={callTarget ? isOpenNow(callTarget, now, now) : undefined}
  hoursLabel={callTarget ? openLabel(callTarget, now, now) : undefined}
  initialTab={callTab}
  onClose={() => setCallTarget(null)}
  onMarkCalled={() => {
    if (callTarget) {
      handleSetStatus(callTarget.id, "called");
      toast.push("success", `${callTarget.name} marque appele`);
      setCallTarget(null);
    }
  }}
  onMarkPositive={() => {
    if (callTarget) {
      handleSetStatus(callTarget.id, "positive");
      toast.push("success", `${callTarget.name} marque positif`);
      setCallTab("rdv");
    }
  }}
  onMarkNoAnswer={() => {
    if (callTarget) {
      handleSetStatus(callTarget.id, "no_answer");
      toast.push("success", `${callTarget.name} — pas de reponse`);
      setCallTarget(null);
    }
  }}
  onMarkNegative={() => {
    if (callTarget) {
      handleSetStatus(callTarget.id, "negative");
      toast.push("success", `${callTarget.name} marque negatif`);
      setCallTarget(null);
    }
  }}
/>
```

**Step 18: Commit**

```bash
git add app/page.tsx
git commit -m "feat: rewrite page.tsx to use Supabase instead of localStorage"
```

---

### Task 10: Update FocusMode Component

**Files:**
- Modify: `app/components/FocusMode.tsx`

**Step 1: Update Props and state access**

Remove `states` prop. Read status/notes from `prospect` directly.

Change the Props interface:
```typescript
interface Props {
  open: boolean;
  prospects: Prospect[];
  initialIndex: number;
  onClose: () => void;
  onSetStatus: (id: string, status: Status, duration?: number) => void;
  onUpdateNote: (id: string, note: string) => void;
}
```

Change `currentState` from `states[current.maps_url]` to just using `current`:
```typescript
const currentStatus = current?.status || "todo";
const currentNotes = current?.notes || "";
```

Update `noteDraft` initialization:
```typescript
useEffect(() => {
  setNoteDraft(current?.notes || "");
}, [current?.id, current?.notes]);
```

Update `finalize` to use `current.id` instead of `current.maps_url`:
```typescript
const finalize = (status: Status) => {
  if (!current) return;
  const duration = callingSince ? Math.floor((Date.now() - callingSince) / 1000) : undefined;
  onSetStatus(current.id, status, duration);
  if (noteDraft !== (current.notes || "")) {
    onUpdateNote(current.id, noteDraft);
  }
  // ... rest stays the same
};
```

Update `onBlur` on textarea:
```typescript
onBlur={() => current && onUpdateNote(current.id, noteDraft)}
```

Update `rating` display — it's now a number, not a string:
```typescript
{current.rating && (
  <span className="text-xs text-neutral-500 flex items-center gap-1">
    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
    {current.rating} ({current.reviews})
  </span>
)}
```

**Step 2: Commit**

```bash
git add app/components/FocusMode.tsx
git commit -m "feat: update FocusMode to read status/notes from prospect directly"
```

---

### Task 11: Update CallModal Component

**Files:**
- Modify: `app/components/CallModal.tsx`

**Step 1: Update Props**

Remove `state?: ProspectState` prop. Read status/notes/calls from `prospect` directly.

```typescript
interface Props {
  open: boolean;
  prospect: Prospect | null;
  isOpen?: boolean;
  hoursLabel?: string;
  initialTab?: "call" | "rdv";
  onClose: () => void;
  onMarkCalled?: () => void;
  onMarkPositive?: () => void;
  onMarkNoAnswer?: () => void;
  onMarkNegative?: () => void;
}
```

**Step 2: Update state references**

Replace:
- `state?.notes` → `prospect?.notes`
- `state?.calledAt` → last call from `prospect?.calls`
- `state?.callDuration` → last call duration
- `state?.callHistory` → `prospect?.calls`
- `state?.status` → `prospect?.status`

For last call info:
```typescript
const calls = prospect?.calls || [];
const sortedCalls = [...calls].sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
const lastCall = sortedCalls[0];
const currentStatus: Status = prospect?.status || "todo";
```

For the history display:
```typescript
{sortedCalls.length > 0 && (
  <details ...>
    <summary ...>
      Historique des appels ({sortedCalls.length})
    </summary>
    <ul ...>
      {sortedCalls.slice(0, 10).map((h) => (
        <li key={h.id} ...>
          ...
          <div>{statusLabel[h.status as Status].label}
            {h.duration ? <span> · {formatDuration(h.duration)}</span> : null}
          </div>
          <div>{formatRelativeTime(h.called_at)}</div>
          {h.note && <div>{h.note}</div>}
        </li>
      ))}
    </ul>
  </details>
)}
```

For the "last call" banner:
```typescript
{lastCall && (
  <div className="mb-3 px-3 py-2 ...">
    Dernier appel <span>{formatRelativeTime(lastCall.called_at)}</span>
    {lastCall.duration ? ` · ${formatDuration(lastCall.duration)}` : ""}
  </div>
)}
```

**Step 3: Update rating display**

`rating` is now a number, remove the `.replace(",", ".")`:
```typescript
const rating = prospect?.rating;
const hasRating = rating != null && rating > 0;
```

Display: `{rating}` (number renders fine in JSX).

**Step 4: Commit**

```bash
git add app/components/CallModal.tsx
git commit -m "feat: update CallModal to use Prospect.calls instead of ProspectState.callHistory"
```

---

### Task 12: Update AgeBadge Component

**Files:**
- Modify: `app/components/AgeBadge.tsx`

Check if AgeBadge uses `Prospect` type — it likely does via `ageBadge(prospect)`. Since the `Prospect` type changed (`created_at` → `company_created_at`), and `ageBadge` calls `ageYears` which we already updated in Task 7, AgeBadge should work without changes.

**Step 1: Read and verify AgeBadge.tsx**

Read the file. If it uses `prospect.siret` for display, ensure it still works with `string | null`.

**Step 2: Fix any type errors if needed, commit if changed**

---

### Task 13: Delete Dead Code

**Files:**
- Delete: `app/api/snapshot/route.ts`
- Delete: `public/state-seed.json`

Keep the CSV files and manifest.json for now (they're the data source for the migration script and serve as backup).

**Step 1: Delete snapshot route**

```bash
rm app/api/snapshot/route.ts
rmdir app/api/snapshot
rmdir app/api 2>/dev/null  # remove if empty
```

**Step 2: Delete state-seed.json**

```bash
rm public/state-seed.json
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove snapshot API and state-seed.json (replaced by Supabase)"
```

---

### Task 14: Debounce Notes Input

**Files:**
- Modify: `app/page.tsx` (notes input onChange handlers)

Currently, `updateNote` fires on every keystroke, which now means a Supabase write per keystroke. Add a simple debounce: only save to DB on blur (already the pattern in FocusMode) or with a 500ms debounce.

**Step 1: Add debounced notes update**

In page.tsx, change the notes input from controlled to use a local draft + onBlur pattern:

The simplest approach: wrap `handleUpdateNote` with a debounce. Create a small inline debounce or use `useRef` + `setTimeout`.

Add near the top of `HomeInner`:
```typescript
const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

const debouncedUpdateNote = (prospectId: string, notes: string) => {
  clearTimeout(noteTimers.current[prospectId]);
  noteTimers.current[prospectId] = setTimeout(() => {
    updateNotes(prospectId, notes);
  }, 500);
};
```

Then in the notes inputs, use `debouncedUpdateNote` instead of `handleUpdateNote` for `onChange`, and keep `handleUpdateNote` for `onBlur`:

```typescript
<input
  type="text"
  placeholder="Notes…"
  value={p.notes}
  onChange={(e) => debouncedUpdateNote(p.id, e.target.value)}
  onBlur={(e) => handleUpdateNote(p.id, e.target.value)}
  className="..."
/>
```

Wait — since the value is bound to `p.notes` which comes from the hook's optimistic state, the `updateNotes` call in the hook does an optimistic update. So this should work: each keystroke updates local state immediately, but the DB write is debounced.

Actually, this creates a problem: each call to `updateNotes` does both optimistic local update AND DB write. We need to split: let the component handle local display state, and only call the hook (which writes to DB) on debounce/blur.

Simpler approach: change the notes inputs to be uncontrolled with a local state per row. But that's complex for a list.

Best approach: in `useProspects`, the `updateNotes` already does optimistic update. The debounce should just delay the DB call. Let's modify `updateNotes` to accept an `immediate` parameter, or let the component control timing.

Actually simplest: just fire on blur. The current FocusMode already does this. For the table/card views, change onChange to just do optimistic local update via a separate function that doesn't touch the DB, and fire the real `updateNotes` on blur only.

Let me simplify: add a `setLocalNotes` to the hook that only updates React state (no DB), and use `updateNotes` (with DB write) only on blur.

Add to `useProspects`:
```typescript
const setLocalNotes = useCallback((prospectId: string, notes: string) => {
  setProspects((prev) =>
    prev.map((p) => (p.id === prospectId ? { ...p, notes } : p))
  );
}, []);
```

Then in page.tsx:
```typescript
onChange={(e) => setLocalNotes(p.id, e.target.value)}
onBlur={(e) => updateNotes(p.id, e.target.value)}
```

**Step 2: Commit**

```bash
git add app/lib/useProspects.ts app/page.tsx
git commit -m "fix: debounce notes — local state on keystroke, DB write on blur"
```

---

### Task 15: Test End-to-End

**Step 1: Start dev server**

```bash
cd D:/projets/scrapProsp && npm run dev
```

**Step 2: Manual verification checklist**

- [ ] App loads and shows all prospects from Supabase
- [ ] Region tabs work (derived from DB data)
- [ ] Clicking a status button updates the prospect in DB
- [ ] Notes save on blur
- [ ] Call history appears in CallModal
- [ ] Focus Mode works (status changes, notes, navigation)
- [ ] CSV import works (upserts to Supabase)
- [ ] CSV export works
- [ ] Open a second browser/tab — changes sync in real-time
- [ ] No localStorage errors in console
- [ ] `npm run build` succeeds

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Supabase migration complete — realtime multi-device prospect tracking"
```
