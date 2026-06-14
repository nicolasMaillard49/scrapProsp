"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Building2,
  Briefcase,
  Search,
  Loader2,
  Star,
  Globe,
  GlobeOff,
  MapPin,
  ExternalLink,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface Candidate {
  name: string;
  metier: string;
  phone: string;
  ville: string;
  rating: number | null;
  reviews: number | null;
  website: string | null;
  address: string | null;
  maps_url: string;
  category: string;
}
interface MatchInfo {
  nameScore: number;
  phoneProvided: string | null;
  phoneFound: string | null;
  phoneMatch: boolean | null;
}
interface FindResult {
  found: boolean;
  candidate?: Candidate;
  match?: MatchInfo;
  exists?: { id: string; name: string; status: string } | null;
}

const inputCls =
  "w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-violet-500/60 focus:outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]";

export default function AjoutPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FindResult | null>(null);

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const search = async () => {
    if (!name.trim() || !sector.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAdded(false);
    try {
      const res = await fetch("/api/prospects/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: name.trim(), sector: sector.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Erreur ${res.status}`);
      } else {
        setResult(json);
      }
    } catch {
      setError("Erreur réseau — le scraper est peut-être indisponible.");
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    if (!result?.candidate || adding || added) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/prospects/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.candidate),
      });
      const json = await res.json();
      if (res.status === 409) {
        setAdded(true);
      } else if (!res.ok) {
        setError(json.error || "Erreur lors de l'ajout");
      } else {
        setAdded(true);
      }
    } catch {
      setError("Erreur réseau lors de l'ajout");
    } finally {
      setAdding(false);
    }
  };

  const c = result?.candidate;
  const m = result?.match;

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      {/* Top bar */}
      <div className="border-b border-[var(--color-border)] bg-[#111114] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg border border-[var(--color-border)] hover:border-violet-500/50 text-[var(--color-text-secondary)] hover:text-violet-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display italic text-[22px] leading-none tracking-tight">
              Ajout <span className="text-violet-300">manuel</span>
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono">
              Saisir une entreprise → le scraper la retrouve sur Google Maps
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-4"
        >
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de l'entreprise (ex: Plomberie Dupont)"
              className={inputCls}
            />
          </div>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Secteur / métier (ex: plombier, coiffeur)"
              className={inputCls}
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone (facultatif, fiabilise le rapprochement)"
              inputMode="tel"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim() || !sector.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Recherche sur Google Maps…" : "Rechercher l'entreprise"}
          </button>
          {loading && (
            <p className="text-center text-[11px] text-[var(--color-text-muted)]">
              Le scraper ouvre Maps — cela peut prendre 30 à 90 s.
            </p>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* No result */}
        {result && !result.found && (
          <div className="text-center py-10 px-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/30">
            <GlobeOff className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Aucune fiche Google Maps trouvée pour <strong>{name}</strong>.
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
              Vérifie l'orthographe du nom, précise le secteur, ou ajoute le téléphone.
            </p>
          </div>
        )}

        {/* Result card */}
        {c && m && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 overflow-hidden">
            {/* Confidence header */}
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                Fiche trouvée
              </span>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  m.nameScore >= 70
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : m.nameScore >= 40
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                }`}
              >
                match nom {m.nameScore}%
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h3 className="text-[16px] font-bold">{c.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--color-text-secondary)]">
                  {c.rating != null ? (
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      {c.rating} <span className="text-[var(--color-text-muted)]">({c.reviews ?? 0})</span>
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">Pas de note</span>
                  )}
                  <span className="text-[var(--color-text-muted)]">·</span>
                  <span>{c.metier}</span>
                  {c.ville && (
                    <>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span>{c.ville}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Website status */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  c.website
                    ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-300"
                    : "bg-rose-500/8 border-rose-500/25 text-rose-300"
                }`}
              >
                {c.website ? (
                  <>
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-medium truncate flex-1">
                      {c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                    </span>
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="p-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                ) : (
                  <>
                    <GlobeOff className="w-4 h-4" />
                    <span className="text-xs font-medium">Pas de site web — prospect idéal</span>
                  </>
                )}
              </div>

              {/* Phone + match */}
              <div className="px-3 py-2 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-1">
                  Téléphone
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-mono">{c.phone || "—"}</span>
                  {m.phoneMatch === true && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-300">
                      <CheckCircle className="w-3.5 h-3.5" /> correspond
                    </span>
                  )}
                  {m.phoneMatch === false && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" /> diffère du saisi
                    </span>
                  )}
                </div>
                {m.phoneMatch === false && m.phoneProvided && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    Saisi : <span className="font-mono">{m.phoneProvided}</span> · on garde le n° Google
                    Maps.
                  </p>
                )}
              </div>

              {/* Address */}
              {c.address && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)]">
                  <MapPin className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                  <span className="text-sm text-[var(--color-text-secondary)]">{c.address}</span>
                </div>
              )}

              {/* Maps link */}
              {c.maps_url && (
                <a
                  href={c.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-surface)]/40 border border-[var(--color-border)] hover:border-violet-500/40 transition text-xs text-[var(--color-text-secondary)] hover:text-violet-300"
                >
                  <MapPin className="w-4 h-4" />
                  Voir sur Google Maps
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
              )}
            </div>

            {/* Already exists notice */}
            {result?.exists && (
              <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Déjà dans ta liste (statut : {result.exists.status}).
              </div>
            )}

            {/* Action */}
            <div className="px-4 pb-4">
              <button
                onClick={add}
                disabled={adding || added || !!result?.exists}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  added
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 cursor-default"
                    : result?.exists
                      ? "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed"
                      : adding
                        ? "bg-violet-600/50 text-white/60 cursor-wait"
                        : "bg-violet-600 hover:bg-violet-500 text-white"
                }`}
              >
                {added ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> Ajouté à ta liste
                  </>
                ) : adding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Ajout…
                  </>
                ) : result?.exists ? (
                  "Déjà présent"
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Ajouter à mes prospects
                  </>
                )}
              </button>
              {added && (
                <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                  <Link href="/" className="text-violet-300 hover:underline">
                    Voir dans la liste
                  </Link>
                  <button
                    onClick={() => {
                      setResult(null);
                      setName("");
                      setSector("");
                      setPhone("");
                      setAdded(false);
                    }}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  >
                    Ajouter un autre
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
