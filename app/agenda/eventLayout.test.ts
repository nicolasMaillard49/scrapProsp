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
