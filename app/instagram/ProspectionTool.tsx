"use client";

// Outil de prospection Instagram (générateur de hashtags + scan + qualification IA
// + exports) — composant embarqué en HAUT de la page /instagram, au-dessus de la
// liste des prospects. `onDataChanged` est appelé après un scan ou une
// qualification pour rafraîchir la liste en dessous.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Loader2, Download, Play, ListChecks, Mail, Globe, Sparkles, Flame, Radar, UserSearch, Settings2 } from "lucide-react";
import { toCsv } from "@/app/lib/csv";
import type { HashtagRow } from "@/app/lib/hashtags";

interface RunProgress {
  current: number;
  total: number;
  profiles: number;
  withEmail: number;
  withoutSite: number;
  hot: number;
  currentTag: string;
}

interface DiscoverResultRow {
  email?: string | null;
  has_website?: boolean | null;
  score_tier?: string | null;
}

const MAX_RUN = 25; // borne dure de hashtags lancés par session (coût de scraping)

interface LeadsStatus {
  pending: number;
  resolved: number;
  abandoned: number;
  byMetier: { metier: string; pending: number }[];
  quota: { provider: string; limit: number; remaining: number } | null;
}

type HashtagMode = "metier" | "villes";

export default function ProspectionTool({ onDataChanged }: { onDataChanged?: () => void }) {
  const [metier, setMetier] = useState("");
  const [mode, setMode] = useState<HashtagMode>("metier");
  const [includeTransversal, setIncludeTransversal] = useState(false);
  const [departments, setDepartments] = useState("");
  const [limitTowns, setLimitTowns] = useState(100);
  const [perHashtag, setPerHashtag] = useState(20);

  const [rows, setRows] = useState<HashtagRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  // Qualification IA (méthode « filtrage ChatGPT » automatisée, lots de 40)
  const [avatarProfession, setAvatarProfession] = useState("");
  const [minFollowers, setMinFollowers] = useState(0);
  const [maxFollowers, setMaxFollowers] = useState(2500);
  const [qualifying, setQualifying] = useState(false);
  const [qualifyMsg, setQualifyMsg] = useState<string | null>(null);

  // ── Chasse simplifiée (défaut) : 2 boutons, aucun réglage.
  // La découverte hashtag est bon marché (1 requête ≈ 30 comptes) mais ne donne
  // que des ids ; la résolution en profils coûte 1 requête chacun. Les coller
  // dans un même clic faisait dépasser le maxDuration et l'écran restait vide.
  const [leads, setLeads] = useState<LeadsStatus | null>(null);
  const [hunting, setHunting] = useState<"collect" | "resolve" | null>(null);
  const [huntMsg, setHuntMsg] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/leads");
      if (res.ok) setLeads((await res.json()) as LeadsStatus);
    } catch {
      /* l'état de la file est indicatif : son échec ne bloque rien */
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const hunt = useCallback(
    async (action: "collect" | "resolve") => {
      const m = metier.trim();
      if (action === "collect" && !m) {
        setHuntMsg("Entre un métier (ex. menuisier) — le hashtag est choisi tout seul dans sa bibliothèque.");
        return;
      }
      setHunting(action);
      setHuntMsg(action === "collect" ? "Repérage des comptes…" : "Récupération des profils…");
      try {
        const res = await fetch("/api/instagram/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action === "collect" ? { action, metier: m } : { action, metier: m || undefined }),
        });
        const json = await res.json();
        if (!res.ok) {
          setHuntMsg(json.error ?? `Erreur ${res.status}`);
          return;
        }
        setLeads(json.status as LeadsStatus);
        if (action === "collect") {
          const r = json.result as { hashtag: string; queued: number; known: number; resumedFrom?: string | null; exhausted?: boolean };
          const reprise = r.resumedFrom ? " (reprise là où on s'était arrêté)" : "";
          setHuntMsg(
            r.exhausted
              ? `#${r.hashtag} : flux terminé, ce hashtag ne sera plus proposé. ${r.queued} comptes ajoutés.`
              : r.queued
                ? `#${r.hashtag}${reprise} : ${r.queued} comptes ajoutés à la file. Clique « Récupérer les profils » pour les traiter.`
                : `#${r.hashtag}${reprise} : ${r.known} comptes déjà connus, rien de neuf sur cette page. Relance — on repartira plus loin dans le hashtag.`,
          );
        } else {
          const r = json.result as { inserted: number; failed: number; pending: number };
          setHuntMsg(
            `${r.inserted} nouveaux prospects enregistrés${r.failed ? `, ${r.failed} inaccessibles` : ""}. ` +
              `${r.pending} comptes encore en file.`,
          );
          onDataChanged?.();
        }
      } catch (e) {
        setHuntMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setHunting(null);
      }
    },
    [metier, onDataChanged],
  );

  const generate = useCallback(async () => {
    if (!metier.trim()) {
      setGenMsg("Entre un métier (ex. coiffeur).");
      return;
    }
    setGenerating(true);
    setGenMsg(null);
    try {
      const depts = departments.split(/[\s,;]+/).map((d) => d.trim()).filter(Boolean);
      const res = await fetch("/api/instagram/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "metier"
            ? { metier: metier.trim(), mode, includeTransversal }
            : { metier: metier.trim(), mode, departments: depts, limitTowns },
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setGenMsg(`Erreur : ${json.error ?? res.status}`);
        return;
      }
      const list = (json.rows ?? []) as HashtagRow[];
      setRows(list);
      // Pré-sélection : mode métier → tous les hashtags métier (pas les transversaux) ;
      // mode villes → les 10 premières villes (les plus peuplées = plus actives).
      setSelected(
        mode === "metier"
          ? new Set(list.filter((r) => r.pattern === "metier").map((r) => r.hashtag))
          : new Set(list.slice(0, 10).map((r) => r.hashtag)),
      );
      setGenMsg(
        mode === "metier"
          ? `${list.length} hashtags métier générés (les plus qualifiés — la géo ne compte pas).`
          : `${list.length} hashtags générés sur ${json.towns} villes.`,
      );
      if (!avatarProfession.trim()) setAvatarProfession(metier.trim());
    } catch (e) {
      setGenMsg(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }, [metier, mode, includeTransversal, departments, limitTowns, avatarProfession]);

  const toggle = useCallback((tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const selectTop = useCallback((n: number) => {
    setSelected(new Set(rows.slice(0, n).map((r) => r.hashtag)));
  }, [rows]);

  const exportHashtagsCsv = useCallback(() => {
    const chosen = rows.filter((r) => selected.has(r.hashtag));
    const csv = toCsv(
      [
        { header: "hashtag", value: (r: HashtagRow) => r.hashtag },
        { header: "ville", value: (r: HashtagRow) => r.ville },
        { header: "population", value: (r: HashtagRow) => r.population },
        { header: "departement", value: (r: HashtagRow) => r.dept },
        { header: "metier", value: (r: HashtagRow) => r.metier },
        { header: "pattern", value: (r: HashtagRow) => r.pattern },
      ],
      chosen.length ? chosen : rows,
    );
    downloadCsv(csv, `hashtags-${metier.trim() || "insta"}.csv`);
  }, [rows, selected, metier]);

  const runProspection = useCallback(async () => {
    const tags = rows.filter((r) => selected.has(r.hashtag)).map((r) => r.hashtag).slice(0, MAX_RUN);
    if (!tags.length) {
      setRunMsg("Sélectionne au moins un hashtag.");
      return;
    }
    setRunning(true);
    setRunMsg(null);
    let profiles = 0;
    let withEmail = 0;
    let withoutSite = 0;
    let hot = 0;
    setProgress({ current: 0, total: tags.length, profiles: 0, withEmail: 0, withoutSite: 0, hot: 0, currentTag: "" });

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      setProgress({ current: i, total: tags.length, profiles, withEmail, withoutSite, hot, currentTag: tag });
      try {
        const res = await fetch("/api/instagram/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hashtag: tag, target: perHashtag, keepAll: true }),
        });
        const json = await res.json();
        if (res.ok && Array.isArray(json.results)) {
          for (const r of json.results as DiscoverResultRow[]) {
            profiles++;
            if (r.email) withEmail++;
            if (!r.has_website) withoutSite++;
            if (r.score_tier === "hot") hot++;
          }
        }
      } catch {
        /* un hashtag qui échoue ne stoppe pas le run */
      }
    }
    setProgress({ current: tags.length, total: tags.length, profiles, withEmail, withoutSite, hot, currentTag: "" });
    setRunMsg(`Terminé : ${profiles} profils (${withEmail} avec email, ${withoutSite} sans site, ${hot} 🔥 hot).`);
    setRunning(false);
    onDataChanged?.(); // rafraîchit la liste des prospects en dessous
  }, [rows, selected, perHashtag, onDataChanged]);

  const exportProfilesCsv = useCallback((filters?: { tier?: string; qualification?: string }) => {
    const u = new URL("/api/instagram/export", window.location.origin);
    if (metier.trim()) u.searchParams.set("metier", metier.trim());
    if (filters?.tier) u.searchParams.set("tier", filters.tier);
    if (filters?.qualification) u.searchParams.set("qualification", filters.qualification);
    window.open(u.toString(), "_blank");
  }, [metier]);

  /** Qualification IA : trie les profils en base par lots de 40 (verdict + score). */
  const runQualify = useCallback(async () => {
    if (!avatarProfession.trim()) {
      setQualifyMsg("Décris la profession de ton avatar client (ex. artisan menuisier).");
      return;
    }
    setQualifying(true);
    setQualifyMsg(null);
    try {
      const res = await fetch("/api/instagram/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metier: metier.trim() || undefined,
          onlyUnqualified: true,
          avatar: { profession: avatarProfession.trim(), minFollowers, maxFollowers },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setQualifyMsg(`Erreur : ${json.error ?? res.status}`);
        return;
      }
      if (!json.processed) {
        setQualifyMsg(json.note ?? "Aucun profil à qualifier.");
      } else {
        setQualifyMsg(
          `IA : ${json.processed} profils triés — ✅ ${json.qualified} qualifiés · 🟡 ${json.borderline} limites · ❌ ${json.rejected} écartés.` +
            (json.note ? ` ${json.note}` : ""),
        );
      }
    } catch (e) {
      setQualifyMsg(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setQualifying(false);
      onDataChanged?.(); // les verdicts/scores ont changé → rafraîchit la liste
    }
  }, [avatarProfession, minFollowers, maxFollowers, metier, onDataChanged]);

  const selectedCount = selected.size;
  const summary = useMemo(() => progress && progress.current >= progress.total && progress.total > 0 ? progress : null, [progress]);

  return (
    <div className="space-y-6">
      {/* ── Chasse en 2 temps (vue par défaut) ─────────────────────────────
          1. « Repérer » : 1 requête, empile ~30 comptes dans la file.
          2. « Récupérer » : traite un petit lot, rend la main à chaque fois.
          Le hashtag est choisi automatiquement dans la bibliothèque du métier —
          plus rien à sélectionner à la main. */}
      <section className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Radar size={16} className="text-[var(--color-accent)]" />
            Chasse
          </h3>
          {leads && (
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
              <span>
                <strong className="text-[var(--color-text-primary)]">{leads.pending}</strong> en file
              </span>
              {leads.quota && (
                <span
                  className={leads.quota.remaining < 20 ? "text-[var(--color-danger,#dc2626)] font-semibold" : ""}
                  title={`Crédits ${leads.quota.provider} restants ce mois`}
                >
                  {leads.quota.remaining}/{leads.quota.limit} requêtes
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={metier}
            onChange={(e) => setMetier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !hunting && hunt("collect")}
            placeholder="menuisier, paysagiste, coiffeur…"
            className="flex-1 glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
          />
          <button
            onClick={() => hunt("collect")}
            disabled={!!hunting}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {hunting === "collect" ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
            Repérer des comptes
          </button>
          <button
            onClick={() => hunt("resolve")}
            disabled={!!hunting || !leads?.pending}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {hunting === "resolve" ? <Loader2 size={15} className="animate-spin" /> : <UserSearch size={15} />}
            Récupérer les profils
          </button>
        </div>

        {huntMsg && <p className="text-xs text-[var(--color-text-secondary)]">{huntMsg}</p>}
        {!!leads?.byMetier.length && (
          <p className="text-xs text-[var(--color-text-tertiary,var(--color-text-secondary))]">
            En attente : {leads.byMetier.map((b) => `${b.metier} (${b.pending})`).join(" · ")}
          </p>
        )}
      </section>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] inline-flex items-center gap-1.5 select-none">
          <Settings2 size={14} />
          Réglages avancés — choisir les hashtags à la main, exports, qualification IA
        </summary>
        <div className="space-y-6 pt-4">
        {/* Étape 1 — générateur */}
        <section className="space-y-3">
          {/* Mode : hashtags métier purs (recommandé) vs métier × villes */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMode("metier")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                mode === "metier"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              Hashtags métier (recommandé)
            </button>
            <button
              onClick={() => setMode("villes")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                mode === "villes"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              Métier × petites villes
            </button>
            {mode === "metier" && (
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={includeTransversal}
                  onChange={(e) => setIncludeTransversal(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                + transversaux (rénovation, btp… gros volume, bruités)
              </label>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Métier</label>
              <input
                value={metier}
                onChange={(e) => setMetier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
                placeholder="menuisier, paysagiste, coiffeur…"
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            {mode === "villes" && (
              <>
                <div className="w-full sm:w-40">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Départements (option)</label>
                  <input
                    value={departments}
                    onChange={(e) => setDepartments(e.target.value)}
                    placeholder="33, 40, 64"
                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
                  />
                </div>
                <div className="w-full sm:w-28">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Nb villes</label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={limitTowns}
                    onChange={(e) => setLimitTowns(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
                  />
                </div>
              </>
            )}
            <div className="flex items-end">
              <button
                onClick={generate}
                disabled={generating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-60 bg-[var(--color-accent)] hover:opacity-90"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                {generating ? "Génération..." : "Générer"}
              </button>
            </div>
          </div>
          {genMsg && <p className="text-sm text-[var(--color-text-secondary)]">{genMsg}</p>}
        </section>

        {/* Étape 2 — sélection des hashtags */}
        {rows.length > 0 && (
          <section className="space-y-4 border-t border-[var(--color-border)] pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {selectedCount} / {rows.length} sélectionnés
              </span>
              <span className="flex-1" />
              <button onClick={() => selectTop(10)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] cursor-pointer">Top 10</button>
              <button onClick={() => selectTop(rows.length)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] cursor-pointer">Tout</button>
              <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] cursor-pointer">Aucun</button>
              <button onClick={exportHashtagsCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] cursor-pointer">
                <Download className="w-3.5 h-3.5" /> CSV hashtags
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {rows.map((r) => {
                const on = selected.has(r.hashtag);
                return (
                  <label key={r.hashtag} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors">
                    <input type="checkbox" checked={on} onChange={() => toggle(r.hashtag)} className="accent-[var(--color-accent)]" />
                    <span className="font-medium text-sm text-[var(--color-text-primary)]">#{r.hashtag}</span>
                    <span className="flex-1" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {r.ville
                        ? `${r.ville} (${r.dept}) · ${r.population.toLocaleString("fr-FR")} hab`
                        : r.pattern === "transversal"
                          ? "transversal · gros volume, à filtrer"
                          : "métier · le plus qualifié"}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-[var(--color-border)]">
              <div className="w-32">
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Profils / hashtag</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={perHashtag}
                  onChange={(e) => setPerHashtag(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
                />
              </div>
              <button
                onClick={runProspection}
                disabled={running || selectedCount === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-60 bg-[var(--color-accent)] hover:opacity-90"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? "Scan en cours..." : `Lancer la prospection (max ${MAX_RUN})`}
              </button>
              <p className="text-xs text-[var(--color-text-muted)]">
                <ListChecks className="w-3.5 h-3.5 inline -mt-0.5" /> Scanne chaque hashtag via Apify et enrichit la base (email, tél…).
              </p>
            </div>
          </section>
        )}

        {/* Étape 3 — progression / résumé / export */}
        {progress && (
          <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
            <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-[var(--color-text-secondary)]">
                {progress.current}/{progress.total} hashtags{progress.currentTag ? ` · #${progress.currentTag}` : ""}
              </span>
              <span className="text-[var(--color-text-primary)] font-semibold">{progress.profiles} profils</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Mail className="w-4 h-4" /> {progress.withEmail} avec email</span>
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Globe className="w-4 h-4" /> {progress.withoutSite} sans site</span>
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><Flame className="w-4 h-4" /> {progress.hot} hot</span>
            </div>
            {runMsg && <p className="text-sm text-[var(--color-text-secondary)]">{runMsg}</p>}
          </section>
        )}

        {/* Étape 4 — qualification IA (tri par lots de 40, façon « filtrage ChatGPT » automatisé) */}
        <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Qualification IA</h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              trie les profils en base par lots de 40 (nom, pseudo, abonnés, bio uniquement) → qualifié / limite / écarté + score
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Avatar client (profession)</label>
              <input
                value={avatarProfession}
                onChange={(e) => setAvatarProfession(e.target.value)}
                placeholder="artisan menuisier / paysagiste (TPE, solo…)"
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Abonnés min</label>
              <input
                type="number" min={0} value={minFollowers}
                onChange={(e) => setMinFollowers(Math.max(0, Number(e.target.value) || 0))}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Abonnés max</label>
              <input
                type="number" min={0} value={maxFollowers}
                onChange={(e) => setMaxFollowers(Math.max(0, Number(e.target.value) || 0))}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={runQualify}
                disabled={qualifying}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-60 bg-[var(--color-accent)] hover:opacity-90"
              >
                {qualifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {qualifying ? "Tri IA en cours..." : "Qualifier avec l'IA"}
              </button>
            </div>
          </div>
          {qualifyMsg && <p className="text-sm text-[var(--color-text-secondary)]">{qualifyMsg}</p>}
        </section>

        {/* Étape 5 — exports */}
        <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Exports CSV <span className="font-normal text-xs text-[var(--color-text-muted)]">— triés par score</span></h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportProfilesCsv()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Tous les profils
            </button>
            <button
              onClick={() => exportProfilesCsv({ tier: "hot" })}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] text-red-700 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" /> Hot uniquement
            </button>
            <button
              onClick={() => exportProfilesCsv({ qualification: "qualified" })}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Qualifiés IA
            </button>
          </div>
          {summary && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Dernier scan : {summary.profiles} profils · {summary.withEmail} emails · {summary.withoutSite} sans site · {summary.hot} hot.
            </p>
          )}
        </section>
        </div>
      </details>
    </div>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
