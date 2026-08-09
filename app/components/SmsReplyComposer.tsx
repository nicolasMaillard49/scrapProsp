"use client";

import { useState } from "react";
import { Send, Loader2, Ban } from "lucide-react";
import { smsSegments } from "../lib/sms";
import { REPLY_TEMPLATES } from "../lib/smsReplyTemplates";

interface SentInfo {
  text: string;
  sid: string;
  segments: number;
  sentAt: string;
}

interface Props {
  /** Numéro du contact (E.164 ou format FR ; le backend re-normalise). */
  to: string;
  prospectId?: string | null;
  /** true si le contact s'est désinscrit (STOP) : envoi bloqué. */
  blocked?: boolean;
  /** Appelé après un envoi réussi (mise à jour optimiste du fil). */
  onSent?: (info: SentInfo) => void;
  /** Taille compacte (fiche) vs confortable (page /sms). */
  compact?: boolean;
}

export default function SmsReplyComposer({ to, prospectId, blocked, onSent, compact }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (blocked) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/40 rounded-lg px-3 py-2">
        <Ban className="w-3.5 h-3.5 shrink-0" /> Contact désinscrit (STOP) — réponse impossible.
      </div>
    );
  }

  const trimmed = text.trim();
  const segments = trimmed ? smsSegments(trimmed) : 0;

  const insertTemplate = (t: string) => {
    setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
  };

  const send = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sms/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospectId ?? null, to, text: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Erreur ${res.status}`);
        return;
      }
      onSent?.({ text: trimmed, sid: json.sid, segments: json.segments, sentAt: json.sentAt });
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+Entrée pour envoyer (Entrée seule = saut de ligne).
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      {/* Modèles rapides */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {REPLY_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => insertTemplate(t.text)}
            className="px-2 py-1 text-[11px] rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition"
            title={t.text}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={compact ? 2 : 3}
          placeholder="Votre réponse…"
          className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-strong)]"
        />
        <button
          type="button"
          onClick={send}
          disabled={!trimmed || sending}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-[var(--color-accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition"
          title="Envoyer (Ctrl+Entrée)"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {!compact && "Envoyer"}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {segments > 0 ? `${segments} SMS · ${trimmed.length} car.` : "Ctrl+Entrée pour envoyer"}
        </span>
        {error && <span className="text-[11px] text-rose-700 dark:text-rose-300">{error}</span>}
      </div>
    </div>
  );
}
