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
    return <div className="glass-panel p-10 text-center text-sm text-[var(--color-text-muted)]">Aucun RDV à venir. Double-clique un créneau en vue Semaine pour en créer un.</div>;
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
          <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 px-1 ${sameDay(g.date, now) ? "text-violet-500" : "text-[var(--color-text-muted)]"}`}>
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
