"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; msg: string }

const ToastCtx = createContext<{ push: (kind: ToastKind, msg: string) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[100] pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border text-sm animate-slide-up shadow-2xl ${
              t.kind === "success" ? "bg-emerald-950/90 border-emerald-700/60 text-emerald-200" :
              t.kind === "error" ? "bg-rose-950/90 border-rose-700/60 text-rose-200" :
              "bg-[var(--color-surface-2)]/95 border-[var(--color-border)] text-[var(--color-text-primary)]"
            }`}
          >
            {t.kind === "success" && <CheckCircle2 className="w-4 h-4" />}
            {t.kind === "error" && <XCircle className="w-4 h-4" />}
            {t.kind === "info" && <Info className="w-4 h-4" />}
            <span>{t.msg}</span>
            <button
              onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
              className="ml-2 opacity-50 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
