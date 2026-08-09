"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2,
  MapPin, ExternalLink, Trash2, Clock, RefreshCw, Settings, User,
} from "lucide-react";
import type { CalendarEvent } from "../lib/googleCalendar";
import CallModal from "../components/CallModal";
import { useProspects } from "../lib/useProspects";
import { isOpenNow, openLabel } from "../lib/openNow";
import type { Prospect } from "../lib/types";
import { useCalendarEvents } from "../lib/useCalendarEvents";
import {
  rangeForView, startOfWeek, addDays, sameDay, dayKeyOf, type CalendarView,
} from "../lib/calendarDates";
import WeekView from "./views/WeekView";
import MonthView from "./views/MonthView";
import ListView from "./views/ListView";

/* ── Helpers d'affichage (formatage) ── */
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

/* ── Lien RDV ↔ prospect ──
   Lien fort : prospectId stocké dans l'événement quand le RDV est créé depuis une fiche.
   Fallback (anciens RDV) : téléphone dans le lieu / la description, puis nom dans le titre. */
function normPhone(s: string): string {
  return s.replace(/[\s.\-()]/g, "").replace(/^\+33/, "0");
}

function matchProspect(e: CalendarEvent, prospects: Prospect[]): Prospect | null {
  if (e.prospectId) {
    const byId = prospects.find((p) => p.id === e.prospectId);
    if (byId) return byId;
  }
  const hay = normPhone(`${e.location ?? ""}\n${e.description ?? ""}`);
  const byPhone = prospects.find((p) => {
    const ph = normPhone(p.phone || "");
    return ph.length >= 9 && hay.includes(ph);
  });
  if (byPhone) return byPhone;
  const title = e.title.toLowerCase();
  return prospects.find((p) => p.name && p.name.trim().length > 3 && title.includes(p.name.trim().toLowerCase())) ?? null;
}

const VIEW_LABEL: Record<CalendarView, string> = { week: "Semaine", month: "Mois", list: "Liste" };

