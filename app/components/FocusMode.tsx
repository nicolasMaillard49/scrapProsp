"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Phone, X, ChevronLeft, ChevronRight, MapPin, Star,
  CheckCircle2, XCircle, PhoneOff, PhoneCall, SkipForward, Pause, Play, ExternalLink,
} from "lucide-react";
import type { Prospect, Status } from "../lib/types";

interface Props {
  open: boolean;
  prospects: Prospect[];
  initialIndex: number;
  onClose: () => void;
  onSetStatus: (id: string, status: Status, duration?: number) => void;
  onUpdateNote: (id: string, note: string) => void;
}

export default function FocusMode({ open, prospects, initialIndex, onClose, onSetStatus, onUpdateNote }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [callingSince, setCallingSince] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const [sessionStats, setSessionStats] = useState({ calls: 0, positive: 0, negative: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const current = prospects[idx];

  useEffect(() => {
    if (open) setIdx(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    setNoteDraft(current?.notes || "");
  }, [current?.id, current?.notes]);

  useEffect(() => {
    if (callingSince === null || paused) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - callingSince) / 1000)), 200);
    return () => clearInterval(t);
  }, [callingSince, paused]);

  const startCall = () => {
    setCallingSince(Date.now());
    setElapsed(0);
    setPaused(false);
  };
  const endCall = () => {
    setCallingSince(null);
    setPaused(false);
  };

  const finalize = (status: Status) => {
    if (!current) return;
    const duration = callingSince ? Math.floor((Date.now() - callingSince) / 1000) : undefined;
    onSetStatus(current.id, status, duration);
    if (noteDraft !== (current?.notes || "")) {
      onUpdateNote(current.id, noteDraft);
    }
    setSessionStats((s) => ({
      calls: s.calls + (status !== "todo" ? 1 : 0),
      positive: s.positive + (status === "positive" ? 1 : 0),
      negative: s.negative + (status === "negative" ? 1 : 0),
    }));
    if (status === "positive") {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 800);
    }
    endCall();
    if (idx < prospects.length - 1) {
      setTimeout(() => setIdx(idx + 1), status === "positive" ? 600 : 200);
    }
  };

  const skip = () => {
    if (idx < prospects.length - 1) setIdx(idx + 1);
  };
  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); skip(); }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "1" || e.key.toLowerCase() === "p") finalize("positive");
      if (e.key === "2" || e.key.toLowerCase() === "c") finalize("called");
      if (e.key === "3" || e.key.toLowerCase() === "n") finalize("negative");
      if (e.key === "4" || e.key.toLowerCase() === "r") finalize("no_answer");
      if (e.key.toLowerCase() === "k") callingSince ? endCall() : startCall();
      if (e.key.toLowerCase() === "t") noteRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, idx, callingSince, prospects.length]);

  if (!open || !current) return null;

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const progressPct = prospects.length > 0 ? ((idx + 1) / prospects.length) * 100 : 0;
  const cleanPhone = current.phone.replace(/\s/g, "");

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-background)] animate-fade-in">
      <div
        className="absolute inset-x-0 top-0 h-1 bg-[var(--color-border)]"
        aria-hidden="true"
      >
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition"
          >
            <X className="w-4 h-4" /> Quitter (Esc)
          </button>
          <div className="text-sm text-neutral-500">
            <span className="text-neutral-200 font-medium">{idx + 1}</span> / {prospects.length}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <SessionBadge label="Appelés" value={sessionStats.calls} accent="text-amber-300" />
          <SessionBadge label="Positifs" value={sessionStats.positive} accent="text-emerald-300" />
          <SessionBadge label="Négatifs" value={sessionStats.negative} accent="text-rose-300" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-6 pb-12 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 text-xs rounded-full ${current.metier === "plombier" ? "bg-blue-950/60 text-blue-300 border border-blue-800/40" : "bg-yellow-950/60 text-yellow-300 border border-yellow-800/40"}`}>
            {current.metier}
          </span>
          <span className="text-xs text-neutral-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {current.ville}
          </span>
          {current.rating && (
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {current.rating} ({current.reviews})
            </span>
          )}
        </div>

        <h1 className="font-display text-4xl md:text-5xl leading-[1.02] tracking-tight mb-1 break-words max-w-full text-neutral-50">
          {current.name}
        </h1>
        <a
          href={current.maps_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-neutral-600 hover:text-violet-400 inline-flex items-center gap-1 mb-8"
        >
          Fiche Google Maps <ExternalLink className="w-3 h-3" />
        </a>

        <div className="mb-8 w-full max-w-md">
          {callingSince === null ? (
            <a
              href={`tel:${cleanPhone}`}
              onClick={startCall}
              className="group flex items-center justify-between px-5 py-5 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 rounded-xl shadow-lg shadow-emerald-900/30 transition animate-pulse-ring"
            >
              <div className="flex items-center gap-3">
                <PhoneCall className="w-7 h-7 text-white" />
                <div className="text-left">
                  <div className="text-[11px] uppercase tracking-wider text-emerald-50/80">Appeler</div>
                  <div className="text-2xl font-bold font-mono tracking-wide text-white">{current.phone}</div>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/70 bg-black/20 px-2 py-1 rounded">K</span>
            </a>
          ) : (
            <div className="flex items-center justify-between px-5 py-5 bg-amber-950/50 border border-amber-700/40 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${paused ? "bg-amber-500" : "bg-rose-500 animate-pulse"}`} />
                <div className="text-left">
                  <div className="text-[11px] uppercase tracking-wider text-amber-200/80">{paused ? "En pause" : "En cours"}</div>
                  <div className="text-2xl font-bold font-mono tracking-wide text-amber-100">{fmtTime(elapsed)}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="p-2 rounded-lg border border-amber-700/40 hover:bg-amber-900/30 text-amber-200 transition"
                  title={paused ? "Reprendre" : "Pause"}
                >
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={endCall}
                  className="p-2 rounded-lg border border-rose-700/40 hover:bg-rose-900/30 text-rose-200 transition"
                  title="Raccrocher (K)"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-md mb-8">
          <OutcomeButton
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Positif"
            shortcut="1 / P"
            color="emerald"
            onClick={() => finalize("positive")}
          />
          <OutcomeButton
            icon={<Phone className="w-5 h-5" />}
            label="Appelé"
            shortcut="2 / C"
            color="amber"
            onClick={() => finalize("called")}
          />
          <OutcomeButton
            icon={<PhoneOff className="w-5 h-5" />}
            label="Pas de rép."
            shortcut="4 / R"
            color="sky"
            onClick={() => finalize("no_answer")}
          />
          <OutcomeButton
            icon={<XCircle className="w-5 h-5" />}
            label="Négatif"
            shortcut="3 / N"
            color="rose"
            onClick={() => finalize("negative")}
          />
        </div>

        <div className="w-full max-w-md mb-6">
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
            Notes (T pour focus)
          </label>
          <textarea
            ref={noteRef}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => current && onUpdateNote(current.id, noteDraft)}
            placeholder="Disponibilités, infos clés, prochaine étape…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/60 text-sm resize-none transition"
          />
        </div>

        <div className="flex items-center justify-between w-full max-w-md text-xs">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-neutral-400 hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>
          <button
            onClick={skip}
            disabled={idx >= prospects.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-neutral-400 hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Passer (Espace) <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-[60]">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-3xl animate-confetti"
              style={{
                left: `${50 + (Math.random() - 0.5) * 40}%`,
                top: `${40 + (Math.random() - 0.5) * 20}%`,
                animationDelay: `${i * 30}ms`,
              }}
            >
              {["🎉", "✨", "💜", "⭐"][i % 4]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionBadge({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-neutral-500 uppercase tracking-wider">{label}</span>
      <span className={`font-bold ${accent}`}>{value}</span>
    </div>
  );
}

function OutcomeButton({ icon, label, shortcut, color, onClick }: { icon: React.ReactNode; label: string; shortcut: string; color: "emerald" | "amber" | "rose" | "sky"; onClick: () => void }) {
  const palette = {
    emerald: "from-emerald-500/15 to-emerald-700/10 border-emerald-700/50 hover:from-emerald-500/30 hover:to-emerald-700/20 text-emerald-200",
    amber: "from-amber-500/15 to-amber-700/10 border-amber-700/50 hover:from-amber-500/30 hover:to-amber-700/20 text-amber-200",
    rose: "from-rose-500/15 to-rose-700/10 border-rose-700/50 hover:from-rose-500/30 hover:to-rose-700/20 text-rose-200",
    sky: "from-sky-500/15 to-sky-700/10 border-sky-700/50 hover:from-sky-500/30 hover:to-sky-700/20 text-sky-200",
  }[color];
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 py-4 rounded-xl border bg-gradient-to-br transition ${palette}`}
    >
      <span className="opacity-90 group-hover:scale-110 transition">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-50">{shortcut}</span>
    </button>
  );
}
