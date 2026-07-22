"use client";

// Menu « Performance » du cockpit IG : trois vues de perf derrière un seul bouton
// (KPI internes, tableau de tracking Google Sheet, audience du compte).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronDown, Sheet, Users, ExternalLink } from "lucide-react";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/11XFKK4UUUh0TOkreUsBchTv-Uon9TvTKfZ3pHWJmpmo/edit";

const ITEMS = [
  {
    href: "/instagram/kpi",
    external: false,
    icon: BarChart3,
    label: "KPI prospection",
    desc: "Historique jour par jour : DM envoyés, réponses, calls bookés",
  },
  {
    href: SHEET_URL,
    external: true,
    icon: Sheet,
    label: "Google Sheet de tracking",
    desc: "Le tableau partagé, avec les colonnes remplies à la main",
  },
  {
    href: "/instagram/stats",
    external: false,
    icon: Users,
    label: "Audience du compte",
    desc: "Abonnés, couverture et engagement des posts (API Graph)",
  },
] as const;

export default function PerformanceMenu() {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
          open
            ? "border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        Performance
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          // Surface OPAQUE obligatoire : le menu recouvre le contenu de la page.
          className="absolute right-0 top-full mt-2 z-40 w-[19rem] rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-solid)] shadow-xl overflow-hidden"
        >
          {ITEMS.map((it) => {
            const inner = (
              <>
                <span className="mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <it.icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-text-primary)]">
                    {it.label}
                    {it.external && <ExternalLink className="w-3 h-3 opacity-50" />}
                  </span>
                  <span className="block text-[11px] leading-snug text-[var(--color-text-muted)] mt-0.5">{it.desc}</span>
                </span>
              </>
            );
            const cls =
              "flex items-start gap-2.5 px-3 py-2.5 no-underline transition-colors hover:bg-[var(--color-surface-2)] border-b border-[var(--color-border)] last:border-b-0";

            return it.external ? (
              <a key={it.href} href={it.href} target="_blank" rel="noopener noreferrer" role="menuitem" className={cls} onClick={() => setOpen(false)}>
                {inner}
              </a>
            ) : (
              <Link key={it.href} href={it.href} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
