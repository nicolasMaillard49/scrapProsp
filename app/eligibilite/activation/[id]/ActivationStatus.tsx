"use client";

import { useEffect, useState } from "react";

/**
 * Polling de l'activation : interroge /activation-status toutes les 10 s.
 * - en attente  → bandeau « on vérifie… » avec point pulsant
 * - activé      → bandeau de succès (la campagne reste en PAUSE côté serveur)
 * Aucune action d'écriture : purement informatif pour le client.
 */
// On arrête le polling auto au bout de ~20 min (120 ticks de 10 s) pour ne pas
// marteler l'API si l'onglet reste ouvert ; on propose alors un rafraîchissement manuel.
const MAX_TICKS = 120;

export default function ActivationStatus({ id, initialActive = false }: { id: string; initialActive?: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (active) return;
    let alive = true;
    let ticks = 0;
    const check = async () => {
      try {
        const res = await fetch(`/api/eligibilite/activation-status/${id}`, { cache: "no-store" });
        const data = (await res.json()) as { active?: boolean };
        if (alive && data.active) setActive(true);
      } catch {
        /* on retentera au prochain tick */
      }
    };
    check();
    const t = setInterval(() => {
      if (++ticks >= MAX_TICKS) {
        clearInterval(t);
        if (alive) setStopped(true);
        return;
      }
      check();
    }, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, active]);

  if (active) {
    return (
      <div
        role="status"
        className="mt-3 flex items-start gap-3 rounded-[16px] p-4"
        style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.32)" }}
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: "22px" }}>✅</span>
        <p className="text-sm leading-relaxed" style={{ color: "#047857" }}>
          <b>Compte activé — votre carte est bien enregistrée.</b>
          <br />
          <span style={{ color: "var(--ink-soft)" }}>
            Votre campagne est prête (en pause). On la met en ligne <b style={{ color: "var(--ink)" }}>avec vous</b>, au moment où vous le souhaitez.
          </span>
        </p>
      </div>
    );
  }

  if (stopped) {
    return (
      <div
        role="status"
        className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[16px] p-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Vous avez ajouté votre carte ?
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm font-semibold"
          style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Vérifier maintenant →
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 flex items-center gap-3 rounded-[16px] p-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <span className="act-pulse" aria-hidden />
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        En attente de l&apos;activation… <span style={{ color: "var(--muted)" }}>on vérifie automatiquement toutes les 10&nbsp;s.</span>
      </p>
      <style>{`
        .act-pulse {
          width: 11px; height: 11px; border-radius: 999px;
          background: var(--accent); flex: none;
          box-shadow: 0 0 0 0 rgba(255, 110, 0, 0.55);
          animation: actPulse 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        @keyframes actPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255, 110, 0, 0.5); }
          70%  { box-shadow: 0 0 0 9px rgba(255, 110, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 110, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .act-pulse { animation: none; } }
      `}</style>
    </div>
  );
}
