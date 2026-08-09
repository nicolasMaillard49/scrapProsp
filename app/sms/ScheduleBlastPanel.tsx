"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Send, Trash2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

const COST_PER_SMS = 0.399; // message actuel ~5 segments × 0,0798 $

interface ScheduledBlast {
  id: string;
  scheduled_at: string;
  limit_count: number;
  status: "pending" | "running" | "done" | "failed" | "canceled";
  result: { sent?: number; failed?: number; error?: string } | null;
  executed_at: string | null;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CLS: Record<ScheduledBlast["status"], string> = {
  pending: "text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/30 border-sky-600 dark:border-sky-900/40",
  running: "text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/30 border-violet-600 dark:border-violet-900/40",
  done: "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/30 border-emerald-600 dark:border-emerald-900/40",
  failed: "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/40 border-rose-600 dark:border-rose-900/50",
  canceled: "text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]/40 border-[var(--color-border)]/50",
};

export default function ScheduleBlastPanel() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(50);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState("18:00");
  const [balance, setBalance] = useState<number | null>(null);
  const [list, setList] = useState<ScheduledBlast[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/scheduled-blasts");
    const json = await res.json();
    if (res.ok) setList(json.blasts ?? []);
  }, []);

  useEffect(() => {
    loadList();
    fetch("/api/twilio/balance").then((r) => r.json()).then((j) => { if (typeof j.balance === "number") setBalance(j.balance); }).catch(() => {});
  }, [loadList]);

  // Realtime : MAJ de la liste quand un job change (cron qui exécute, etc.)
  useEffect(() => {
    if (!supabaseConfigured) return;
    const ch = supabase
      .channel("scheduled-blasts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_blasts" }, () => loadList())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadList]);

  const scheduledAt = useMemo(() => new Date(`${date}T${time}`), [date, time]);
  const estCost = count * COST_PER_SMS;
  const outOfWindow = useMemo(() => {
    const d = scheduledAt;
    return d.getDay() === 0 || d.getHours() < 8 || d.getHours() >= 20;
  }, [scheduledAt]);
  const overBudget = balance != null && estCost > balance;

  const submit = useCallback(async () => {
    setSubmitting(true);
    setInfo(null);
    try {
      const res = await fetch("/api/scheduled-blasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString(), limit: count }),
      });
      const json = await res.json();
      if (!res.ok) setInfo(json.error || `Erreur ${res.status}`);
      else { setInfo(`Programmé : ${count} prospects le ${fmt(scheduledAt.toISOString())}.`); await loadList(); }
    } finally {
      setSubmitting(false);
    }
  }, [scheduledAt, count, loadList]);

  const cancel = useCallback(async (id: string) => {
    await fetch(`/api/scheduled-blasts/${id}`, { method: "DELETE" });
    await loadList();
  }, [loadList]);

  const pending = list.filter((b) => b.status === "pending" || b.status === "running");

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] mb-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-[var(--color-text-primary)]">
        <span className="flex items-center gap-2 font-medium"><CalendarClock className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Programmer un envoi</span>
        <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          {pending.length > 0 && <span>{pending.length} programmé{pending.length > 1 ? "s" : ""}</span>}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-[var(--color-text-secondary)]">Prospects
              <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="mt-1 block w-24 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]" />
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 block rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]" />
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">Heure
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="mt-1 block rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]" />
            </label>
            <button onClick={submit} disabled={submitting || outOfWindow}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Programmer
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-[var(--color-text-secondary)]">Coût estimé : <span className={overBudget ? "text-rose-700 dark:text-rose-300" : "text-[var(--color-text-primary)]"}>~{estCost.toFixed(2)} $</span></span>
            {balance != null && <span className="text-[var(--color-text-secondary)]">Solde Twilio : <span className="text-[var(--color-text-primary)]">{balance.toFixed(2)} $</span></span>}
            {overBudget && <span className="flex items-center gap-1 text-rose-700 dark:text-rose-300"><AlertTriangle className="w-3 h-3" /> Coût &gt; solde</span>}
            {outOfWindow && <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="w-3 h-3" /> Hors créneau légal (8h-20h, hors dimanche)</span>}
          </div>

          {info && <div className="text-xs px-3 py-2 rounded-lg border border-violet-600 dark:border-violet-900/40 bg-violet-100 dark:bg-violet-950/20 text-violet-700 dark:text-violet-200">{info}</div>}

          {list.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {list.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 text-xs rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md border ${STATUS_CLS[b.status]}`}>{b.status}</span>
                    <span className="text-[var(--color-text-secondary)]">{b.limit_count} prospects</span>
                    <span className="text-[var(--color-text-muted)]">{fmt(b.scheduled_at)}</span>
                    {b.status === "done" && b.result && <span className="text-emerald-700 dark:text-emerald-300">{b.result.sent} envoyés</span>}
                    {b.status === "failed" && b.result?.error && <span className="text-rose-700 dark:text-rose-300">{b.result.error}</span>}
                  </div>
                  {b.status === "pending" && (
                    <button onClick={() => cancel(b.id)} className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-rose-700 dark:hover:text-rose-300" title="Annuler">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
