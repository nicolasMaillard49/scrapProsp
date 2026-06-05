"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Search, Upload, Download, ExternalLink, MapPin, Star, Phone, PhoneOff,
  CheckCircle2, XCircle, Undo2, Keyboard, Sparkles, Trash2, User,
  Filter, ArrowUpDown, Clock, Globe, MessageSquare,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
} from "lucide-react";
import Link from "next/link";
import { whatsAppUrl } from "./lib/links";
import { isOpenNow, openLabel } from "./lib/openNow";
import { ageYears, isJeune, isRadie } from "./lib/sirene";
import AgeBadge from "./components/AgeBadge";
import FocusMode from "./components/FocusMode";
import KeyboardHelp from "./components/KeyboardHelp";
import ProgressRing from "./components/ProgressRing";
import CallModal, { WhatsAppIcon } from "./components/CallModal";
import { ToastProvider, useToast } from "./components/Toast";
import type { Prospect, Status } from "./lib/types";
import { useProspects } from "./lib/useProspects";
import { gbpBadge, computeGbpScore } from "./lib/gbp";
import { opportunityScore, opportunityBadge } from "./lib/opportunity";

const statusConfig: Record<Status, { label: string; ring: string; rowBg: string; text: string }> = {
  todo: { label: "À appeler", ring: "ring-neutral-700", rowBg: "", text: "text-neutral-400" },
  called: { label: "Appelé", ring: "ring-amber-600/60", rowBg: "bg-amber-950/20", text: "text-amber-300" },
  sms_sent: { label: "SMS envoyé", ring: "ring-violet-500/70", rowBg: "bg-violet-950/20", text: "text-violet-300" },
  positive: { label: "Positif", ring: "ring-emerald-500/70", rowBg: "bg-emerald-950/25", text: "text-emerald-300" },
  negative: { label: "Négatif", ring: "ring-rose-600/60", rowBg: "bg-rose-950/15", text: "text-rose-300" },
  no_answer: { label: "Pas de réponse", ring: "ring-sky-600/60", rowBg: "bg-sky-950/15", text: "text-sky-300" },
};

