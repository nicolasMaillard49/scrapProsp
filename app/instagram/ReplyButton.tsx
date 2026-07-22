"use client";

// Journalise une réponse ENTRANTE depuis le cockpit. C'est le seul endroit d'où
// `ig_replies` se remplit : sans ce clic, un refus sec reste invisible dans les KPI
// (ig_dm_log ne connaît que le sortant).

import { useEffect, useRef, useState } from "react";
import { MessageSquareReply, Check, Loader2 } from "lucide-react";

const KINDS = [
  { kind: "positive", label: "Intéressé", desc: "Il embraye, pose des questions", cls: "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10" },
  { kind: "neutre", label: "Neutre", desc: "Répond sans se positionner", cls: "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]" },
  { kind: "refus", label: "Refus", desc: "Décline explicitement", cls: "text-rose-700 dark:text-rose-400 hover:bg-rose-500/10" },
  { kind: "autorepondeur", label: "Autorépondeur", desc: "Message automatique — ne compte pas", cls: "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]" },
] as const;

interface Props {
  prospectId: string;
  accountId: string | null;
  replyCount: number;
  onLogged: (prospect: Record<string, unknown>) => void;
}

export default function ReplyButton({ prospectId, accountId, replyCount, onLogged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function log(kind: string) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/instagram/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, account_id: accountId, kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      onLogged(json.prospect ?? {});
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Journaliser une réponse reçue — alimente les KPI et sort le prospect de la file de relance"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
          replyCount > 0
            ? "border-[#0d9488]/40 bg-[#0d9488]/10 text-[#0f766e] dark:text-[#2dd4bf]"
            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        <MessageSquareReply className="w-3 h-3" />
        Réponse reçue
        {replyCount > 0 && <span className="font-mono-num tabular-nums">{replyCount}</span>}
      </button>

      {open && (
        <div
          role="menu"
          // Surface OPAQUE obligatoire : le menu recouvre la carte suivante.
          className="absolute left-0 bottom-full mb-2 z-40 w-64 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-solid)] shadow-xl overflow-hidden"
        >
          {KINDS.map((k) => (
            <button
              key={k.kind}
              role="menuitem"
              disabled={busy !== null}
              onClick={() => log(k.kind)}
              className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors border-b border-[var(--color-border)] last:border-b-0 cursor-pointer disabled:opacity-50 ${k.cls}`}
            >
              <span className="mt-0.5 shrink-0">
                {busy === k.kind ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 opacity-40" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{k.label}</span>
                <span className="block text-[11px] leading-snug text-[var(--color-text-muted)]">{k.desc}</span>
              </span>
            </button>
          ))}
          {error && <div className="px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400">{error}</div>}
        </div>
      )}
    </div>
  );
}
