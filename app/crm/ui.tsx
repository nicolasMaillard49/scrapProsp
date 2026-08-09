"use client";

// Les briques partagées par la liste et la fiche client.
// Elles vivent ici et pas dans une page : une page est une ROUTE, l'importer
// depuis une autre route pour trois composants brouille ce qui est rendu où.

import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

/**
 * Le glyphe Instagram, en SVG.
 *
 * `lucide-react` ne fournit plus les logos de marques : l'importer donnerait un
 * build rouge. Le même tracé est déjà en dur dans la barre de `/`.
 */
export function IgIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const INPUT =
  "w-full px-2.5 py-1.5 text-sm rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-violet-500/60 outline-none";

export function Champ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

/**
 * L'image du client. `<img>` et non `next/image` : l'URL est saisie à la main
 * et pointe n'importe où — la liste de domaines autorisés de `next/image`
 * refuserait la moitié des logos par une erreur en pleine page. Un logo mort
 * retombe sur l'initiale plutôt que sur une icône cassée.
 */
export function Avatar({ url, nom, size = 44 }: { url: string | null; nom: string; size?: number }) {
  const [ko, setKo] = useState(false);
  useEffect(() => setKo(false), [url]);

  if (url && !ko) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setKo(true)}
        style={{ width: size, height: size }}
        className="rounded-lg object-cover border border-[var(--color-border)] shrink-0 bg-[var(--color-background)]"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)]"
    >
      {nom
        ? <span className="font-display" style={{ fontSize: size / 2.4 }}>{nom.replace(/^@/, "").charAt(0).toUpperCase()}</span>
        : <Building2 style={{ width: size / 3, height: size / 3 }} />}
    </div>
  );
}

/**
 * Un champ qui s'enregistre TOUT SEUL en sortie de champ.
 *
 * Pas de bouton « Enregistrer » : sur une fiche qu'on ouvre pour corriger un
 * numéro de téléphone, un bouton à trouver est un aller-retour de trop — et un
 * formulaire non soumis est une correction perdue. La valeur ne remonte que si
 * elle a CHANGÉ, ce qui évite d'écrire en base à chaque passage de curseur.
 */
export function AutoField({
  value, onSave, placeholder, multiline, type, className = "", mono,
}: {
  value: string | null | undefined;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  className?: string;
  mono?: boolean;
}) {
  const initial = value ?? "";
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);

  // La valeur du serveur reprend la main quand elle change ailleurs (statut qui
  // repose une date, reprise d'un prospect…), mais JAMAIS pendant la frappe.
  useEffect(() => {
    setV(value ?? "");
  }, [value]);

  async function commit() {
    if (v === initial) return;
    setBusy(true);
    try {
      await onSave(v);
    } finally {
      setBusy(false);
    }
  }

  const cls = `${INPUT} ${mono ? "font-mono-num" : ""} ${className}`;
  return (
    <div className="relative">
      {multiline ? (
        <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={4} placeholder={placeholder} className={cls} />
      ) : (
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          type={type}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2 top-2.5 text-violet-500" />}
    </div>
  );
}
