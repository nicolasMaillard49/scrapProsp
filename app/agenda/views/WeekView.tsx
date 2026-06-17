"use client";
import { useRef } from "react";
import type { CalendarEvent } from "../../lib/googleCalendar";
import { sameDay, addDays, dayKeyOf } from "../../lib/calendarDates";
import { layoutDay } from "../eventLayout";

const DAY_START = 7, DAY_END = 21, HOUR_PX = 52;
const GRID_H = (DAY_END - DAY_START) * HOUR_PX;
const DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const fmtTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function WeekView({
  weekStart, now, byDay, onOpen, onCreateAt,
}: {
  weekStart: Date;
  now: Date;
  byDay: Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>;
  onOpen: (e: CalendarEvent) => void;
  onCreateAt: (d: Date) => void;
}) {
  const nowRef = useRef<HTMLDivElement | null>(null);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* En-têtes jours */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: "52px repeat(7,1fr)" }}>
            <div />
            {weekDays.map((d, i) => {
              const today = sameDay(d, now);
              return (
                <div key={i} className={`px-2 py-2.5 text-center ${today ? "bg-violet-500/10 rounded-t-lg" : ""}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${today ? "text-violet-500 font-bold" : "text-neutral-500"}`}>{DAYS[i]}</div>
                  <div className={`text-lg font-mono-num ${today ? "text-violet-500 font-bold" : "text-[var(--color-text-primary)]"}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {/* Corps */}
          <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7,1fr)" }}>
            <div className="relative" style={{ height: GRID_H }}>
              {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                <div key={i} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-neutral-400 dark:text-neutral-600 font-mono-num" style={{ top: i * HOUR_PX }}>
                  {i > 0 ? `${DAY_START + i}h` : ""}
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
                  className={`relative border-l border-white/5 ${today ? "bg-violet-500/[0.04]" : di >= 5 ? "bg-[var(--color-surface-2)]/30" : ""}`}
                  style={{ height: GRID_H }}
                  onDoubleClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const half = Math.min(Math.max(Math.floor((e.clientY - rect.top) / (HOUR_PX / 2)), 0), (DAY_END - DAY_START) * 2 - 1);
                    const def = new Date(d);
                    def.setHours(DAY_START + Math.floor(half / 2), (half % 2) * 30, 0, 0);
                    onCreateAt(def);
                  }}
                  title="Double-clic : nouveau RDV"
                >
                  {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-white/5" style={{ top: i * HOUR_PX }} />
                  ))}
                  {today && now.getHours() >= DAY_START && now.getHours() < DAY_END && (
                    <div ref={nowRef} className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: (now.getHours() - DAY_START + now.getMinutes() / 60) * HOUR_PX }}>
                      <div className="h-[2px] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,.7)]" />
                      <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px]" />
                    </div>
                  )}
                  {dayEvents.map((e) => {
                    const start = new Date(e.start), end = new Date(e.end);
                    const startH = start.getHours() + start.getMinutes() / 60;
                    const endH = end.getHours() + end.getMinutes() / 60;
                    const top = Math.min(Math.max(0, (startH - DAY_START) * HOUR_PX), GRID_H - 26);
                    const height = Math.min(Math.max(26, (Math.min(endH, DAY_END) - Math.max(startH, DAY_START)) * HOUR_PX - 2), GRID_H - top - 2);
                    const l = lay.get(e.id) ?? { col: 0, cols: 1 };
                    const w = 96 / l.cols;
                    const past = end.getTime() < now.getTime();
                    const ongoing = !past && start.getTime() <= now.getTime();
                    const cls = past ? "ev-past" : ongoing ? "ev-now" : "ev-normal";
                    return (
                      <button key={e.id} onClick={() => onOpen(e)} title={`${e.title} · ${fmtTime(start)}–${fmtTime(end)}`}
                        className={`glass-event ${cls} absolute px-1.5 py-1 text-left hover:z-20 hover:shadow-lg`}
                        style={{ top, height, left: `${2 + l.col * w}%`, width: `calc(${w}% - 2px)` }}>
                        <div className="text-[11px] font-semibold leading-tight truncate">{e.title}</div>
                        <div className="text-[10px] font-mono-num opacity-80">{fmtTime(start)}{height > 38 ? ` – ${fmtTime(end)}` : ""}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
