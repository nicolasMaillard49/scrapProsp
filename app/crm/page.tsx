"use client";

// CRM — le tableau des dossiers clients.
//
// Ce n'est pas un pipeline de prospection : ici, chaque carte est quelqu'un qui
// a dit oui. On en aura peu — dix, vingt — donc l'écran assume de montrer
// BEAUCOUP par dossier (photo, prochaine étape, avancement, tarif) plutôt que
// d'entasser des lignes qu'il faudrait ouvrir pour comprendre.
//
// L'état d'un dossier se lit à sa POSITION, et se change en le DÉPLAÇANT — la
// grammaire de tous les CRM à pipeline. Voir `board.tsx`.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Loader2, X, RefreshCw } from "lucide-react";
import {
  CLIENT_STATUSES, CLIENT_STATUS_LABEL, CLIENT_STATUS_HINT, messageErreur,
  type ClientStatus, type CrmTotals,
} from "@/app/lib/crm";
import { euros, type ClientRow, type Candidate } from "./types";
import { Champ, INPUT } from "./ui";
import { Board } from "./board";
import { Supervision } from "./supervision";

export default function CrmPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totals, setTotals] = useState<CrmTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/crm");
      const j = await r.json();
      if (!r.ok) throw new Error(messageErreur(j, r.status));
      setRows(j.clients ?? []);
      setCandidates(j.candidates ?? []);
      setTotals(j.totals ?? null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((c) =>
      [c.nom, c.contact, c.metier, c.ville, c.email, c.telephone]
        .some((v) => (v ?? "").toLowerCase().includes(needle)));
  }, [rows, q]);

  /**
   * Déplacer une carte = changer son statut.
   *
   * L'écran bouge AVANT le serveur : un dossier qu'on lâche et qui revient à sa
   * place le temps d'un aller-retour donne l'impression d'un geste raté. En cas
   * d'échec, `load()` remet la vérité de la base et le message s'affiche.
   */
  const deplacer = useCallback(async (id: string, statut: ClientStatus) => {
    setRows((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    const r = await fetch(`/api/crm/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(messageErreur(j, r.status));
    }
    await load();
  }, [load]);

  /** Reprend un prospect booké en dossier — un clic, depuis la colonne « Piste ». */
  const reprendre = useCallback(async (p: Candidate) => {
    setImporting(p.id);
    try {
      const r = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram_prospect_id: p.id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setError(messageErreur(j, r.status));
        return;
      }
      await load();
    } finally {
      setImporting(null);
    }
  }, [load]);

  return (
    <main className="min-h-screen w-full px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-violet-500 hover:border-violet-500/50 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="mr-auto">
          <h1 className="font-display text-2xl text-[var(--color-text-primary)]">Clients</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Chaque colonne est un état. Déplacer une carte le change.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, métier, ville…"
            aria-label="Rechercher un dossier"
            className="pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] w-52 focus:border-violet-500/60 outline-none transition-colors motion-reduce:transition-none"
          />
        </div>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-violet-500 transition"
          title="Recharger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition"
        >
          <Plus className="w-4 h-4" /> Nouveau dossier
        </button>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-sm text-rose-500">{error}</div>
      )}

      {totals && <Totaux t={totals} />}

      {loading && !rows.length ? (
        <Squelette />
      ) : rows.length === 0 && candidates.length === 0 ? (
        <Vide onCreate={() => setCreating(true)} />
      ) : (
        <>
          {q && visibles.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] mb-3">Aucun dossier ne correspond à « {q} ».</p>
          )}
          <Board
            rows={visibles}
            candidates={candidates}
            onMove={deplacer}
            onImport={reprendre}
            importing={importing}
          />
          {/* La supervision vit SOUS le tableau : ce n'est pas une colonne de plus
              du pipeline de mission, c'est ce qui continue après lui. */}
          <Supervision rows={rows} onChange={load} />
        </>
      )}

      {creating && <NouveauDossier onClose={() => setCreating(false)} onDone={load} />}
    </main>
  );
}

/* ── Bandeau de totaux ───────────────────────────────────────────────────── */

function Totaux({ t }: { t: CrmTotals }) {
  const cells: [string, string, string?][] = [
    [String(t.actifs), "dossiers actifs"],
    [String(t.bloques), "en attente client", t.bloques > 0 ? "wait" : undefined],
    [euros(t.caEngage), "engagé"],
    // Les pistes restent à part : additionnées à l'engagé, elles feraient un
    // chiffre d'affaires qui n'existe pas encore.
    [euros(t.caPistes), "en pistes"],
  ];
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[var(--color-border)] mb-4">
      {cells.map(([val, label, tone]) => (
        <div key={label} className="px-4 py-3">
          <div className={`font-mono-num text-xl font-semibold ${tone === "wait" ? "text-amber-500" : "text-[var(--color-text-primary)]"}`}>{val}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Chargement ──────────────────────────────────────────────────────────── */

/**
 * Le tableau en gris pendant le chargement, et non un spinner centré.
 *
 * Les colonnes occupent tout de suite leur place définitive : rien ne saute
 * quand les dossiers arrivent.
 */
function Squelette() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Chargement des dossiers">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="shrink-0 w-[290px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <div className="h-3 w-24 rounded bg-[var(--color-border)] animate-pulse" />
          <div className="mt-3 h-40 rounded-lg bg-[var(--color-border)] opacity-60 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ── État vide ───────────────────────────────────────────────────────────── */

function Vide({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] py-14 text-center">
      <p className="text-sm text-[var(--color-text-secondary)]">Aucun dossier client pour l'instant.</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Un dossier s'ouvre quand quelqu'un a dit oui : depuis un prospect Instagram booké, ou à la main.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors motion-reduce:transition-none"
      >
        Ouvrir le premier
      </button>
    </div>
  );
}


/* ── Création à la main ──────────────────────────────────────────────────── */

function NouveauDossier({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    nom: "", contact: "", email: "", telephone: "", site_url: "",
    metier: "", ville: "", tarif_ht: "", statut: "piste", source: "audit", description: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setErr("Le nom est obligatoire."); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(messageErreur(j, r.status));
      onDone();
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      {/* `--color-surface-solid` : en sombre, `--color-surface` est semi-transparent
          et laisserait lire la page à travers le formulaire. */}
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg my-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-solid)] p-5 shadow-2xl"
      >
        <div className="flex items-center mb-4">
          <h2 className="font-display text-xl text-[var(--color-text-primary)] mr-auto">Nouveau dossier</h2>
          <button type="button" onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Nom *" className="sm:col-span-2">
            <input value={form.nom} onChange={set("nom")} autoFocus className={INPUT} placeholder="GP Élec" />
          </Champ>
          <Champ label="Interlocuteur"><input value={form.contact} onChange={set("contact")} className={INPUT} placeholder="Guillaume" /></Champ>
          <Champ label="Téléphone"><input value={form.telephone} onChange={set("telephone")} className={INPUT} placeholder="06 12 34 56 78" /></Champ>
          <Champ label="Email"><input value={form.email} onChange={set("email")} className={INPUT} type="email" /></Champ>
          <Champ label="Site"><input value={form.site_url} onChange={set("site_url")} className={INPUT} placeholder="gpelec.fr" /></Champ>
          <Champ label="Métier"><input value={form.metier} onChange={set("metier")} className={INPUT} placeholder="electricien" /></Champ>
          <Champ label="Ville"><input value={form.ville} onChange={set("ville")} className={INPUT} placeholder="Bordeaux" /></Champ>
          <Champ label="Tarif € HT"><input value={form.tarif_ht} onChange={set("tarif_ht")} className={INPUT} inputMode="decimal" placeholder="500" /></Champ>
          <Champ label="Statut">
            <select value={form.statut} onChange={set("statut")} className={INPUT}>
              {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{CLIENT_STATUS_LABEL[s]}</option>)}
            </select>
          </Champ>
          <Champ label="Origine" className="sm:col-span-2">
            <input value={form.source} onChange={set("source")} className={INPUT} placeholder="audit, recommandation, direct…" />
          </Champ>
          <Champ label="Contexte" className="sm:col-span-2">
            <textarea value={form.description} onChange={set("description")} rows={3} className={INPUT} placeholder="Ce qu'il veut, ce qu'on lui a promis." />
          </Champ>
        </div>

        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{CLIENT_STATUS_HINT[form.statut as keyof typeof CLIENT_STATUS_HINT]}</p>
        {err && <div className="mt-3 text-sm text-rose-500">{err}</div>}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Créer
          </button>
        </div>
      </form>
    </div>
  );
}
