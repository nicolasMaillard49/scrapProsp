"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "./googleCalendar";
import { mergeEvents, eventsInRange } from "./eventCache";

const LS_KEY = "pt.agenda.events.v1";

type Status = "configured" | "unconfigured" | "auth";

function loadCache(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
  } catch {
    return [];
  }
}
function saveCache(events: CalendarEvent[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events.slice(0, 2000)));
  } catch {
    /* quota : on ignore */
  }
}

/**
 * Source d'événements instantanée : sert d'abord le cache, revalide en fond.
 * `from`/`to` bornent la plage demandée par la vue ; on fetch toujours la
 * plage demandée mais on garde un cache global fusionné pour l'instantanéité.
 */
export function useCalendarEvents() {
  const [all, setAll] = useState<CalendarEvent[]>(() => (typeof window !== "undefined" ? loadCache() : []));
  const [revalidating, setRevalidating] = useState(false);
  const [coldLoading, setColdLoading] = useState(all.length === 0);
  const [status, setStatus] = useState<Status>("configured");
  const [staleError, setStaleError] = useState(false);
  const seq = useRef(0);

  const fetchRange = useCallback(async (from: Date, to: Date) => {
    const s = ++seq.current;
    setRevalidating(true);
    setStaleError(false);
    try {
      const res = await fetch(`/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (s !== seq.current) return;
      if (res.status === 401) return setStatus("auth");
      if (res.status === 501) { setStatus("unconfigured"); setColdLoading(false); return; }
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (s !== seq.current) return;
      setStatus("configured");
      setAll((prev) => {
        // on remplace la fenêtre [from,to) par le résultat frais, on garde le reste du cache
        const outside = prev.filter((e) => {
          const t = new Date(e.start).getTime();
          return t < from.getTime() || t >= to.getTime();
        });
        const merged = mergeEvents(outside, json.events ?? []);
        saveCache(merged);
        return merged;
      });
    } catch {
      if (s === seq.current) setStaleError(true);
    } finally {
      if (s === seq.current) { setRevalidating(false); setColdLoading(false); }
    }
  }, []);

  const addEvent = useCallback((e: CalendarEvent) => {
    setAll((prev) => { const m = mergeEvents(prev, [e]); saveCache(m); return m; });
  }, []);
  const removeEvent = useCallback((id: string) => {
    setAll((prev) => { const m = prev.filter((x) => x.id !== id); saveCache(m); return m; });
  }, []);

  return { all, eventsInRange, fetchRange, addEvent, removeEvent, revalidating, coldLoading, status, staleError };
}
