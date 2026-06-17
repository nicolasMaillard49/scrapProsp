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
