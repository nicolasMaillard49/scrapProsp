"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const shortcuts: Array<[string, string, string]> = [
    ["Global", "F", "Lancer le mode Focus sur la sélection courante"],
    ["Global", "/", "Focus sur la recherche"],
    ["Global", "?", "Afficher cette aide"],
    ["Focus", "1 / P", "Marquer Positif (auto-advance)"],
    ["Focus", "2 / C", "Marquer Appelé"],
    ["Focus", "3 / N", "Marquer Négatif"],
    ["Focus", "K", "Démarrer / raccrocher le timer d'appel"],
    ["Focus", "T", "Focus sur le champ de notes"],
    ["Focus", "→ / Espace", "Prospect suivant"],
    ["Focus", "←", "Prospect précédent"],
    ["Focus", "Échap", "Quitter le mode Focus"],
  ];

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl max-w-lg w-full p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Raccourcis clavier</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-2)] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {shortcuts.map(([scope, keys, desc]) => (
            <div key={keys} className="flex items-center gap-3 text-sm py-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 w-12">{scope}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded">{keys}</kbd>
              <span className="text-neutral-300 flex-1">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