function HomeInner() {
  const toast = useToast();
  const {
    prospects,
    regions,
    loaded,
    updateStatus,
    updateNotes,
    setLocalNotes,
    resetProspect,
    importProspects,
  } = useProspects();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [metierFilter, setMetierFilter] = useState<"all" | "plombier" | "electricien">("all");
  const [villeFilter, setVilleFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [hideRadie, setHideRadie] = useState(true);
  const [jeuneOnly, setJeuneOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"reviews" | "reviews-asc" | "rating" | "name" | "age-asc" | "age-desc" | "gbp" | "opportunity">("opportunity");
  const [tourneeMode, setTourneeMode] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusStart, setFocusStart] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [callTarget, setCallTarget] = useState<Prospect | null>(null);
  const [callTab, setCallTab] = useState<"call" | "rdv">("call");
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", h, { passive: true });
    h();
    return () => window.removeEventListener("scroll", h);
  }, []);

  const promptRdvFor = (p: Prospect) => {
    setCallTarget(p);
    setCallTab("rdv");
  };

  const setStatusWithRdv = (p: Prospect, status: Status) => {
    const wasNotPositive = p.status !== "positive";
    updateStatus(p.id, status);
    if (status === "positive" && wasNotPositive) {
      toast.push("success", `${p.name} marqué positif`);
      setTimeout(() => promptRdvFor(p), 400);
    }
  };

  const enriched = useMemo(
    () => prospects.map((p) => ({
      p,
      _age: ageYears(p),
      _radie: isRadie(p),
      _jeune: isJeune(p),
      _opp: opportunityScore(p).score,
    })),
    [prospects],
  );

  const stats = useMemo(() => {
    const pool = regionFilter === "all" ? enriched : enriched.filter((e) => e.p.region === regionFilter);
    const s = { total: pool.length, todo: 0, called: 0, sms_sent: 0, positive: 0, negative: 0, no_answer: 0, jeunes: 0, radie: 0 };
    for (const e of pool) {
      const st = e.p.status;
      s[st]++;
      if (e._jeune) s.jeunes++;
      if (e._radie) s.radie++;
    }
    return s;
  }, [enriched, regionFilter]);

  const villes = useMemo(() => {
    const pool = regionFilter === "all" ? prospects : prospects.filter((p) => p.region === regionFilter);
    return Array.from(new Set(pool.map((p) => p.ville))).sort();
  }, [prospects, regionFilter]);

  const effectiveNow = openNowOnly ? now : null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, "");
    return enriched
      .filter(({ p, _radie, _jeune }) => {
        const st = p.status;
        if (filter !== "all" && st !== filter) return false;
        if (regionFilter !== "all" && p.region !== regionFilter) return false;
        if (metierFilter !== "all" && p.metier !== metierFilter) return false;
        if (villeFilter !== "all" && p.ville !== villeFilter) return false;
        if (effectiveNow && !isOpenNow(p, effectiveNow, now)) return false;
        if (hideRadie && _radie) return false;
        if (jeuneOnly && !_jeune) return false;
        if (q) {
          const matchesText = `${p.name} ${p.ville} ${p.metier} ${p.address || ""}`.toLowerCase().includes(q);
          const matchesPhone = qDigits.length >= 2 && p.phone.replace(/\D/g, "").includes(qDigits);
          if (!matchesText && !matchesPhone) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "opportunity") return b._opp - a._opp;
        if (sortBy === "reviews") return (b.p.reviews ?? 0) - (a.p.reviews ?? 0);
        if (sortBy === "reviews-asc") return (a.p.reviews ?? 0) - (b.p.reviews ?? 0);
        if (sortBy === "rating") return (b.p.rating ?? 0) - (a.p.rating ?? 0);
        if (sortBy === "gbp") {
          return computeGbpScore(b.p.rating, b.p.reviews) - computeGbpScore(a.p.rating, a.p.reviews);
        }
        if (sortBy === "age-asc" || sortBy === "age-desc") {
          const aa = a._age;
          const bb = b._age;
          if (aa === null && bb === null) return 0;
          if (aa === null) return 1;
          if (bb === null) return -1;
          return sortBy === "age-asc" ? aa - bb : bb - aa;
        }
        return a.p.name.localeCompare(b.p.name);
      })
      .map((e) => e.p);
  }, [enriched, search, filter, regionFilter, metierFilter, villeFilter, hideRadie, jeuneOnly, sortBy, effectiveNow, now]);

  // Auto-reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filter, regionFilter, metierFilter, villeFilter, openNowOnly, hideRadie, jeuneOnly, sortBy, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageStart = pageSize === 0 ? 0 : (safePage - 1) * pageSize;

  const hasActiveFilters =
    filter !== "all" || regionFilter !== "all" || metierFilter !== "all" ||
    villeFilter !== "all" || openNowOnly || jeuneOnly || !hideRadie || !!search;

  const resetFilters = () => {
    setSearch("");
    setFilter("all");
    setMetierFilter("all");
    setVilleFilter("all");
    setRegionFilter("all");
    setOpenNowOnly(false);
    setJeuneOnly(false);
    setHideRadie(true);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "?") { e.preventDefault(); setHelpOpen(true); }
      if (e.key.toLowerCase() === "f") {
        if (filtered.length === 0) return;
        setFocusStart(0);
        setFocusOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [filtered.length]);

  const exportCsv = () => {
    const rows = filtered.map((p) => ({
      name: p.name,
      metier: p.metier,
      phone: p.phone,
      ville: p.ville,
      departement: p.departement,
      region: p.region,
      region_label: p.region_label,
      rating: p.rating,
      reviews: p.reviews,
      address: p.address,
      maps_url: p.maps_url,
      status: statusConfig[p.status].label,
      notes: p.notes,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.push("success", `Export CSV de ${rows.length} prospects`);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const count = await importProspects(parsed.data);
    toast.push("success", `${count} prospects ajoutés / fusionnés`);
  };

  return (
    <main className="min-h-screen">
      <div className={`sticky top-0 z-20 border-b border-[var(--color-border)] px-3 md:px-6 py-2.5 md:py-3 transition-all duration-300 ${scrolled ? "bg-[#111114] shadow-lg shadow-black/30" : "glass"}`}>
        <div className="flex items-center justify-between flex-wrap gap-2 md:gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="hidden sm:block">
              <ProgressRing positive={stats.positive} called={stats.called} negative={stats.negative} total={stats.total} size={56} />
            </div>
            <div className="sm:hidden">
              <ProgressRing positive={stats.positive} called={stats.called} negative={stats.negative} total={stats.total} size={44} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display italic text-[22px] md:text-[28px] leading-none tracking-tight text-neutral-50 truncate">
                Prospects <span className="text-violet-300">Tracker</span>
              </h1>
              <p className="text-[10px] md:text-[11px] text-neutral-500 truncate mt-1 font-mono-num">
                {regions.length > 0 ? `${regions.length} régions` : ""} · {stats.total} prospects {regionFilter !== "all" ? `(${regions.find(r => r.key === regionFilter)?.label ?? ""})` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => {
                if (filtered.length === 0) { toast.push("error", "Aucun prospect dans la sélection"); return; }
                setFocusStart(0);
                setFocusOpen(true);
              }}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-medium transition shadow-lg shadow-violet-900/30"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden min-[420px]:inline">Focus</span>
              <span className="hidden md:inline">Mode</span>
              <kbd className="hidden md:inline ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-black/20 rounded">F</kbd>
            </button>
            <Link
              href="/carte"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-400 hover:text-violet-300 transition"
              title="Carte des prospects"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden md:inline">Carte</span>
            </Link>
            <Link
              href="/sms"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-400 hover:text-violet-300 transition"
              title="Suivi des SMS"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden md:inline">SMS</span>
            </Link>
            <Link
              href="/instagram"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-neutral-400 hover:text-violet-300 transition"
              title="Prospection Instagram"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
              <span className="hidden md:inline">Instagram</span>
            </Link>
            <button onClick={() => setHelpOpen(true)} className="hidden sm:flex p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-neutral-400 hover:text-neutral-100 transition" title="Raccourcis (?)">
              <Keyboard className="w-4 h-4" />
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span className="hidden md:inline">Import</span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            </label>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition">
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
            </button>
          </div>
        </div>

        {regions.length > 1 && (
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
            <button
              onClick={() => { setRegionFilter("all"); setVilleFilter("all"); }}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition ${
                regionFilter === "all"
                  ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                  : "bg-[var(--color-surface)]/50 border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
              }`}
            >
              <Globe className="w-3 h-3 inline mr-1" />
              Toutes ({prospects.length})
            </button>
            {regions.map((r) => {
              const count = prospects.filter((p) => p.region === r.key).length;
              return (
                <button
                  key={r.key}
                  onClick={() => { setRegionFilter(r.key); setVilleFilter("all"); }}
                  className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition ${
                    regionFilter === r.key
                      ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                      : "bg-[var(--color-surface)]/50 border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {r.label} <span className="text-neutral-600">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 md:px-6 py-3 md:py-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 md:gap-2 mb-3 md:mb-4 stagger-1">
          <StatCard label="Total" value={stats.total} sub={`${Math.round(((stats.positive + stats.called + stats.sms_sent + stats.negative + stats.no_answer) / Math.max(stats.total, 1)) * 100)} % traités`} active={filter === "all"} onClick={() => setFilter("all")} accent="text-neutral-100" />
          <StatCard label="À appeler" value={stats.todo} sub="non traités" active={filter === "todo"} onClick={() => setFilter("todo")} accent="text-neutral-300" iconBg="bg-neutral-800" />
          <StatCard label="SMS envoyés" value={stats.sms_sent} sub="contactés" active={filter === "sms_sent"} onClick={() => setFilter("sms_sent")} accent="text-violet-300" iconBg="bg-violet-950/40" />
          <StatCard label="Appelés" value={stats.called} sub="en attente" active={filter === "called"} onClick={() => setFilter("called")} accent="text-amber-300" iconBg="bg-amber-950/40" />
          <StatCard label="Pas de rép." value={stats.no_answer} sub="à rappeler" active={filter === "no_answer"} onClick={() => setFilter("no_answer")} accent="text-sky-300" iconBg="bg-sky-950/40" />
          <StatCard label="Positifs" value={stats.positive} sub={`${stats.positive > 0 && stats.called + stats.positive + stats.negative > 0 ? Math.round((stats.positive / (stats.called + stats.positive + stats.negative)) * 100) : 0} %`} active={filter === "positive"} onClick={() => setFilter("positive")} accent="text-emerald-300" iconBg="bg-emerald-950/40" />
          <StatCard label="Négatifs" value={stats.negative} sub="exclus" active={filter === "negative"} onClick={() => setFilter("negative")} accent="text-rose-300" iconBg="bg-rose-950/40" />
        </div>

        <div className="flex flex-wrap gap-1.5 md:gap-2 items-stretch mb-3 stagger-2">
          <div className="relative w-full md:flex-1 md:min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher nom, tél, ville, adresse… (/)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/60 transition"
            />
          </div>
          <SelectIcon icon={<Filter className="w-3.5 h-3.5" />}>
            <select value={metierFilter} onChange={(e) => setMetierFilter(e.target.value as typeof metierFilter)} className="bg-transparent text-sm outline-none cursor-pointer">
              <option value="all">Métier</option>
              <option value="plombier">Plombiers</option>
              <option value="electricien">Électriciens</option>
            </select>
          </SelectIcon>
          <SelectIcon icon={<MapPin className="w-3.5 h-3.5" />}>
            <select value={villeFilter} onChange={(e) => setVilleFilter(e.target.value)} className="bg-transparent text-sm outline-none cursor-pointer max-w-[110px] md:max-w-none">
              <option value="all">Ville</option>
              {villes.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </SelectIcon>
          <SelectIcon icon={<ArrowUpDown className="w-3.5 h-3.5" />}>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="bg-transparent text-sm outline-none cursor-pointer">
              <option value="opportunity">🔥 Opportunité ↓</option>
              <option value="reviews">Avis ↓</option>
              <option value="reviews-asc">Avis ↑</option>
              <option value="rating">Note ↓</option>
              <option value="age-asc">Âge ↑ (jeunes)</option>
              <option value="age-desc">Âge ↓ (anciens)</option>
              <option value="gbp">Score GBP ↓</option>
              <option value="name">A→Z</option>
            </select>
          </SelectIcon>
          <button
            onClick={() => setOpenNowOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              openNowOnly
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
            }`}
            title="N'afficher que les ouverts maintenant"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden min-[420px]:inline">Ouverts</span>
          </button>
          <button
            onClick={() => setJeuneOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              jeuneOnly
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
            }`}
            title="N'afficher que les entreprises jeunes (< 5 ans)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden min-[420px]:inline">Jeunes</span>
          </button>
          <button
            onClick={() => setHideRadie((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              hideRadie
                ? "bg-[var(--color-surface)] border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
                : "bg-rose-500/15 border-rose-500/40 text-rose-200"
            }`}
            title={hideRadie ? "Les entreprises radiées sont masquées (cliquer pour afficher)" : "Les radiées sont visibles (cliquer pour masquer)"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden min-[420px]:inline">{hideRadie ? "Radiées off" : "Radiées on"}</span>
          </button>
          <button
            onClick={() => {
              const next = !tourneeMode;
              setTourneeMode(next);
              if (next) {
                setSortBy("gbp");
                setFilter("todo");
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              tourneeMode
                ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)]"
            }`}
            title="Mode Tournée : prospects triés par potentiel GBP, filtrés à appeler"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden min-[420px]:inline">Tourn{"\u00E9"}e</span>
          </button>
        </div>

        <div className="text-xs text-neutral-500 mb-2 flex items-center gap-2 flex-wrap">
          <span>{filtered.length} prospect{filtered.length > 1 ? "s" : ""}</span>
          {stats.jeunes > 0 && (
            <button
              onClick={() => setJeuneOnly((v) => !v)}
              className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition ${jeuneOnly ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-500/10 text-emerald-300/80 hover:bg-emerald-500/15"}`}
              title="Entreprises de moins de 5 ans (les plus chaudes pour le pitch)"
            >
              🌱 {stats.jeunes} jeune{stats.jeunes > 1 ? "s" : ""}
            </button>
          )}
          {stats.radie > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300/80" title={hideRadie ? "Masquées" : "Visibles"}>
              ⛔ {stats.radie} radiée{stats.radie > 1 ? "s" : ""}
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              Effacer tous les filtres
            </button>
          )}
        </div>

        {!loaded && (
          <div className="stagger-3 space-y-2 md:hidden mb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[110px]" />
            ))}
          </div>
        )}
        {!loaded && (
          <div className="stagger-3 hidden md:block rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]/40">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[64px] m-2" />
            ))}
          </div>
        )}

        {/* MOBILE : vue cards */}
        <div className="md:hidden space-y-2 stagger-3">
          {paginated.map((p, localIdx) => {
            const idx = pageStart + localIdx;
            const cfg = statusConfig[p.status];
            const isOpen = isOpenNow(p, now, now);
            return (
              <div
                key={p.id}
                className={`rounded-xl border border-[var(--color-border)] ${cfg.rowBg || "bg-[var(--color-surface)]/40"} p-3.5`}
              >
                <div className="flex items-start gap-2.5 mb-2.5">
                  <button
                    onClick={() => { setFocusStart(idx); setFocusOpen(true); }}
                    className={`shrink-0 w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center ring-2 ${cfg.ring} text-neutral-500 hover:text-violet-300 transition`}
                  >
                    {idx + 1}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => { setCallTab("call"); setCallTarget(p); }} className="font-semibold text-neutral-100 leading-tight text-[15px] break-words text-left hover:text-violet-300 transition cursor-pointer">{p.name}</button>
                    <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap">
                      <span className={`px-2 py-0.5 rounded ${p.metier === "plombier" ? "bg-blue-950/60 text-blue-300" : "bg-yellow-950/60 text-yellow-300"}`}>
                        {p.metier}
                      </span>
                      <AgeBadge prospect={p} size="sm" />
                      {(() => {
                        const opp = opportunityScore(p);
                        const b = opportunityBadge(opp.score);
                        return (
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${b.bg} ${b.color}`}
                            title={opp.reasons.join(" · ") || "Score d'opportunité"}
                          >
                            🔥 {opp.score} · {b.label}
                          </span>
                        );
                      })()}
                      <span className="flex items-center gap-1 text-neutral-500">
                        <MapPin className="w-3 h-3" /> {p.ville}
                      </span>
                    </div>
                    {(p.dirigeant_nom || p.dirigeant_prenom) && (
                      <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-neutral-600 shrink-0" />
                        <span className="truncate">{[p.dirigeant_prenom, p.dirigeant_nom].filter(Boolean).join(" ")}</span>
                      </div>
                    )}
                    {p.address && (
                      <div className="text-xs text-neutral-600 mt-1 break-words" title={p.address}>
                        {p.address}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <a href={p.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50 transition" title="Fiche Google Maps">
                      <ExternalLink className="w-3.5 h-3.5" /> Google
                    </a>
                    <a href={`/maquette/${p.id}`} target="_blank" rel="noreferrer" className="p-1.5 text-neutral-600 hover:text-fuchsia-400 transition" title="Maquette site">
                      <Sparkles className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs mb-3 px-0.5">
                  {(() => {
                    const badge = gbpBadge(p.rating, p.reviews);
                    return p.rating ? (
                      <div className="flex items-center gap-1 text-neutral-300">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="font-semibold">{p.rating}</span>
                        <span className="text-neutral-600">({p.reviews})</span>
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.bg} ${badge.color}`}>{badge.label}</span>
                      </div>
                    ) : (
                      <span className="text-neutral-700">— pas de note —</span>
                    );
                  })()}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOpen ? "bg-emerald-400 ring-2 ring-emerald-400/30" : "bg-neutral-600"}`} />
                    <span className={`${isOpen ? "text-emerald-300" : "text-neutral-500"} truncate max-w-[160px]`}>
                      {openLabel(p, now, now)}
                    </span>
                  </div>
                </div>

                <div className="flex items-stretch gap-1.5 mb-3">
                  <a
                    href={whatsAppUrl(p.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 group flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-gradient-to-br from-emerald-600/30 to-emerald-700/15 border border-emerald-700/50 hover:from-emerald-500/40 active:from-emerald-500/50 text-emerald-100 font-mono font-bold text-[15px] transition shadow-sm"
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    {p.phone}
                  </a>
                  <a
                    href={`tel:${p.phone.replace(/\s/g, "")}`}
                    className="flex items-center justify-center px-3 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 active:bg-violet-500/10 text-neutral-400 hover:text-violet-300 transition"
                    title="Appeler directement"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                <div className="flex items-center gap-1.5 mb-2.5">
                  <StatusBtn active={p.status === "positive"} onClick={() => p.status === "positive" ? updateStatus(p.id, "todo") : setStatusWithRdv(p, "positive")} color="emerald" icon={<CheckCircle2 className="w-4 h-4" />} title="Positif" />
                  <StatusBtn active={p.status === "called"} onClick={() => updateStatus(p.id, p.status === "called" ? "todo" : "called")} color="amber" icon={<Phone className="w-4 h-4" />} title="Appelé" />
                  <StatusBtn active={p.status === "no_answer"} onClick={() => updateStatus(p.id, p.status === "no_answer" ? "todo" : "no_answer")} color="sky" icon={<PhoneOff className="w-4 h-4" />} title="Pas de réponse" />
                  <StatusBtn active={p.status === "negative"} onClick={() => updateStatus(p.id, p.status === "negative" ? "todo" : "negative")} color="rose" icon={<XCircle className="w-4 h-4" />} title="Négatif" />
                  {p.status !== "todo" && (
                    <button onClick={() => { resetProspect(p.id); toast.push("info", "Statut réinitialisé"); }} className="p-2 text-neutral-600 hover:text-neutral-300 transition" title="Reset">
                      <Undo2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className={`ml-auto text-xs font-medium ${cfg.text}`}>{cfg.label}</div>
                </div>

                <input
                  type="text"
                  placeholder="Notes…"
                  value={p.notes}
                  onChange={(e) => setLocalNotes(p.id, e.target.value)}
                  onBlur={(e) => updateNotes(p.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-background)]/60 border border-[var(--color-border)] focus:border-violet-500/40 transition placeholder:text-neutral-700"
                />
              </div>
            );
          })}
          {loaded && paginated.length === 0 && (
            <div className="py-12 text-center text-neutral-500 flex flex-col items-center gap-2">
              <Search className="w-8 h-8 text-neutral-700" />
              <div>Aucun prospect avec ces filtres</div>
              <button onClick={resetFilters} className="text-xs text-violet-400 hover:text-violet-300">
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>

        {/* DESKTOP : vue table */}
        <div className="hidden md:block rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]/40 stagger-3">
          <table className="w-full text-base">
            <thead className="bg-[var(--color-surface)]/80 backdrop-blur text-left text-xs uppercase tracking-wider text-neutral-500 border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-3 font-medium w-10"></th>
                <th className="px-4 py-3 font-medium">Prospect</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Horaires</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium w-[240px]">Notes</th>
                <th className="px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p, localIdx) => {
                const idx = pageStart + localIdx;
                const cfg = statusConfig[p.status];
                const isOpen = isOpenNow(p, now, now);
                return (
                  <tr key={p.id} className={`border-t border-[var(--color-border)] ${cfg.rowBg} hover:bg-[var(--color-surface)]/60 transition`}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setFocusStart(idx); setFocusOpen(true); }}
                        className={`w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center ring-2 ${cfg.ring} text-neutral-500 hover:text-violet-300 hover:ring-violet-500 transition`}
                        title="Ouvrir en Focus Mode"
                      >
                        {idx + 1}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setCallTab("call"); setCallTarget(p); }} className="font-semibold text-neutral-100 leading-tight text-base text-left hover:text-violet-300 transition cursor-pointer">{p.name}</button>
                      <div className="flex items-center gap-2 mt-1.5 text-sm flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs ${p.metier === "plombier" ? "bg-blue-950/60 text-blue-300" : "bg-yellow-950/60 text-yellow-300"}`}>
                          {p.metier}
                        </span>
                        <AgeBadge prospect={p} size="md" />
                        {(() => {
                          const opp = opportunityScore(p);
                          const b = opportunityBadge(opp.score);
                          return (
                            <span
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${b.bg} ${b.color}`}
                              title={opp.reasons.join(" · ") || "Score d'opportunité"}
                            >
                              🔥 {opp.score} · {b.label}
                            </span>
                          );
                        })()}
                        <span className="flex items-center gap-1 text-neutral-300 font-medium">
                          <MapPin className="w-4 h-4 text-neutral-500" /> {p.ville}
                        </span>
                        {p.region_label && p.region_label !== p.ville && (
                          <span className="text-neutral-400">· {p.region_label}</span>
                        )}
                      </div>
                      {(p.dirigeant_nom || p.dirigeant_prenom) && (
                        <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                          <User className="w-3 h-3 text-neutral-600 shrink-0" />
                          <span className="truncate max-w-[280px]">{[p.dirigeant_prenom, p.dirigeant_nom].filter(Boolean).join(" ")}</span>
                        </div>
                      )}
                      {p.address && (
                        <div className="text-xs text-neutral-600 mt-1 truncate max-w-[300px]" title={p.address}>
                          {p.address}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-stretch gap-1">
                        <a
                          href={whatsAppUrl(p.phone)}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-br from-emerald-600/25 to-emerald-700/10 border border-emerald-700/40 hover:from-emerald-500/35 hover:to-emerald-600/20 hover:border-emerald-500/60 text-emerald-100 font-mono font-semibold text-base transition shadow-sm"
                          title="Ouvrir WhatsApp"
                        >
                          <WhatsAppIcon className="w-4 h-4 group-hover:scale-110 transition" />
                          {p.phone}
                        </a>
                        <a
                          href={`tel:${p.phone.replace(/\s/g, "")}`}
                          className="flex items-center justify-center px-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 hover:bg-violet-500/10 text-neutral-400 hover:text-violet-300 transition"
                          title="Appeler directement"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isOpen ? "bg-emerald-400 ring-2 ring-emerald-400/30" : "bg-neutral-600"}`} />
                        <span className={`text-sm leading-tight ${isOpen ? "text-emerald-300" : "text-neutral-500"}`}>
                          {openLabel(p, now, now)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const badge = gbpBadge(p.rating, p.reviews);
                        return p.rating ? (
                          <div className="flex items-center gap-1 text-neutral-300">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="font-semibold text-base">{p.rating}</span>
                            <span className="text-neutral-600 text-sm">({p.reviews})</span>
                            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.bg} ${badge.color}`}>{badge.label}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-700">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <StatusBtn active={p.status === "positive"} onClick={() => p.status === "positive" ? updateStatus(p.id, "todo") : setStatusWithRdv(p, "positive")} color="emerald" icon={<CheckCircle2 className="w-4 h-4" />} title="Positif (proposera RDV)" />
                        <StatusBtn active={p.status === "called"} onClick={() => updateStatus(p.id, p.status === "called" ? "todo" : "called")} color="amber" icon={<Phone className="w-4 h-4" />} title="Appelé" />
                        <StatusBtn active={p.status === "no_answer"} onClick={() => updateStatus(p.id, p.status === "no_answer" ? "todo" : "no_answer")} color="sky" icon={<PhoneOff className="w-4 h-4" />} title="Pas de réponse" />
                        <StatusBtn active={p.status === "negative"} onClick={() => updateStatus(p.id, p.status === "negative" ? "todo" : "negative")} color="rose" icon={<XCircle className="w-4 h-4" />} title="Négatif" />
                        {p.status !== "todo" && (
                          <button onClick={() => { resetProspect(p.id); toast.push("info", "Statut réinitialisé"); }} className="p-2 text-neutral-600 hover:text-neutral-300 transition" title="Reset">
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Notes…"
                        value={p.notes}
                        onChange={(e) => setLocalNotes(p.id, e.target.value)}
                        onBlur={(e) => updateNotes(p.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded bg-[var(--color-background)]/50 border border-[var(--color-border)] focus:border-violet-500/40 transition placeholder:text-neutral-700"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <a href={p.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50 transition" title="Fiche Google Maps">
                          <ExternalLink className="w-3.5 h-3.5" /> Google
                        </a>
                        <a href={`/maquette/${p.id}`} target="_blank" rel="noreferrer" className="p-1 text-neutral-600 hover:text-fuchsia-400 transition inline-flex" title="Maquette site">
                          <Sparkles className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loaded && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                      <Search className="w-8 h-8 text-neutral-700" />
                      <div>Aucun prospect avec ces filtres</div>
                      <button onClick={resetFilters} className="text-xs text-violet-400 hover:text-violet-300">
                        Réinitialiser les filtres
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        )}

        <footer className="mt-6 flex items-center justify-between text-xs text-neutral-600">
          <span>Supabase · {prospects.filter(p => p.status !== "todo").length} interactions enregistrées</span>
          <button
            onClick={() => {
              resetFilters();
              toast.push("info", "Filtres réinitialisés");
            }}
            className="flex items-center gap-1 hover:text-rose-400 transition"
          >
            <Trash2 className="w-3 h-3" /> Réinitialiser les filtres
          </button>
        </footer>
      </div>

      <FocusMode
        open={focusOpen}
        prospects={filtered}
        initialIndex={focusStart}
        onClose={() => setFocusOpen(false)}
        onSetStatus={(id: string, status: Status, duration?: number) => updateStatus(id, status, duration)}
        onUpdateNote={(id: string, note: string) => updateNotes(id, note)}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CallModal
        open={!!callTarget}
        prospect={callTarget}
        isOpen={callTarget ? isOpenNow(callTarget, now, now) : undefined}
        hoursLabel={callTarget ? openLabel(callTarget, now, now) : undefined}
        initialTab={callTab}
        onClose={() => setCallTarget(null)}
        onMarkCalled={() => {
          if (callTarget) {
            updateStatus(callTarget.id, "called");
            toast.push("success", `${callTarget.name} marqué appelé`);
            setCallTarget(null);
          }
        }}
        onMarkPositive={() => {
          if (callTarget) {
            updateStatus(callTarget.id, "positive");
            toast.push("success", `${callTarget.name} marqué positif`);
            setCallTab("rdv");
          }
        }}
        onMarkNoAnswer={() => {
          if (callTarget) {
            updateStatus(callTarget.id, "no_answer");
            toast.push("success", `${callTarget.name} — pas de réponse`);
            setCallTarget(null);
          }
        }}
        onMarkNegative={() => {
          if (callTarget) {
            updateStatus(callTarget.id, "negative");
            toast.push("success", `${callTarget.name} marqué négatif`);
            setCallTarget(null);
          }
        }}
      />
    </main>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeInner />
    </ToastProvider>
  );
}

function StatCard({ label, value, sub, active, onClick, accent, iconBg }: { label: string; value: number; sub?: string; active: boolean; onClick: () => void; accent: string; iconBg?: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-2.5 md:px-3 py-2 md:py-2.5 rounded-xl border transition-all duration-200 group relative overflow-hidden ${
        active
          ? "bg-[var(--color-surface-2)] border-violet-500/50 shadow-lg shadow-violet-900/20 ring-1 ring-violet-500/20"
          : "bg-[var(--color-surface)]/50 border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:-translate-y-px"
      }`}
    >
      {active && (
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
      )}
      <div className="flex items-center justify-between mb-0.5">
        <div className="text-[9px] md:text-[10px] text-neutral-500 uppercase tracking-[0.14em] truncate">{label}</div>
        {iconBg && <div className={`w-1.5 h-1.5 rounded-full ${iconBg}`} />}
      </div>
      <div
        className={`${active ? "font-display italic" : "font-display"} text-2xl md:text-3xl leading-none tabular-nums ${accent}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      {sub && <div className="hidden md:block text-[10px] text-neutral-600 mt-1 font-mono-num">{sub}</div>}
    </button>
  );
}

function SelectIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-neutral-400 hover:border-[var(--color-border-strong)] transition">
      <span className="text-neutral-500">{icon}</span>
      {children}
    </div>
  );
}

function Pagination({ page, totalPages, pageSize, total, onPage, onPageSize }: {
  page: number; totalPages: number; pageSize: number; total: number;
  onPage: (n: number) => void; onPageSize: (n: number) => void;
}) {
  const from = pageSize === 0 ? 1 : (page - 1) * pageSize + 1;
  const to = pageSize === 0 ? total : Math.min(page * pageSize, total);

  // Build a compact page range with ellipses : 1 … 4 5 [6] 7 8 … 24
  const range: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) range.push(i);
  } else {
    range.push(1);
    if (page > 4) range.push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) range.push(i);
    if (page < totalPages - 3) range.push("…");
    range.push(totalPages);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 md:gap-3 px-1">
      <div className="flex items-center gap-1.5 md:gap-2 text-xs text-neutral-500">
        <span>
          <span className="text-neutral-300 font-medium tabular-nums">{from}–{to}</span>
          <span className="mx-1">/</span>
          <span className="text-neutral-400 tabular-nums">{total}</span>
        </span>
        <span className="text-neutral-700 hidden sm:inline">·</span>
        <span className="hidden sm:inline">
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="bg-transparent border-none outline-none text-xs text-neutral-300 hover:text-violet-300 cursor-pointer"
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={200}>200 / page</option>
            <option value={0}>Tout afficher</option>
          </select>
        </span>
      </div>

      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <PageBtn onClick={() => onPage(1)} disabled={page <= 1} title="Première">
            <ChevronsLeft className="w-3.5 h-3.5" />
          </PageBtn>
          <PageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} title="Précédente">
            <ChevronLeft className="w-3.5 h-3.5" />
          </PageBtn>
          {/* mobile : compteur compact */}
          <span className="md:hidden px-2 py-1 text-xs text-neutral-400 tabular-nums">
            <span className="text-violet-300 font-medium">{page}</span>
            <span className="text-neutral-700"> / </span>
            <span>{totalPages}</span>
          </span>
          {/* desktop : numéros */}
          <div className="hidden md:flex items-center gap-0.5 mx-1">
            {range.map((r, i) =>
              r === "…" ? (
                <span key={`e-${i}`} className="px-1.5 text-xs text-neutral-600">…</span>
              ) : (
                <button
                  key={r}
                  onClick={() => onPage(r)}
                  className={`min-w-[28px] px-1.5 py-1 text-xs rounded transition tabular-nums ${
                    r === page
                      ? "bg-violet-500/20 text-violet-200 border border-violet-500/40"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-[var(--color-surface)]"
                  }`}
                >
                  {r}
                </button>
              )
            )}
          </div>
          <PageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} title="Suivante">
            <ChevronRight className="w-3.5 h-3.5" />
          </PageBtn>
          <PageBtn onClick={() => onPage(totalPages)} disabled={page >= totalPages} title="Dernière">
            <ChevronsRight className="w-3.5 h-3.5" />
          </PageBtn>
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded border border-[var(--color-border)] text-neutral-400 hover:text-neutral-100 hover:border-[var(--color-border-strong)] disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}

function StatusBtn({ active, onClick, color, icon, title }: { active: boolean; onClick: () => void; color: "emerald" | "amber" | "rose" | "sky"; icon: React.ReactNode; title: string }) {
  const styles = active ? {
    emerald: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300",
    amber: "bg-amber-500/15 border-amber-500/50 text-amber-300",
    rose: "bg-rose-500/15 border-rose-500/50 text-rose-300",
    sky: "bg-sky-500/15 border-sky-500/50 text-sky-300",
  }[color] : "border-[var(--color-border)] text-neutral-500 hover:border-neutral-600 hover:text-neutral-300";
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded border transition ${styles}`}>
      {icon}
    </button>
  );
}
