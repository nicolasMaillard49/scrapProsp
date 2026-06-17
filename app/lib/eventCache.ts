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
