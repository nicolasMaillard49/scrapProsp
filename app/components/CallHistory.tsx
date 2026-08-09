"use client";

import { useEffect, useMemo } from "react";
import { X, History, PhoneCall, Clock } from "lucide-react";
import type { Call, Prospect, Status } from "../lib/types";

/** Pastille de statut compacte (couleurs alignées sur statusConfig de la page). */
const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  todo: { label: "À appeler", cls: "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300" },
  called: { label: "Appelé", cls: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" },
  sms_sent: { label: "SMS envoyé", cls: "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300" },
  positive: { label: "Positif", cls: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300" },
  negative: { label: "Négatif", cls: "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300" },
  no_answer: { label: "Pas de réponse", cls: "bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300" },
};

const MAX_ENTRIES = 150;

interface Entry {
  call: Call;
  prospect: Prospect;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: Date): string {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = dayKey(d);
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}min${String(s).padStart(2, "0")}` : `${m}min`;
}

export default function CallHistory({
  open,
  prospects,
  onClose,
  onOpenProspect,
}: {
  open: boolean;
  prospects: Prospect[];
  onClose: () => void;
  onOpenProspect: (p: Prospect) => void;
}) {
  // Tous les appels, du plus récent au plus ancien.
  const entries = useMemo<Entry[]>(() => {
    const all: Entry[] = [];
    for (const p of prospects) {
      for (const call of p.calls ?? []) all.push({ call, prospect: p });
    }
    all.sort((a, b) => b.call.called_at.localeCompare(a.call.called_at));
    return all.slice(0, MAX_ENTRIES);
  }, [prospects]);

  // Groupes par jour, dans l'ordre d'apparition (déjà trié desc).
  const groups = useMemo(() => {
    const now = new Date();
    const out: { label: string; items: Entry[] }[] = [];
    for (const e of entries) {
      const label = dayLabel(new Date(e.call.called_at), now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [entries]);

  const todayCount = useMemo(() => {
    const today = dayKey(new Date());
    return entries.filter((e) => dayKey(new Date(e.call.called_at)) === today).length;
  }, [entries]);

  const weekCount = useMemo(() => {
    const limit = Date.now() - 7 * 24 * 3600 * 1000;
    return entries.filter((e) => new Date(e.call.called_at).getTime() >= limit).length;
  }, [entries]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-[var(--color-surface)] border-l border-[var(--color-border-strong)] shadow-2xl flex flex-col animate-[slideIn_.2s_ease-out]">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--color-border)]">
          <History className="w-5 h-5 text-violet-500" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Historique des appels</h2>
            <p className="text-[11px] text-neutral-500 font-mono-num">
              {todayCount} aujourd&apos;hui · {weekCount} sur 7 jours
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-neutral-500 hover:text-[var(--color-text-primary)] transition" title="Fermer (Échap)">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 gap-2">
              <PhoneCall className="w-8 h-8 opacity-40" />
              <p className="text-sm">Aucun appel enregistré pour l&apos;instant.</p>
              <p className="text-[11px]">Chaque changement de statut sur une fiche crée une entrée ici.</p>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="sticky top-0 bg-[var(--color-surface)] px-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {g.label} <span className="text-neutral-400 dark:text-neutral-600">· {g.items.length}</span>
              </div>
              <ul className="space-y-1">
                {g.items.map(({ call, prospect }) => {
                  const badge = STATUS_BADGE[call.status] ?? STATUS_BADGE.called;
                  return (
                    <li key={call.id}>
                      <button
                        onClick={() => onOpenProspect(prospect)}
                        className="w-full text-left px-2.5 py-2 rounded-lg border border-transparent hover:border-violet-500/40 hover:bg-[var(--color-surface-2)] transition group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate flex-1">
                            {prospect.name}
                          </span>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500">
                          <span className="font-mono-num">{timeLabel(new Date(call.called_at))}</span>
                          {call.duration != null && call.duration > 0 && (
                            <span className="flex items-center gap-0.5 font-mono-num">
                              <Clock className="w-3 h-3" />
                              {durationLabel(call.duration)}
                            </span>
                          )}
                          <span className="truncate">{prospect.metier} · {prospect.ville}</span>
                        </div>
                        {call.note && (
                          <p className="mt-1 text-[11px] text-neutral-500 line-clamp-2">{call.note}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {entries.length === MAX_ENTRIES && (
            <p className="text-center text-[10px] text-neutral-500 py-2">Les {MAX_ENTRIES} appels les plus récents sont affichés.</p>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
