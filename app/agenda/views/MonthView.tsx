"use client";
import type { CalendarEvent } from "../../lib/googleCalendar";
import { monthGrid, sameDay, dayKeyOf } from "../../lib/calendarDates";

const DOW = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Vue Mois standard (façon Apple) : grille 7×6 qui remplit toute la hauteur
 * disponible — AUCUN scroll, ni vertical ni horizontal. Le jour courant est mis
 * en avant par une pastille pleine sur son numéro. Les cellules clippent leur
 * trop-plein (« +N ») plutôt que de défiler.
 */
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
    <div className="glass-panel h-full flex flex-col overflow-hidden">
      {/* En-têtes jours */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] shrink-0">
        {DOW.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-[10px] uppercase tracking-wider text-neutral-500">{d}</div>
        ))}
      </div>
      {/* 6 semaines réparties sur toute la hauteur */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {grid.map((d, i) => {
          const evs = byDay.get(dayKeyOf(d))?.timed ?? [];
          const today = sameDay(d, now);
          const dim = d.getMonth() !== month;
          const weekend = i % 7 >= 5;
          return (
            <button
              key={i}
              onClick={() => onPickDay(d)}
              className={`relative flex flex-col text-left p-1 border-l border-t border-[var(--color-border)] overflow-hidden transition hover:bg-violet-500/5 ${dim ? "opacity-35" : ""} ${weekend && !dim ? "bg-[var(--color-surface-2)]/30" : ""}`}
            >
              {/* Numéro du jour — pastille pleine si aujourd'hui (façon Apple) */}
              <div className="mb-0.5">
                <span
                  className={`inline-grid place-items-center w-5 h-5 rounded-full text-[11px] leading-none font-mono-num ${
                    today
                      ? "bg-violet-600 text-white font-bold"
                      : dim
                        ? "text-neutral-500"
                        : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              {/* Événements — clippés (pas de scroll), surplus en « +N » */}
              <div className="flex-1 min-h-0 space-y-0.5 overflow-hidden">
                {evs.slice(0, 3).map((e) => {
                  const start = new Date(e.start);
                  const past = new Date(e.end).getTime() < now.getTime();
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}
                      className={`glass-event ${past ? "ev-past" : "ev-normal"} px-1 py-0.5 text-[10px] leading-tight truncate`}
                    >
                      <span className="font-mono-num opacity-80 mr-0.5">{fmtTime(start)}</span>{e.title}
                    </div>
                  );
                })}
                {evs.length > 3 && <div className="text-[9px] text-neutral-500 pl-0.5">+{evs.length - 3}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
