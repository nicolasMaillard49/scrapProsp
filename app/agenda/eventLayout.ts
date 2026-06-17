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
