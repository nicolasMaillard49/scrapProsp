"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  X, Phone, Smartphone, CheckCircle2, Settings, ExternalLink,
  MessageCircle, Calendar, ChevronDown,
} from "lucide-react";
import { whatsAppUrl, googleCalendarUrl, defaultRdvDate } from "../lib/links";

interface Props {
  open: boolean;
  name: string;
  phone: string;
  notes?: string;
  address?: string;
  initialTab?: "call" | "rdv";
  onClose: () => void;
  onMarkCalled?: () => void;
  onMarkPositive?: () => void;
}

const NTFY_KEY = "prospects-tracker-ntfy-topic";

export default function CallModal({
  open, name, phone, notes, address, initialTab = "call",
  onClose, onMarkCalled, onMarkPositive,
}: Props) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [ntfyTopic, setNtfyTopic] = useState<string>("");
  const [ntfyEditing, setNtfyEditing] = useState(false);
  const [ntfyDraft, setNtfyDraft] = useState("");
  const [pushed, setPushed] = useState(false);
  const [rdvOpen, setRdvOpen] = useState(initialTab === "rdv");

  const cleanPhone = phone.replace(/\s/g, "");
  const telUri = `tel:${cleanPhone}`;
  const waUrl = whatsAppUrl(phone);

  useEffect(() => {
    if (open) setRdvOpen(initialTab === "rdv");
  }, [open, initialTab]);

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
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, onMarkCalled]);

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
    try {
      await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: "POST",
        headers: {
          Title: `Appeler ${name}`,
          Priority: "high",
          Tags: "phone",
          Actions: `view, Appeler, ${telUri}, clear=true; view, WhatsApp, ${waUrl}`,
        },
        body: `${name}\n${phone}`,
      });
      setPushed(true);
      setTimeout(() => setPushed(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl max-w-md w-full p-6 my-4 animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Contacter</div>
            <div className="text-lg font-bold text-neutral-100">{name}</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-2)] rounded text-neutral-400 hover:text-neutral-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <a
          href={telUri}
          className="block text-center mb-5 font-mono text-3xl font-bold text-neutral-50 tracking-wider hover:text-violet-300 transition"
        >
          {phone}
        </a>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 border border-emerald-700/50 hover:from-emerald-500/30 hover:to-emerald-700/20 text-emerald-200 transition"
          >
            <WhatsAppIcon className="w-6 h-6" />
            <span className="font-medium text-sm">WhatsApp</span>
          </a>
          <a
            href={telUri}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/10 border border-violet-700/50 hover:from-violet-500/30 hover:to-violet-700/20 text-violet-200 transition"
          >
            <Phone className="w-6 h-6" />
            <span className="font-medium text-sm">Tel direct</span>
          </a>
        </div>

        {ntfyTopic && !ntfyEditing && (
          <button
            onClick={pushToPhone}
            disabled={pushed}
            className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl mb-4 font-medium transition shadow-lg ${
              pushed
                ? "bg-emerald-600/80 text-white shadow-emerald-900/30"
                : "bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white shadow-violet-900/30"
            }`}
          >
            {pushed ? (
              <><CheckCircle2 className="w-5 h-5" /> Envoyé sur le téléphone</>
            ) : (
              <><Smartphone className="w-5 h-5" /> Pousser sur mon téléphone</>
            )}
          </button>
        )}

        <details
          open={rdvOpen}
          onToggle={(e) => setRdvOpen((e.target as HTMLDetailsElement).open)}
          className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 group"
        >
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
            <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
              <Calendar className="w-4 h-4 text-violet-300" />
              Caler un RDV (Google Calendar)
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition" />
          </summary>
          <div className="px-4 pb-4">
            <RdvForm name={name} phone={phone} notes={notes} address={address} onCreated={onClose} />
          </div>
        </details>

        <details className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 group">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
            <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
              <Smartphone className="w-4 h-4 text-violet-300" />
              QR Code (scanner avec l'appareil photo)
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition" />
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
            className="w-full flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-violet-300 transition py-1.5 mb-3"
          >
            <Settings className="w-3 h-3" />
            Activer push notifications (ntfy.sh)
          </button>
        )}
        {ntfyTopic && !ntfyEditing && (
          <button
            onClick={() => { setNtfyDraft(ntfyTopic); setNtfyEditing(true); }}
            className="w-full text-[11px] text-neutral-600 hover:text-neutral-400 transition py-1 mb-3"
          >
            Topic ntfy : <span className="font-mono">{ntfyTopic}</span> · modifier
          </button>
        )}
        {ntfyEditing && (
          <NtfySetup draft={ntfyDraft} setDraft={setNtfyDraft} onSave={saveNtfy} onCancel={() => setNtfyEditing(false)} />
        )}

        <div className="flex gap-2">
          {onMarkCalled && (
            <button
              onClick={onMarkCalled}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 transition"
            >
              <Phone className="w-4 h-4" />
              Appelé
            </button>
          )}
          {onMarkPositive && (
            <button
              onClick={onMarkPositive}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Positif
            </button>
          )}
        </div>

        <div className="mt-3 text-center text-[10px] text-neutral-700">
          Entrée = marquer appelé · Échap = fermer
        </div>
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

  const handleCreate = () => {
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60_000);

    const details = [
      `Téléphone : ${phone}`,
      notes ? `Notes : ${notes}` : "",
      extraNotes ? `Détails RDV : ${extraNotes}` : "",
      address ? `Adresse : ${address}` : "",
    ].filter(Boolean).join("\n\n");

    const url = googleCalendarUrl({
      title: `RDV avec ${name}`,
      start,
      end,
      details,
      location: address || phone,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    onCreated?.();
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Heure</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Durée</label>
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
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium text-sm transition shadow-lg shadow-violet-900/30"
      >
        <Calendar className="w-4 h-4" />
        Ajouter à Google Calendar
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </button>
      <div className="text-[10px] text-neutral-600 text-center">
        Ouvre Google Calendar dans un nouvel onglet avec l'événement prérempli.
      </div>
    </div>
  );
}

function NtfySetup({ draft, setDraft, onSave, onCancel }: { draft: string; setDraft: (s: string) => void; onSave: () => void; onCancel: () => void }) {
  const generated = `prospects-${Math.random().toString(36).slice(2, 10)}`;
  return (
    <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-xs">
      <div className="font-medium text-neutral-200 mb-2 flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5" /> Setup ntfy (1 fois)
      </div>
      <ol className="space-y-1.5 text-neutral-400 mb-3 leading-relaxed list-decimal pl-4">
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
        <button onClick={() => setDraft(generated)} className="px-2 py-1.5 rounded border border-[var(--color-border)] text-neutral-400 hover:text-violet-300 transition text-[10px]">
          Générer
        </button>
      </div>
      <div className="flex gap-1.5">
        <button onClick={onSave} className="flex-1 px-3 py-1.5 text-xs rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 transition">
          Enregistrer
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-neutral-400 hover:text-neutral-100 transition">
          Annuler
        </button>
      </div>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  );
}
