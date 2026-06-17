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
