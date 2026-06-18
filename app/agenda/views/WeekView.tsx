"use client";
import type { CalendarEvent } from "../../lib/googleCalendar";
import { sameDay, addDays, dayKeyOf } from "../../lib/calendarDates";
import { layoutDay } from "../eventLayout";

const DAY_START = 7, DAY_END = 23;
const SPAN = DAY_END - DAY_START; // 16 h affichées
const DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
/** Position verticale (%) d'une heure décimale dans la plage affichée. */
const pctOf = (h: number) => ((h - DAY_START) / SPAN) * 100;

/**
 * Vue Semaine sans AUCUN scroll (ni vertical ni horizontal) : la grille horaire
 * remplit toute la hauteur disponible et les 7 colonnes se partagent la largeur.
 * Positionnement des événements en pourcentage de la plage 7h–23h (pas de px fixes).
 */
export default function WeekView({
  weekStart, now, byDay, onOpen, onCreateAt,
}: {
  weekStart: Date;
  now: Date;
  byDay: Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>;
  onOpen: (e: CalendarEvent) => void;
  onCreateAt: (d: Date) => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: SPAN + 1 }, (_, i) => DAY_START + i); // 7..23
  const cols = "40px repeat(7,minmax(0,1fr))";

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden">
      {/* En-têtes jours */}
      <div className="grid shrink-0 border-b border-[var(--color-border-strong)]" style={{ gridTemplateColumns: cols }}>
        <div />
        {weekDays.map((d, i) => {
          const today = sameDay(d, now);
          return (
            <div key={i} className={`px-1 py-1.5 text-center ${today ? "bg-violet-500/10 rounded-t-lg" : ""}`}>
              <div className={`text-[9px] uppercase tracking-wider ${today ? "text-violet-500 font-bold" : "text-neutral-500"}`}>{DAYS[i]}</div>
              <div className={`text-base leading-tight font-mono-num ${today ? "text-violet-500 font-bold" : "text-[var(--color-text-primary)]"}`}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Corps — remplit la hauteur restante, zéro scroll */}
      <div className="grid relative flex-1 min-h-0" style={{ gridTemplateColumns: cols }}>
        {/* Colonne des heures */}
        <div className="relative">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[9px] text-neutral-400 dark:text-neutral-600 font-mono-num"
              style={{ top: `${(i / SPAN) * 100}%` }}
            >
              {i > 0 && i < SPAN ? `${h}h` : ""}
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
              className={`relative border-l border-[var(--color-border)] ${today ? "bg-violet-500/[0.04]" : di >= 5 ? "bg-[var(--color-surface-2)]/30" : ""}`}
              onDoubleClick={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const frac = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
                const snapped = Math.round((frac * SPAN * 60) / 30) * 30; // arrondi 30 min
                const def = new Date(d);
                def.setHours(DAY_START + Math.floor(snapped / 60), snapped % 60, 0, 0);
                onCreateAt(def);
              }}
              title="Double-clic : nouveau RDV"
            >
              {/* lignes des heures (pleines) */}
              {hours.slice(0, -1).map((h, i) => (
                <div key={h} className="absolute left-0 right-0 border-t border-[var(--color-border)]" style={{ top: `${(i / SPAN) * 100}%` }} />
              ))}

              {/* trait "maintenant" */}
              {today && now.getHours() >= DAY_START && now.getHours() < DAY_END && (
                <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${pctOf(now.getHours() + now.getMinutes() / 60)}%` }}>
                  <div className="h-[2px] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,.7)]" />
                  <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px]" />
                </div>
              )}

              {dayEvents.map((e) => {
                const start = new Date(e.start), end = new Date(e.end);
                const startH = start.getHours() + start.getMinutes() / 60;
                const endH = end.getHours() + end.getMinutes() / 60;
                const top = Math.min(Math.max(0, pctOf(startH)), 100);
                const bottom = Math.min(Math.max(0, pctOf(Math.min(endH, DAY_END))), 100);
                const height = Math.max(bottom - top, 2.2); // hauteur min visible
                const l = lay.get(e.id) ?? { col: 0, cols: 1 };
                const w = 100 / l.cols;
                const past = end.getTime() < now.getTime();
                const ongoing = !past && start.getTime() <= now.getTime();
                const cls = past ? "ev-past" : ongoing ? "ev-now" : "ev-normal";
                return (
                  <button
                    key={e.id}
                    onClick={() => onOpen(e)}
                    title={`${e.title} · ${fmtTime(start)}–${fmtTime(end)}`}
                    className={`glass-event ${cls} absolute px-1 py-0.5 text-left overflow-hidden hover:z-20 hover:shadow-lg`}
                    style={{ top: `${top}%`, height: `${height}%`, left: `calc(${l.col * w}% + 1px)`, width: `calc(${w}% - 2px)` }}
                  >
                    <div className="text-[10px] font-semibold leading-tight truncate">{e.title}</div>
                    <div className="text-[9px] font-mono-num opacity-80 truncate">{fmtTime(start)}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