export default function AgendaPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [refDate, setRefDate] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  // Fiche prospect ouverte depuis un RDV — stockée par id pour rester à jour (Realtime).
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [ficheEvent, setFicheEvent] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { prospects, updateStatus } = useProspects();

  const { all, fetchRange, addEvent, removeEvent, revalidating, coldLoading, status, staleError } =
    useCalendarEvents();

  // Vue persistée entre les sessions.
  useEffect(() => {
    try {
      const v = localStorage.getItem("pt.agenda.view");
      if (v === "week" || v === "month" || v === "list") setView(v);
    } catch { /* localStorage indisponible */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("pt.agenda.view", view); } catch { /* idem */ }
  }, [view]);

  // Non authentifié → on renvoie vers la connexion.
  useEffect(() => {
    if (status === "auth") window.location.assign("/login?from=/agenda");
  }, [status]);

  // Revalidation + prefetch dès que la vue ou la période change.
  useEffect(() => {
    const { from, to } = rangeForView(view, refDate);
    fetchRange(from, to);
    // En vue Semaine, on précharge la semaine d'avant et d'après pour une navigation instantanée.
    if (view === "week") {
      fetchRange(addDays(from, -7), from);
      fetchRange(to, addDays(to, 7));
    }
  }, [view, refDate, fetchRange]);

  // Précharge les ~45 prochains jours pour alimenter la récap « Prochains RDV »
  // même quand on est en vue Semaine (dont la plage est plus courte).
  useEffect(() => {
    const from = new Date();
    fetchRange(from, addDays(from, 45));
  }, [fetchRange]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fiche = useMemo(
    () => (ficheId ? prospects.find((p) => p.id === ficheId) ?? null : null),
    [ficheId, prospects],
  );

  const closeFiche = () => {
    setFicheId(null);
    setFicheEvent(null);
  };

  // Clic sur un RDV : on ouvre d'abord le détail (horaire + lieu + note).
  const openEvent = (e: CalendarEvent) => setSelected(e);

  // Passe du détail de l'événement à la fiche prospect complète.
  const openFiche = (p: Prospect, e: CalendarEvent) => {
    setSelected(null);
    setFicheId(p.id);
    setFicheEvent(e);
  };

  // Prospect lié à l'événement actuellement affiché en détail (si trouvé).
  const selectedProspect = useMemo(
    () => (selected ? matchProspect(selected, prospects) : null),
    [selected, prospects],
  );

  // Événements indexés par jour en un seul passage — les vues ne font que des lookups.
  const byDay = useMemo(() => {
    const map = new Map<string, { allDay: CalendarEvent[]; timed: CalendarEvent[] }>();
    for (const e of all) {
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
  }, [all]);

  const weekStart = useMemo(() => startOfWeek(refDate), [refDate]);

  const todayCount = useMemo(
    () => all.filter((e) => !e.allDay && sameDay(new Date(e.start), now)).length,
    [all, now],
  );

  // Libellé de période, dépendant de la vue.
  const periodLabel = useMemo(() => {
    if (view === "month") return refDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    if (view === "list") return "60 prochains jours";
    return `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }, [view, refDate, weekStart]);

  const navigate = (dir: number) =>
    setRefDate((d) => (view === "month" ? new Date(d.getFullYear(), d.getMonth() + dir, 1) : addDays(d, dir * 7)));

  const refresh = () => {
    const { from, to } = rangeForView(view, refDate);
    fetchRange(from, to);
  };

  const handleDelete = async (ev: CalendarEvent) => {
    if (!confirm(`Supprimer « ${ev.title} » de l'agenda ?`)) return;
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(ev.id)}`, { method: "DELETE" });
    if (res.status === 401) {
      window.location.assign("/login?from=/agenda");
      return;
    }
    setSelected(null);
    closeFiche();
    if (res.ok) {
      removeEvent(ev.id); // suppression optimiste sur le cache partagé
    }
  };

  return (
    <main className="agenda-theme h-[100dvh] flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 z-20 bg-white dark:bg-[#111114] border-b border-[var(--color-border)] px-3 md:px-6 py-3">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Link href="/" className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-600 dark:text-neutral-400 hover:text-violet-600 dark:hover:text-violet-300 transition" title="Retour aux prospects">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-5 h-5 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-[20px] md:text-[24px] leading-none tracking-tight text-neutral-900 dark:text-neutral-50">
                Agenda
              </h1>
              <p className="text-[10px] md:text-[11px] text-neutral-500 mt-0.5 font-mono-num truncate">
                {todayCount} RDV aujourd&apos;hui · synchronisé Google Calendar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={refresh} className="p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-neutral-600 dark:text-neutral-400 transition" title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${revalidating ? "animate-spin" : ""}`} />
            </button>
            {view !== "list" && (
              <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--color-surface-2)] transition" title={view === "month" ? "Mois précédent" : "Semaine précédente"}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setRefDate(new Date())} className="px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] transition">
                  Aujourd&apos;hui
                </button>
                <button onClick={() => navigate(1)} className="p-2 hover:bg-[var(--color-surface-2)] transition" title={view === "month" ? "Mois suivant" : "Semaine suivante"}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <span className="hidden md:block text-sm text-neutral-500 px-1 font-mono-num capitalize">
              {periodLabel}
            </span>
            <button
              onClick={() => { setCreateDefault(null); setCreateOpen(true); }}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] hover:brightness-110 text-white font-medium transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau RDV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Corps ── */}
      {status === "unconfigured" ? (
        <SetupPanel />
      ) : (
        <div className="glass-amb flex-1 min-h-0 flex flex-col px-3 md:px-6 py-3">
          {/* Barre : segmented control de vue */}
          <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
            <div className="flex gap-0.5 p-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              {(["month", "week", "list"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs rounded-md transition ${
                    view === v
                      ? "bg-violet-600/20 text-violet-600 dark:text-violet-200 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
            {staleError && <span className="text-[10px] text-amber-600">màj impossible — affichage du cache</span>}
            <span className="md:hidden text-[11px] text-neutral-500 ml-auto font-mono-num capitalize">{periodLabel}</span>
          </div>

          {/* Vue active (squelette le temps du premier chargement à froid) */}
          {coldLoading ? (
            <div className="glass-panel flex-1 min-h-0 p-2 space-y-2 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-[56px]" />)}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-4">
              {/* min-w-0/min-h-0 : la vue remplit l'espace sans pousser la page */}
              <div className={`flex-1 min-w-0 min-h-0 ${view === "list" ? "overflow-y-auto" : ""}`}>
                {view === "week" ? (
                  <WeekView
                    weekStart={weekStart}
                    now={now}
                    byDay={byDay}
                    onOpen={openEvent}
                    onCreateAt={(d) => { setCreateDefault(d); setCreateOpen(true); }}
                  />
                ) : view === "month" ? (
                  <MonthView
                    refDate={refDate}
                    now={now}
                    byDay={byDay}
                    onOpen={openEvent}
                    onPickDay={(d) => { setRefDate(d); setView("week"); }}
                  />
                ) : (
                  <ListView events={all} now={now} onOpen={openEvent} />
                )}
              </div>
              {/* Récap latérale uniquement en vue Semaine (le Mois reste plein écran, sans scroll) */}
              {view === "week" && <UpcomingAside events={all} now={now} onOpen={openEvent} />}
            </div>
          )}
        </div>
      )}

      {/* ── Fiche prospect (même visu que la prospection) ── */}
      <CallModal
        open={!!fiche}
        prospect={fiche}
        isOpen={fiche ? isOpenNow(fiche, now, now) : undefined}
        hoursLabel={fiche ? openLabel(fiche, now, now) : undefined}
        onClose={closeFiche}
        onMarkCalled={() => { if (fiche) { updateStatus(fiche.id, "called"); closeFiche(); } }}
        onMarkPositive={() => { if (fiche) updateStatus(fiche.id, "positive"); }}
        onMarkNoAnswer={() => { if (fiche) { updateStatus(fiche.id, "no_answer"); closeFiche(); } }}
        onMarkNegative={() => { if (fiche) { updateStatus(fiche.id, "negative"); closeFiche(); } }}
        banner={ficheEvent && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30 text-[12px] text-violet-800 dark:text-violet-200">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="min-w-0 truncate font-medium">
              {ficheEvent.allDay
                ? `RDV ${fmtDayLong(new Date(`${ficheEvent.start}T00:00`))} · journée entière`
                : `RDV ${fmtDayLong(new Date(ficheEvent.start))} · ${fmtTime(new Date(ficheEvent.start))} – ${fmtTime(new Date(ficheEvent.end))}`}
            </span>
            <span className="ml-auto flex items-center gap-1 shrink-0">
              {ficheEvent.htmlLink && (
                <a href={ficheEvent.htmlLink} target="_blank" rel="noreferrer" title="Ouvrir dans Google Calendar" className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-500/20 transition">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button onClick={() => handleDelete(ficheEvent)} title="Supprimer le RDV" className="p-1 rounded text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/15 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        )}
      />

      {/* ── Détail d'un événement (sans prospect lié) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              {selectedProspect ? (
                <button
                  onClick={() => openFiche(selectedProspect, selected)}
                  className="group min-w-0 text-left"
                  title="Ouvrir la fiche du prospect"
                >
                  <span className="text-base font-semibold text-violet-600 dark:text-violet-300 group-hover:underline decoration-violet-400/60 underline-offset-2">
                    {selectedProspect.name}
                  </span>
                  <span className="ml-1.5 text-[11px] font-medium text-violet-500/80 whitespace-nowrap">→ voir la fiche</span>
                </button>
              ) : (
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] min-w-0">{selected.title}</h2>
              )}
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-[var(--color-surface-2)] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              {selectedProspect && selected.title.trim().toLowerCase() !== selectedProspect.name.trim().toLowerCase() && (
                <div className="text-[12px] text-neutral-500 -mt-1">{selected.title}</div>
              )}
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
            {selectedProspect && (
              <button
                onClick={() => openFiche(selectedProspect, selected)}
                className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-accent)] hover:brightness-110 text-white font-medium text-sm transition shadow-sm"
              >
                <User className="w-4 h-4" /> Voir la fiche de {selectedProspect.name}
              </button>
            )}
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
          onCreated={(created) => {
            setCreateOpen(false);
            if (created) addEvent(created); // affichage optimiste immédiat
            else refresh(); // fallback : on recharge la plage courante
          }}
        />
      )}
    </main>
  );
}

/* ── Récap « Prochains RDV » (aside) ── */
function UpcomingAside({ events, now, onOpen }: { events: CalendarEvent[]; now: Date; onOpen: (e: CalendarEvent) => void }) {
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => !e.allDay && new Date(e.end).getTime() >= Date.now())
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 20),
    [events],
  );
  return (
    <aside className="hidden xl:block xl:w-[300px] shrink-0 min-h-0">
      <div className="glass-panel p-3 h-full overflow-y-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 px-1">Prochains RDV</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500 px-1 py-3">Rien de prévu prochainement.</p>
        ) : (
          <ul className="space-y-1">
            {upcoming.map((e) => {
              const start = new Date(e.start);
              const isToday = sameDay(start, now);
              return (
                <li key={e.id}>
                  <button onClick={() => onOpen(e)} className="w-full text-left px-2.5 py-2 rounded-lg border border-transparent hover:border-violet-500/40 hover:bg-[var(--color-surface-2)] transition">
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
        )}
      </div>
    </aside>
  );
}

/* ── Modal de création ── */
function CreateEventModal({ defaultStart, onClose, onCreated }: { defaultStart: Date | null; onClose: () => void; onCreated: (created: CalendarEvent | null) => void }) {
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
      const json = await res.json().catch(() => null);
      onCreated((json?.event as CalendarEvent) ?? null);
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-accent)] hover:brightness-110 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
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
