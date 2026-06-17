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
