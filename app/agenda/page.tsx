"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2,
  MapPin, ExternalLink, Trash2, Clock, RefreshCw, Settings,
} from "lucide-react";
import type { CalendarEvent } from "../lib/googleCalendar";

/* ── Constantes d'affichage ── */
const DAY_START = 7; // 7h
const DAY_END = 21; // 21h
const HOUR_PX = 52;
const GRID_H = (DAY_END - DAY_START) * HOUR_PX;
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/* ── Helpers dates ── */
function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (out.getDay() + 6) % 7; // lundi = 0
  out.setDate(out.getDate() - day);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDayLong(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date): { date: string; time: string } {
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/* ── Layout des chevauchements (style Google Calendar) ──
   Les événements qui se chevauchent sont répartis en colonnes côte à côte :
   chaque cluster d'événements connectés partage la largeur de la journée. */
function layoutDay(events: CalendarEvent[]): Map<string, { col: number; cols: number }> {
  const MIN_DUR = 15 * 60_000; // un RDV très court occupe quand même un slot visuel
  const items = events
    .map((e) => {
      const start = new Date(e.start).getTime();
      return { e, start, end: Math.max(new Date(e.end).getTime(), start + MIN_DUR) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out = new Map<string, { col: number; cols: number }>();
  let cluster: { item: (typeof items)[number]; col: number }[] = [];
  let colEnds: number[] = []; // fin du dernier événement posé dans chaque colonne
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

export default function AgendaPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Au chargement, centre la vue sur l'heure actuelle (la ligne rouge).
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Une seule plage : couvre la semaine affichée ET les 30 prochains jours (sidebar).
  // fetchSeq : une réponse lente d'une navigation précédente ne doit pas écraser la semaine affichée.
  const fetchSeq = useRef(0);
  const fetchEvents = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    const from = new Date(Math.min(weekStart.getTime(), Date.now()));
    const to = new Date(Math.max(addDays(weekStart, 7).getTime(), Date.now() + 30 * 24 * 3600 * 1000));
    try {
      const res = await fetch(`/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (seq !== fetchSeq.current) return;
      if (res.status === 401) {
        window.location.assign("/login?from=/agenda");
        return;
      }
      if (res.status === 501) {
        setConfigured(false);
        setEvents([]);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (seq !== fetchSeq.current) return;
      setConfigured(true);
      setEvents(json.events ?? []);
    } catch {
      if (seq === fetchSeq.current) setError("Impossible de joindre Google Calendar. Réessaie dans un instant.");
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => !e.allDay && new Date(e.end).getTime() >= Date.now())
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 20),
    [events],
  );

  // Événements indexés par jour en un seul passage — la grille ne fait que des lookups.
  const dayKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = useMemo(() => {
    const map = new Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>();
    for (const e of events) {
      const d = e.allDay ? new Date(`${e.start}T00:00`) : new Date(e.start);
      const key = dayKeyOf(d);
      let bucket = map.get(key);
      if (!bucket) {
        bucket = { allDay: [], timed: [] };
        map.set(key, bucket);
      }
      (e.allDay ? bucket.allDay : bucket.timed).push(e);
    }
    for (const b of map.values()) b.timed.sort((a, c) => a.start.localeCompare(c.start));
    return map;
  }, [events]);

  const todayCount = useMemo(
    () => events.filter((e) => !e.allDay && sameDay(new Date(e.start), now)).length,
    [events, now],
  );

  const handleDelete = async (ev: CalendarEvent) => {
    if (!confirm(`Supprimer « ${ev.title} » de l'agenda ?`)) return;
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(ev.id)}`, { method: "DELETE" });
    if (res.status === 401) {
      window.location.assign("/login?from=/agenda");
      return;
    }
    if (res.ok) {
      setSelected(null);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } else {
      setSelected(null);
      setError("Suppression impossible — rafraîchis et réessaie.");
    }
  };

  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#111114] border-b border-[var(--color-border)] px-3 md:px-6 py-3">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Link href="/" className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-600 dark:text-neutral-400 hover:text-violet-600 dark:hover:text-violet-300 transition" title="Retour aux prospects">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-5 h-5 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display italic text-[20px] md:text-[24px] leading-none tracking-tight text-neutral-900 dark:text-neutral-50">
                Agenda
              </h1>
              <p className="text-[10px] md:text-[11px] text-neutral-500 mt-0.5 font-mono-num truncate">
                {todayCount} RDV aujourd&apos;hui · synchronisé Google Calendar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => fetchEvents()} className="p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-neutral-600 dark:text-neutral-400 transition" title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button onClick={() => setWeekOffset((v) => v - 1)} className="p-2 hover:bg-[var(--color-surface-2)] transition" title="Semaine précédente">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setWeekOffset(0)} className={`px-3 py-2 text-sm transition ${weekOffset === 0 ? "text-violet-500 font-semibold" : "hover:bg-[var(--color-surface-2)]"}`}>
                Aujourd&apos;hui
              </button>
              <button onClick={() => setWeekOffset((v) => v + 1)} className="p-2 hover:bg-[var(--color-surface-2)] transition" title="Semaine suivante">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <span className="hidden md:block text-sm text-neutral-500 px-1 font-mono-num">
              {weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – {addDays(weekStart, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <button
              onClick={() => { setCreateDefault(null); setCreateOpen(true); }}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium transition shadow-lg shadow-violet-900/30"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau RDV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── États non configuré / erreur ── */}
      {configured === false && <SetupPanel />}
      {error && (
        <div className="m-4 md:m-6 px-4 py-3 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {configured !== false && !error && (
        <div className="flex flex-col xl:flex-row gap-4 px-3 md:px-6 py-4">
          {/* ── Grille semaine ── */}
          <div className="flex-1 min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                {/* En-têtes jours */}
                <div className="grid border-b border-[var(--color-border)]" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                  <div />
                  {weekDays.map((d, i) => {
                    const isToday = sameDay(d, now);
                    return (
                      <div key={i} className={`px-2 py-2.5 text-center border-l border-[var(--color-border)] ${isToday ? "bg-violet-500/10" : ""}`}>
                        <div className={`text-[10px] uppercase tracking-wider ${isToday ? "text-violet-500 font-bold" : "text-neutral-500"}`}>{DAYS[i]}</div>
                        <div className={`text-lg leading-tight font-mono-num ${isToday ? "text-violet-500 font-bold" : "text-[var(--color-text-primary)]"}`}>{d.getDate()}</div>
                        {/* Événements journée entière */}
                        {(byDay.get(dayKeyOf(d))?.allDay ?? []).slice(0, 2).map((e) => (
                          <button key={e.id} onClick={() => setSelected(e)} className="mt-1 w-full truncate px-1 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 text-[10px] font-medium">
                            {e.title}
                          </button>
                        ))}
                        {(byDay.get(dayKeyOf(d))?.allDay.length ?? 0) > 2 && (
                          <div className="mt-0.5 text-[9px] text-neutral-500 font-medium">
                            +{(byDay.get(dayKeyOf(d))?.allDay.length ?? 0) - 2} autres
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Corps : heures + colonnes */}
                <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                  {/* Colonne des heures */}
                  <div className="relative" style={{ height: GRID_H }}>
                    {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                      <div key={i} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-neutral-400 dark:text-neutral-600 font-mono-num" style={{ top: i * HOUR_PX }}>
                        {i > 0 ? `${DAY_START + i}h` : ""}
                      </div>
                    ))}
                  </div>

                  {weekDays.map((d, di) => {
                    const isToday = sameDay(d, now);
                    const dayEvents = byDay.get(dayKeyOf(d))?.timed ?? [];
                    const dayLayout = layoutDay(dayEvents);
                    return (
                      <div
                        key={di}
                        className={`relative border-l border-[var(--color-border)] ${
                          isToday ? "bg-violet-500/[0.04]" : di >= 5 ? "bg-[var(--color-surface-2)]/30" : ""
                        }`}
                        style={{ height: GRID_H }}
                        onDoubleClick={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          // Snap à la demi-heure la plus proche du clic
                          const halfSlot = Math.floor((e.clientY - rect.top) / (HOUR_PX / 2));
                          const clamped = Math.min(Math.max(halfSlot, 0), (DAY_END - DAY_START) * 2 - 1);
                          const def = new Date(d);
                          def.setHours(DAY_START + Math.floor(clamped / 2), (clamped % 2) * 30, 0, 0);
                          setCreateDefault(def);
                          setCreateOpen(true);
                        }}
                        title="Double-clic : nouveau RDV à cette heure"
                      >
                        {/* Lignes horaires + demi-heures */}
                        {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                          <div key={i}>
                            <div className="absolute left-0 right-0 border-t border-[var(--color-border)] opacity-60" style={{ top: i * HOUR_PX }} />
                            <div className="absolute left-0 right-0 border-t border-dashed border-[var(--color-border)] opacity-25" style={{ top: i * HOUR_PX + HOUR_PX / 2 }} />
                          </div>
                        ))}

                        {/* Ligne "maintenant" */}
                        {isToday && now.getHours() >= DAY_START && now.getHours() < DAY_END && (
                          <div
                            ref={nowLineRef}
                            className="absolute left-0 right-0 z-10 pointer-events-none"
                            style={{ top: (now.getHours() - DAY_START + now.getMinutes() / 60) * HOUR_PX }}
                          >
                            <div className="h-[2px] bg-rose-500" />
                            <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px]" />
                          </div>
                        )}

                        {/* Événements */}
                        {dayEvents.map((e) => {
                          const start = new Date(e.start);
                          const end = new Date(e.end);
                          const startH = start.getHours() + start.getMinutes() / 60;
                          const endH = end.getHours() + end.getMinutes() / 60;
                          // Borné à la grille : un RDV avant 7h ou après 21h reste visible au bord (l'horaire texte fait foi).
                          const top = Math.min(Math.max(0, (startH - DAY_START) * HOUR_PX), GRID_H - 26);
                          const height = Math.min(
                            Math.max(26, (Math.min(endH, DAY_END) - Math.max(startH, DAY_START)) * HOUR_PX - 2),
                            GRID_H - top - 2,
                          );
                          const lay = dayLayout.get(e.id) ?? { col: 0, cols: 1 };
                          const widthPct = 96 / lay.cols;
                          const leftPct = 2 + lay.col * widthPct;
                          const past = end.getTime() < now.getTime();
                          const ongoing = !past && start.getTime() <= now.getTime();
                          const compact = height < 40 || lay.cols > 2;
                          return (
                            <button
                              key={e.id}
                              onClick={() => setSelected(e)}
                              title={`${e.title} · ${fmtTime(start)} – ${fmtTime(end)}`}
                              className={`absolute rounded-md px-1.5 py-1 text-left overflow-hidden border transition hover:z-20 hover:shadow-lg ${
                                lay.cols > 1 ? "hover:min-w-[150px]" : ""
                              } ${
                                past
                                  ? "bg-neutral-200/80 dark:bg-neutral-800/80 border-neutral-300 dark:border-neutral-700 text-neutral-500"
                                  : ongoing
                                    ? "bg-fuchsia-600/90 border-fuchsia-400 text-white shadow ring-1 ring-fuchsia-300/50"
                                    : "bg-violet-500/90 border-violet-400 text-white shadow"
                              }`}
                              style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 2px)` }}
                            >
                              {compact ? (
                                <div className="text-[10px] font-semibold leading-tight truncate">
                                  <span className={`font-mono-num font-normal ${past ? "" : "text-violet-100"}`}>{fmtTime(start)}</span> {e.title}
                                </div>
                              ) : (
                                <>
                                  <div className="text-[11px] font-semibold leading-tight truncate">{e.title}</div>
                                  <div className={`text-[10px] font-mono-num ${past ? "" : "text-violet-100"}`}>
                                    {fmtTime(start)} – {fmtTime(end)}
                                  </div>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-3 py-2 border-t border-[var(--color-border)] text-[10px] text-neutral-500 text-center">
              Double-clique sur un créneau pour créer un RDV · clique sur un RDV pour le détail
            </div>
          </div>

          {/* ── Prochains RDV ── */}
          <aside className="xl:w-[300px] shrink-0">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 px-1">Prochains RDV</h2>
              {loading && upcoming.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-neutral-500 px-1 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                </div>
              )}
              {!loading && upcoming.length === 0 && (
                <p className="text-sm text-neutral-500 px-1 py-3">Rien de prévu sur les 30 prochains jours.</p>
              )}
              <ul className="space-y-1">
                {upcoming.map((e) => {
                  const start = new Date(e.start);
                  const isToday = sameDay(start, now);
                  return (
                    <li key={e.id}>
                      <button onClick={() => setSelected(e)} className="w-full text-left px-2.5 py-2 rounded-lg border border-transparent hover:border-violet-500/40 hover:bg-[var(--color-surface-2)] transition">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isToday ? "bg-rose-500" : "bg-violet-500"}`} />
                          <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{e.title}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 pl-3.5 font-mono-num">
                          {isToday ? "Aujourd'hui" : fmtDayLong(start)} · {fmtTime(start)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* ── Détail d'un événement ── */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{selected.title}</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-[var(--color-surface-2)] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-500 shrink-0" />
                {selected.allDay
                  ? `${fmtDayLong(new Date(`${selected.start}T00:00`))} · journée entière`
                  : `${fmtDayLong(new Date(selected.start))} · ${fmtTime(new Date(selected.start))} – ${fmtTime(new Date(selected.end))}`}
              </div>
              {selected.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-violet-500 shrink-0" />
                  <span className="truncate">{selected.location}</span>
                </div>
              )}
              {selected.description && (
                <p className="whitespace-pre-wrap text-[13px] bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 max-h-44 overflow-y-auto">
                  {selected.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4">
              {selected.htmlLink && (
                <a href={selected.htmlLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 transition">
                  <ExternalLink className="w-3.5 h-3.5" /> Google Calendar
                </a>
              )}
              <button onClick={() => handleDelete(selected)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 transition ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Création d'un RDV ── */}
      {createOpen && (
        <CreateEventModal
          defaultStart={createDefault}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); fetchEvents(); }}
        />
      )}
    </main>
  );
}

/* ── Modal de création ── */
function CreateEventModal({ defaultStart, onClose, onCreated }: { defaultStart: Date | null; onClose: () => void; onCreated: () => void }) {
  const def = useMemo(() => {
    const d = defaultStart ?? (() => {
      const t = new Date();
      t.setHours(t.getHours() + 1, 0, 0, 0);
      return t;
    })();
    return toLocalInput(d);
  }, [defaultStart]);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(def.date);
  const [time, setTime] = useState(def.time);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  const submit = async () => {
    if (!title.trim()) return;
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60_000);
    setState("sending");
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), start: start.toISOString(), end: end.toISOString(), location, description }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onCreated();
    } catch {
      setState("error");
    }
  };

  const input = "w-full px-2.5 py-2 text-sm rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] focus:border-violet-500/50 transition";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-violet-500" /> Nouveau RDV</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-surface-2)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input autoFocus type="text" placeholder="Titre — ex : RDV avec Dupont Plomberie" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={input}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1 h 30</option>
            </select>
          </div>
          <input type="text" placeholder="Lieu / téléphone (optionnel)" value={location} onChange={(e) => setLocation(e.target.value)} className={input} />
          <textarea placeholder="Description (optionnel)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} resize-none`} />
          {state === "error" && <p className="text-[12px] text-rose-500">Création impossible — vérifie la config Google Calendar et réessaie.</p>}
          <button
            onClick={submit}
            disabled={!title.trim() || state === "sending"}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium text-sm transition shadow-lg shadow-violet-900/30 disabled:opacity-50"
          >
            {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Créer le RDV
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Panneau "non configuré" ── */
function SetupPanel() {
  return (
    <div className="m-4 md:m-6 max-w-2xl mx-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center gap-2.5 mb-3">
        <Settings className="w-5 h-5 text-violet-500" />
        <h2 className="text-base font-semibold">Connecter Google Calendar (une fois)</h2>
      </div>
      <ol className="space-y-2.5 text-sm text-[var(--color-text-secondary)] list-decimal pl-5 leading-relaxed">
        <li>
          Sur <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-violet-500 underline">console.cloud.google.com</a> :
          crée un projet → « API et services » → active <b>Google Calendar API</b>.
        </li>
        <li>
          « Identifiants » → « Créer des identifiants » → <b>Compte de service</b> (aucun rôle requis) →
          onglet « Clés » → « Ajouter une clé » → JSON. Télécharge le fichier.
        </li>
        <li>
          Dans Google Calendar (web) → Paramètres de ton agenda → « Partager avec des personnes » →
          ajoute l&apos;email du compte de service (…@…iam.gserviceaccount.com) avec
          « <b>Apporter des modifications aux événements</b> ».
        </li>
        <li>
          Renseigne les variables d&apos;environnement (en local <code className="text-violet-400">.env.local</code> et sur Vercel) :
          <pre className="mt-1.5 p-2.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[11px] overflow-x-auto">
{`GOOGLE_SA_EMAIL=xxx@yyy.iam.gserviceaccount.com
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n…\\n-----END PRIVATE KEY-----\\n"
GOOGLE_CALENDAR_ID=ton.email@gmail.com`}
          </pre>
        </li>
      </ol>
      <p className="mt-3 text-[12px] text-neutral-500">
        Détails complets : <code className="text-violet-400">docs/google-calendar-setup.md</code>. Recharge cette page une fois les variables en place.
      </p>
    </div>
  );
}
