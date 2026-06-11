"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  X, Phone, PhoneOff, Smartphone, CheckCircle2, XCircle, Settings, ExternalLink,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, MapPin, Star, Clock, History, Palette, MessageSquare, Send, Loader2, Globe,
} from "lucide-react";
import { whatsAppUrl, salesWhatsAppMsg, googleCalendarUrl, defaultRdvDate } from "../lib/links";
import { supabase } from "../lib/supabase";
import AgeBadge from "./AgeBadge";
import CompetitorSection from "./CompetitorSection";
import CompanyInfo from "./CompanyInfo";
import CallScript from "./CallScript";
import LiveRemote from "./LiveRemote";
import type { Call, Prospect, Status } from "../lib/types";

interface Props {
  open: boolean;
  prospect: Prospect | null;
  isOpen?: boolean;
  hoursLabel?: string;
  initialTab?: "call" | "rdv";
  onClose: () => void;
  onMarkCalled?: () => void;
  onMarkPositive?: () => void;
  onMarkNoAnswer?: () => void;
  onMarkNegative?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const statusLabel: Record<Status, { label: string; cls: string }> = {
  todo: { label: "À appeler", cls: "bg-neutral-200 text-neutral-700 border-neutral-300 dark:bg-neutral-700/40 dark:text-[var(--color-text-secondary)] dark:border-neutral-600/50" },
  called: { label: "Déjà appelé", cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/40" },
  sms_sent: { label: "SMS envoyé", cls: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/40" },
  positive: { label: "Positif", cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/40" },
  negative: { label: "Négatif", cls: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/40" },
  no_answer: { label: "Pas de réponse", cls: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/40" },
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mn = Math.round(diff / 60_000);
  if (mn < 1) return "à l'instant";
  if (mn < 60) return `il y a ${mn} min`;
  const h = Math.round(mn / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** "2026-06-04T16:30:00Z" -> "le 04/06 à 18h30" (heure locale). */
function fmtSmsDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `le ${date} à ${time}`;
}

function formatDuration(s?: number | null): string {
  if (!s) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m${r}s` : `${m}m`;
}

const NTFY_KEY = "prospects-tracker-ntfy-topic";

export default function CallModal({
  open, prospect, isOpen, hoursLabel, initialTab = "call",
  onClose, onMarkCalled, onMarkPositive, onMarkNoAnswer, onMarkNegative,
  onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [ntfyTopic, setNtfyTopic] = useState<string>("");
  const [ntfyEditing, setNtfyEditing] = useState(false);
  const [ntfyDraft, setNtfyDraft] = useState("");
  const [pushed, setPushed] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [rdvOpen, setRdvOpen] = useState(initialTab === "rdv");
  const [historyOpen, setHistoryOpen] = useState(false);
  // Envoi « livraison du site » par SMS depuis la fiche
  const [smsState, setSmsState] = useState<"idle" | "preview" | "sending" | "sent" | "error">("idle");
  const [smsPreview, setSmsPreview] = useState<{ message: string; segments: number } | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [lastSmsAt, setLastSmsAt] = useState<string | null>(null);

  const name = prospect?.name || "";
  const phone = prospect?.phone || "";
  const address = prospect?.address ?? undefined;
  const notes = prospect?.notes;

  const cleanPhone = phone.replace(/\s/g, "");
  const telUri = `tel:${cleanPhone}`;
  const salesMsg = salesWhatsAppMsg(name, prospect?.metier || "", prospect?.ville || "");
  const waUrl = whatsAppUrl(phone, salesMsg);
  const rating = prospect?.rating;
  const reviewCount = prospect?.reviews;
  const hasRating = rating != null && rating > 0;
  const calls: Call[] = prospect?.calls || [];
  const sortedCalls = [...calls].sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
  const lastCall = sortedCalls[0] ?? null;
  const currentStatus: Status = prospect?.status || "todo";
  const statusCfg = statusLabel[currentStatus];

  useEffect(() => {
    if (open) setRdvOpen(initialTab === "rdv");
  }, [open, initialTab]);

  // Réinitialise l'état d'envoi SMS quand on change de prospect / ferme la fiche
  useEffect(() => {
    setSmsState("idle");
    setSmsPreview(null);
    setSmsError(null);
  }, [prospect?.id, open]);

  // Charge la date du dernier SMS envoyé à ce prospect (pour la mention « SMS envoyé »)
  useEffect(() => {
    if (!open || !prospect?.id) {
      setLastSmsAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sms_messages")
        .select("sent_at")
        .eq("prospect_id", prospect.id)
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(1);
      if (!cancelled) setLastSmsAt(data?.[0]?.sent_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, prospect?.id]);

  const loadSmsPreview = async () => {
    if (!prospect) return;
    setSmsState("sending");
    setSmsError(null);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [prospect.id], template: "delivery", dryRun: true }),
      });
      const json = await res.json();
      const r = json.results?.[0];
      if (!res.ok) return setSmsErr(json.error || `Erreur ${res.status}`);
      if (!r?.ok) return setSmsErr(r?.error || "Numéro non mobile (pas de SMS possible)");
      setSmsPreview({ message: r.message, segments: r.segments });
      setSmsState("preview");
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : String(e));
    }
  };

  const sendSms = async () => {
    if (!prospect) return;
    setSmsState("sending");
    setSmsError(null);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [prospect.id], template: "delivery" }),
      });
      const json = await res.json();
      const r = json.results?.[0];
      if (!res.ok) return setSmsErr(json.error || `Erreur ${res.status}`);
      if (!r?.ok) return setSmsErr(r?.error || "Échec de l'envoi");
      setSmsState("sent");
      setLastSmsAt(new Date().toISOString());
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : String(e));
    }
  };

  function setSmsErr(msg: string) {
    setSmsError(msg);
    setSmsState("error");
  }

  useEffect(() => {
    try {
      const t = localStorage.getItem(NTFY_KEY);
      if (t) setNtfyTopic(t);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(telUri, {
      width: 220,
      margin: 1,
      color: { dark: "#ededf2", light: "#0a0a0c" },
      errorCorrectionLevel: "M",
    }).then(setQrUrl);
    setPushed(false);
  }, [open, telUri]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onMarkCalled?.();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
      if ((e.key === "m" || e.key === "M") && prospect) {
        window.open(`/maquette/${prospect.id}`, "_blank");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, onMarkCalled, onPrev, onNext, prospect]);

  const saveNtfy = () => {
    const clean = ntfyDraft.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (clean) {
      localStorage.setItem(NTFY_KEY, clean);
      setNtfyTopic(clean);
    } else {
      localStorage.removeItem(NTFY_KEY);
      setNtfyTopic("");
    }
    setNtfyEditing(false);
  };

  const pushToPhone = async () => {
    if (!ntfyTopic) return;
    setPushError(null);
    try {
      const r = await fetch("https://ntfy.sh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: ntfyTopic,
          title: `Appeler ${name}`,
          message: `${name}\n${phone}`,
          priority: 5,
          tags: ["phone"],
          actions: [
            { action: "view", label: "Appeler", url: telUri, clear: true },
            { action: "view", label: "WhatsApp", url: waUrl },
          ],
        }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        setPushError(`Échec ntfy ${r.status}${txt ? ` — ${txt.slice(0, 80)}` : ""}`);
        return;
      }
      setPushed(true);
      setTimeout(() => setPushed(false), 3000);
    } catch (e) {
      console.error(e);
      setPushError("Erreur réseau — vérifie ta connexion ou le topic");
    }
  };

  useEffect(() => {
    if (!open) setPushError(null);
  }, [open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const [competitorOpen, setCompetitorOpen] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      {hasPrev && onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Prospect précédent (←)"
          title="Prospect précédent (←)"
          className="hidden md:flex fixed left-3 top-1/2 -translate-y-1/2 z-[80] w-12 h-12 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-violet-500/60 shadow-lg hover:scale-105 active:scale-95 transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {hasNext && onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Prospect suivant (→)"
          title="Prospect suivant (→)"
          className="hidden md:flex fixed right-3 top-1/2 -translate-y-1/2 z-[80] w-12 h-12 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-violet-500/60 shadow-lg hover:scale-105 active:scale-95 transition"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
      <div
        className="flex flex-col md:flex-row md:items-start gap-4 my-2 sm:my-4 animate-slide-up w-full md:w-auto md:max-w-[96vw] justify-center transition-all duration-300"
      >
      {prospect && (
        <div className="order-2 md:order-1 w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
          <CallScript prospect={prospect} smsSent={!!lastSmsAt} />
        </div>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        className="order-1 md:order-2 bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl shrink-0 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden"
      >
        {/* Navigation prospect — mobile uniquement (les flèches flottantes sont masquées sur petit écran) */}
        {(hasPrev || hasNext) && (
          <div className="flex md:hidden items-center justify-between gap-2 mb-3">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm disabled:opacity-30 active:scale-95 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Préc.
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm disabled:opacity-30 active:scale-95 transition"
            >
              Suiv. <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
              {prospect?.metier && (
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  prospect.metier === "plombier" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300"
                }`}>
                  {prospect.metier}
                </span>
              )}
              {typeof isOpen === "boolean" && (
                <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  isOpen ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" : "bg-neutral-100 text-neutral-600 border border-neutral-300 dark:bg-neutral-800/60 dark:text-[var(--color-text-muted)] dark:border-neutral-700"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-neutral-600"}`} />
                  {isOpen ? "Ouvert" : "Fermé"}
                </span>
              )}
              {prospect && <AgeBadge prospect={prospect} size="xs" showSiret />}
              {lastSmsAt && (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30">
                  <MessageSquare className="w-3 h-3" /> SMS envoyé {fmtSmsDate(lastSmsAt)}
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-[var(--color-text-primary)] leading-tight break-words">{name}</div>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 hover:bg-[var(--color-surface-2)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 space-y-1.5 text-sm">
          {hasRating && (
            <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span className="font-semibold">{rating}</span>
              <span className="text-[var(--color-text-muted)]">/ 5 · {reviewCount} avis Google</span>
            </div>
          )}
          {(prospect?.ville || prospect?.departement || prospect?.region_label) && (
            <div className="flex items-start gap-1.5 text-[var(--color-text-secondary)]">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-[var(--color-text-muted)] shrink-0" />
              <div className="min-w-0">
                <div className="text-[var(--color-text-primary)]">
                  {prospect?.ville}
                  {prospect?.departement ? `, ${prospect.departement}` : ""}
                </div>
                {prospect?.region_label && (
                  <div className="text-[11px] text-[var(--color-text-muted)]">{prospect.region_label}</div>
                )}
                {address && (
                  <div className="text-[11px] text-[var(--color-text-muted)] break-words">{address}</div>
                )}
              </div>
            </div>
          )}
          {(hoursLabel || prospect?.hours_status) && (
            <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <Clock className={`w-3.5 h-3.5 shrink-0 ${isOpen ? "text-emerald-400" : "text-[var(--color-text-muted)]"}`} />
              <span className={`text-[12px] ${isOpen ? "text-emerald-700 dark:text-emerald-200" : ""}`}>
                {hoursLabel || prospect?.hours_status}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {prospect?.maps_url && (
              <a
                href={prospect.maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200 transition"
              >
                <ExternalLink className="w-3 h-3" /> Fiche Google Maps
              </a>
            )}
            {prospect?.website && (
              <a
                href={prospect.website}
                target="_blank"
                rel="noreferrer"
                title={prospect.website}
                className="inline-flex items-center gap-1 text-[12px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200 transition max-w-full"
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[220px]">{prospect.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
              </a>
            )}
          </div>
        </div>

        {prospect && <CompanyInfo prospect={prospect} />}

        {lastCall && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800 dark:bg-amber-500/5 dark:border-amber-500/20 dark:text-amber-200/80">
            Dernier appel <span className="font-medium text-amber-900 dark:text-amber-200">{formatRelativeTime(lastCall.called_at)}</span>
            {lastCall.duration ? ` · ${formatDuration(lastCall.duration)}` : ""}
          </div>
        )}

        {notes && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-[12px] text-violet-900 dark:bg-violet-500/5 dark:border-violet-500/20 dark:text-violet-100/90 whitespace-pre-wrap break-words">
            <div className="text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-1">Notes</div>
            {notes}
          </div>
        )}

        {sortedCalls.length > 0 && (
          <details
            open={historyOpen}
            onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
            className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/40 group"
          >
            <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
              <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
                <History className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />
                Historique des appels ({sortedCalls.length})
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-open:rotate-180 transition" />
            </summary>
            <ul className="px-3 pb-2.5 space-y-1.5 text-[11px]">
              {sortedCalls.slice(0, 10).map((h) => (
                <li key={h.id} className="flex items-start gap-2 pt-1.5 border-t border-[var(--color-border)] first:border-t-0 first:pt-0">
                  <span className={`shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full ${
                    h.status === "positive" ? "bg-emerald-400" :
                    h.status === "negative" ? "bg-rose-400" :
                    h.status === "called" ? "bg-amber-400" :
                    h.status === "no_answer" ? "bg-sky-400" : "bg-neutral-500"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[var(--color-text-secondary)]">
                      {statusLabel[h.status as Status].label}
                      {h.duration ? <span className="text-[var(--color-text-muted)]"> · {formatDuration(h.duration)}</span> : null}
                    </div>
                    <div className="text-[var(--color-text-muted)]">{formatRelativeTime(h.called_at)}</div>
                    {h.note && <div className="text-[var(--color-text-secondary)] break-words mt-0.5">{h.note}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <a
          href={telUri}
          className="block text-center mb-4 font-mono text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-wide sm:tracking-wider hover:text-violet-300 transition break-words"
        >
          {phone}
        </a>

        {/* Maquette CTA */}
        {prospect && (
          <a
            href={`/maquette/${prospect.id}`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 w-full mb-4 px-4 py-3 rounded-xl bg-[var(--color-background)] border border-dashed border-violet-300 hover:border-violet-500 hover:bg-violet-50 dark:border-violet-500/30 dark:hover:border-violet-400/60 dark:hover:bg-violet-500/5 transition"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5 text-violet-600 group-hover:text-violet-700 dark:text-violet-400 dark:group-hover:text-violet-300 transition" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-violet-700 dark:group-hover:text-violet-200 transition">Générer une maquette</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">Aperçu site web personnalisé</div>
            </div>
            <ExternalLink className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition shrink-0" />
          </a>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 text-white dark:bg-gradient-to-br dark:from-emerald-500/20 dark:to-emerald-700/10 dark:border-emerald-700/50 dark:hover:from-emerald-500/30 dark:hover:to-emerald-700/20 dark:text-emerald-200 transition"
          >
            <WhatsAppIcon className="w-6 h-6" />
            <span className="font-medium text-sm">WhatsApp</span>
          </a>
          <a
            href={telUri}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-600 text-white dark:bg-gradient-to-br dark:from-violet-500/20 dark:to-violet-700/10 dark:border-violet-700/50 dark:hover:from-violet-500/30 dark:hover:to-violet-700/20 dark:text-violet-200 transition"
          >
            <Phone className="w-6 h-6" />
            <span className="font-medium text-sm">Tel direct</span>
          </a>
        </div>

        {/* Envoyer le site par SMS (message « livraison », aperçu + confirmation) */}
        {prospect && (
          <div className="mb-4">
            {smsState === "sent" ? (
              <div className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600/80 text-white font-medium">
                <CheckCircle2 className="w-5 h-5" /> Site envoyé par SMS
              </div>
            ) : smsState === "preview" && smsPreview ? (
              <div className="rounded-xl border border-violet-300 bg-violet-50 dark:border-violet-700/50 dark:bg-violet-500/5 p-3">
                <div className="text-[11px] text-[var(--color-text-secondary)] mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />
                  Aperçu — {smsPreview.segments} SMS (~{(smsPreview.segments * 0.075).toFixed(2)} €)
                </div>
                <div className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap mb-3">{smsPreview.message}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSmsState("idle")}
                    className="py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={sendSms}
                    className="py-2 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium text-sm flex items-center justify-center gap-1.5 transition"
                  >
                    <Send className="w-4 h-4" /> Envoyer
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={loadSmsPreview}
                disabled={smsState === "sending"}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-600 text-white dark:bg-gradient-to-br dark:from-violet-500/20 dark:to-fuchsia-700/10 dark:border-violet-700/50 dark:hover:from-violet-500/30 dark:hover:to-fuchsia-700/20 dark:text-violet-100 font-medium transition disabled:opacity-50"
              >
                {smsState === "sending" ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                Envoyer le site par SMS
              </button>
            )}
            {smsState === "error" && smsError && (
              <div className="mt-1.5 px-3 py-1.5 rounded text-[11px] text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-300 dark:bg-rose-500/5 dark:border-rose-500/20 break-words">
                {smsError}
              </div>
            )}
          </div>
        )}

        {ntfyTopic && !ntfyEditing && (
          <div className="mb-4">
            <button
              onClick={pushToPhone}
              disabled={pushed}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition shadow-lg ${
                pushed
                  ? "bg-emerald-600/80 text-white shadow-emerald-900/30"
                  : pushError
                    ? "bg-rose-600/70 hover:bg-rose-600/85 text-white shadow-rose-900/30"
                    : "bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white shadow-violet-900/30"
              }`}
            >
              {pushed ? (
                <><CheckCircle2 className="w-5 h-5" /> Envoyé sur le téléphone</>
              ) : pushError ? (
                <><Smartphone className="w-5 h-5" /> Réessayer le push</>
              ) : (
                <><Smartphone className="w-5 h-5" /> Pousser sur mon téléphone</>
              )}
            </button>
            {pushError && (
              <div className="mt-1.5 px-3 py-1.5 rounded text-[11px] text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-300 dark:bg-rose-500/5 dark:border-rose-500/20 break-words">
                {pushError}
              </div>
            )}
          </div>
        )}

        {/* Télécommande de la démo live (Realtime) — pilote ce que le prospect voit pendant l'appel */}
        {prospect && <LiveRemote prospectId={prospect.id} />}

        <details
          open={rdvOpen}
          onToggle={(e) => setRdvOpen((e.target as HTMLDetailsElement).open)}
          className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 group"
        >
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-300" />
              Caler un RDV (Google Calendar)
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] group-open:rotate-180 transition" />
          </summary>
          <div className="px-4 pb-4">
            {/* key : remet le formulaire à zéro quand on navigue d'un prospect à l'autre */}
            <RdvForm key={prospect?.id ?? "rdv"} name={name} phone={phone} notes={notes} address={address} onCreated={onClose} />
          </div>
        </details>

        <details className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 group">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <Smartphone className="w-4 h-4 text-violet-600 dark:text-violet-300" />
              QR Code (scanner avec l'appareil photo)
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] group-open:rotate-180 transition" />
          </summary>
          <div className="px-4 pb-4 flex justify-center">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR ${phone}`} className="w-[200px] h-[200px] rounded" />
            ) : (
              <div className="w-[200px] h-[200px] bg-[var(--color-surface-2)] animate-pulse rounded" />
            )}
          </div>
        </details>

        {!ntfyTopic && !ntfyEditing && (
          <button
            onClick={() => { setNtfyDraft(""); setNtfyEditing(true); }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-violet-300 transition py-1.5 mb-3"
          >
            <Settings className="w-3 h-3" />
            Activer push notifications (ntfy.sh)
          </button>
        )}
        {ntfyTopic && !ntfyEditing && (
          <button
            onClick={() => { setNtfyDraft(ntfyTopic); setNtfyEditing(true); }}
            className="w-full text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition py-1 mb-3"
          >
            Topic ntfy : <span className="font-mono">{ntfyTopic}</span> · modifier
          </button>
        )}
        {ntfyEditing && (
          <NtfySetup draft={ntfyDraft} setDraft={setNtfyDraft} onSave={saveNtfy} onCancel={() => setNtfyEditing(false)} />
        )}

        <div className="space-y-2">
          {(onMarkCalled || onMarkNoAnswer) && (
            <div className="flex gap-2">
              {onMarkCalled && (
                <button
                  onClick={onMarkCalled}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/25 transition"
                >
                  <Phone className="w-4 h-4" />
                  Appelé
                </button>
              )}
              {onMarkNoAnswer && (
                <button
                  onClick={onMarkNoAnswer}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg bg-sky-100 border border-sky-300 text-sky-800 hover:bg-sky-200 dark:bg-sky-500/15 dark:border-sky-500/40 dark:text-sky-200 dark:hover:bg-sky-500/25 transition"
                  title="Pas de réponse — à rappeler plus tard"
                >
                  <PhoneOff className="w-4 h-4" />
                  Pas de rép.
                </button>
              )}
            </div>
          )}
          {(onMarkPositive || onMarkNegative) && (
            <div className="flex gap-2">
              {onMarkPositive && (
                <button
                  onClick={onMarkPositive}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/25 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Positif
                </button>
              )}
              {onMarkNegative && (
                <button
                  onClick={onMarkNegative}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg bg-rose-100 border border-rose-300 text-rose-800 hover:bg-rose-200 dark:bg-rose-500/15 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/25 transition"
                  title="Négatif — exclu, ferme la fiche"
                >
                  <XCircle className="w-4 h-4" />
                  Négatif
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 text-center text-[10px] text-[var(--color-text-muted)]">
          ← / → = prospect précédent / suivant · Entrée = appelé · M = maquette · Échap = fermer
        </div>
      </div>

      {/* Right panel: Competitor analysis */}
      {prospect && (
        <div className="order-3 w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
          <CompetitorSection
            prospectId={prospect.id}
            ville={prospect.ville || ""}
            metier={prospect.metier || ""}
            prospectName={prospect.name}
            prospectPhone={prospect.phone || ""}
            prospectRating={prospect.rating ?? null}
            prospectReviews={prospect.reviews ?? null}
            onExpandChange={setCompetitorOpen}
          />
        </div>
      )}
      </div>
    </div>
  );
}

function RdvForm({ name, phone, notes, address, onCreated }: { name: string; phone: string; notes?: string; address?: string; onCreated?: () => void }) {
  const def = useMemo(() => defaultRdvDate(), []);
  const [date, setDate] = useState(def.date);
  const [time, setTime] = useState(def.time);
  const [duration, setDuration] = useState(30);
  const [extraNotes, setExtraNotes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Le même événement sert à l'API et au fallback URL Google Calendar.
  const buildEvent = () => {
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60_000);
    const details = [
      `Téléphone : ${phone}`,
      notes ? `Notes : ${notes}` : "",
      extraNotes ? `Détails RDV : ${extraNotes}` : "",
      address ? `Adresse : ${address}` : "",
    ].filter(Boolean).join("\n\n");
    return { title: `RDV avec ${name}`, start, end, details, location: address || phone };
  };

  /** Onglet Google Calendar prérempli — même contenu que l'API. */
  const openFallback = () => {
    window.open(googleCalendarUrl(buildEvent()), "_blank", "noopener,noreferrer");
    onCreated?.();
  };

  // Création directe via l'API (compte de service). Fallback : onglet Google
  // Calendar prérempli si l'intégration n'est pas configurée (501).
  const handleCreate = async () => {
    const ev = buildEvent();
    setState("sending");
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ev.title, start: ev.start.toISOString(), end: ev.end.toISOString(), description: ev.details, location: ev.location }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) { window.location.assign("/login"); return; }
      if (res.status === 501) {
        setState("idle");
        openFallback();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
      closeTimer.current = setTimeout(() => onCreated?.(), 700);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Heure</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Durée</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 h</option>
            <option value={90}>1 h 30</option>
          </select>
        </div>
      </div>
      <textarea
        value={extraNotes}
        onChange={(e) => setExtraNotes(e.target.value)}
        placeholder="Détails du RDV (optionnel, ajoutés à la description)"
        rows={2}
        className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50 resize-none"
      />
      <button
        onClick={handleCreate}
        disabled={state === "sending" || state === "done"}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white font-medium text-sm transition shadow-lg ${
          state === "done"
            ? "bg-emerald-600 shadow-emerald-900/30"
            : "bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 shadow-violet-900/30 disabled:opacity-70"
        }`}
      >
        {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
        {state === "done" ? "RDV ajouté à l'agenda ✓" : state === "sending" ? "Création…" : "Caler le RDV dans l'agenda"}
      </button>
      {state === "error" && (
        <div className="text-[11px] text-rose-500 text-center">
          Création impossible — <button onClick={handleCreate} className="underline">réessaie</button>, ou{" "}
          <button onClick={openFallback} className="underline">ouvre Google Calendar</button>.
        </div>
      )}
      <div className="text-[10px] text-[var(--color-text-muted)] text-center">
        Créé directement dans ton Google Calendar — visible sur la page <a href="/agenda" className="underline hover:text-violet-400">Agenda</a>.
      </div>
    </div>
  );
}

function NtfySetup({ draft, setDraft, onSave, onCancel }: { draft: string; setDraft: (s: string) => void; onSave: () => void; onCancel: () => void }) {
  const generateTopic = () => `prospects-${Math.random().toString(36).slice(2, 10)}`;
  return (
    <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-xs">
      <div className="font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5" /> Setup ntfy (1 fois)
      </div>
      <ol className="space-y-1.5 text-[var(--color-text-secondary)] mb-3 leading-relaxed list-decimal pl-4">
        <li>Installe l'appli <span className="text-violet-300">ntfy</span> sur ton tél (App Store / Play Store)</li>
        <li>Crée un topic (n'importe quel nom unique, garde-le secret)</li>
        <li>Colle le même nom ici :</li>
      </ol>
      <div className="flex gap-1.5 mb-2">
        <input
          type="text"
          autoFocus
          placeholder="ex: nicolas-prospects-2025"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-mono focus:border-violet-500/50"
          onKeyDown={(e) => e.key === "Enter" && onSave()}
        />
        <button onClick={() => setDraft(generateTopic())} className="px-2 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-violet-300 transition text-[10px]">
          Générer
        </button>
      </div>
      <div className="flex gap-1.5">
        <button onClick={onSave} className="flex-1 px-3 py-1.5 text-xs rounded bg-violet-600 border border-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-500/30 transition">
          Enregistrer
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">
          Annuler
        </button>
      </div>
    </div>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  );
}
