"use client";

// Bloc visuel « pourquoi la chasse tombe » — partagé entre la chasse manuelle
// (ProspectionTool) et la Sélection du jour (page.tsx). Une ligne par source
// (apify / looter / stable) avec son état et l'indice concret (crédits épuisés,
// abo RapidAPI manquant, quota mensuel), plus le détail repliable de chaque
// tentative. C'est le pendant à l'écran des logs [ig:…] côté serveur.

import { Radar } from "lucide-react";

/** Diagnostic des sources renvoyé par l'API quand une chasse tombe. */
export interface SourceDiagnostic {
  providers: { provider: string; configured: boolean; available: boolean; reason?: string }[];
  attempts?: { provider: string; kind: string; message: string }[];
}

export function DiagBlock({ diag }: { diag: SourceDiagnostic }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs space-y-1.5">
      <p className="font-semibold text-red-400 flex items-center gap-1.5">
        <Radar size={13} /> Diagnostic des sources
      </p>
      <ul className="space-y-1">
        {diag.providers.map((p) => (
          <li key={p.provider} className="flex items-start gap-1.5 text-[var(--color-text-secondary)]">
            <span>{p.available ? "✅" : p.configured ? "⛔" : "🚫"}</span>
            <span>
              <b className="text-[var(--color-text-primary)]">{p.provider}</b>
              {p.available
                ? " — disponible"
                : !p.configured
                  ? " — clé/token absent (non configuré sur ce déploiement)"
                  : ` — ${p.reason ?? "écarté"}`}
              {p.provider !== "apify" && p.reason && /auth/i.test(p.reason) && (
                <em className="block text-[var(--color-text-tertiary,var(--color-text-secondary))]">
                  → clé invalide ou API non souscrite sur RapidAPI
                </em>
              )}
              {p.reason && /quota/i.test(p.reason) && (
                <em className="block text-[var(--color-text-tertiary,var(--color-text-secondary))]">
                  → quota épuisé {p.provider === "apify" ? "(crédits Apify)" : "(plan mensuel RapidAPI)"}
                </em>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!!diag.attempts?.length && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[var(--color-text-tertiary,var(--color-text-secondary))]">
            Détail des tentatives ({diag.attempts.length})
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {diag.attempts.map((a, i) => (
              <li key={i} className="text-[var(--color-text-secondary)]">
                ❌ <b>{a.provider}</b> <span className="opacity-70">[{a.kind}]</span> — {a.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
