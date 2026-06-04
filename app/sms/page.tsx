"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Inbox,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDashed,
  ThumbsUp,
  ThumbsDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

/* ── Types ────────────────────────────────────────────────────────────────── */
type Direction = "outbound" | "inbound";
type Sentiment = "positive" | "negative" | "neutral" | null;

interface SmsRow {
  id: string;
  prospect_id: string | null;
  direction: Direction;
  to_phone: string | null;
  from_phone: string | null;
  body: string;
  segments: number | null;
  status: string | null;
  sentiment: Sentiment;
  sentiment_source: string | null;
  sent_at: string | null;
}

/** Conversation = tous les SMS partageant le même numéro de contact. */
interface Convo {
  key: string;
  phone: string;
  prospectId: string | null;
  name: string | null;
  sent: SmsRow[];
  replies: SmsRow[];
  lastAt: string;
  lastStatus: string | null;
  sentiment: Sentiment; // sentiment de la dernière réponse
  lastReply: SmsRow | null;
}

type Filter = "all" | "replied" | "positive" | "negative" | "failed";

/* "+33612…" / "06 12…" -> "33612…" */
function normFr(phone: string | null): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("33")) return d;
  if (d.startsWith("0")) return "33" + d.slice(1);
  return d;
}

function prettyPhone(p33: string): string {
  // 33612345678 -> 06 12 34 56 78
  if (/^33[67]\d{8}$/.test(p33)) {
    const local = "0" + p33.slice(2);
    return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return p33;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const FAILED = new Set(["failed", "undelivered"]);

/* ── Badges ───────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-neutral-600">—</span>;
  const failed = FAILED.has(status);
  const delivered = status === "delivered";
  const cls = failed
    ? "text-rose-300 bg-rose-950/40 border-rose-900/50"
    : delivered
      ? "text-emerald-300 bg-emerald-950/30 border-emerald-900/40"
      : "text-sky-300 bg-sky-950/30 border-sky-900/40";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${cls}`}>
      {failed ? <XCircle className="w-3 h-3" /> : delivered ? <CheckCircle2 className="w-3 h-3" /> : <CircleDashed className="w-3 h-3" />}
      {status}
    </span>
  );
}

function SentimentBadge({ s }: { s: Sentiment }) {
  if (s === "positive")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border text-emerald-300 bg-emerald-950/30 border-emerald-900/40"><ThumbsUp className="w-3 h-3" />Positif</span>;
  if (s === "negative")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border text-rose-300 bg-rose-950/40 border-rose-900/50"><ThumbsDown className="w-3 h-3" />Négatif</span>;
  if (s === "neutral")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border text-neutral-300 bg-neutral-800/40 border-neutral-700/50"><Minus className="w-3 h-3" />Neutre</span>;
  return <span className="text-[11px] text-amber-300/80">à classer</span>;
}

/* ── Carte stat ───────────────────────────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function SmsPage() {
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [classifying, setClassifying] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setError("Supabase non configuré.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [{ data: sms, error: e1 }, { data: pros }] = await Promise.all([
      supabase
        .from("sms_messages")
        .select("id, prospect_id, direction, to_phone, from_phone, body, segments, status, sentiment, sentiment_source, sent_at")
        .order("sent_at", { ascending: false })
        .limit(5000),
      supabase.from("prospects").select("id, name"),
    ]);
    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }
    setRows((sms ?? []) as SmsRow[]);
    setNames(new Map((pros ?? []).map((p: { id: string; name: string }) => [p.id, p.name])));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Regroupe les messages par numéro de contact. */
  const convos = useMemo<Convo[]>(() => {
    const map = new Map<string, Convo>();
    for (const r of rows) {
      const phone = r.direction === "inbound" ? r.from_phone : r.to_phone;
      const key = normFr(phone);
      if (!key) continue;
      let c = map.get(key);
      if (!c) {
        c = { key, phone: key, prospectId: null, name: null, sent: [], replies: [], lastAt: "", lastStatus: null, sentiment: null, lastReply: null };
        map.set(key, c);
      }
      if (r.prospect_id && !c.prospectId) {
        c.prospectId = r.prospect_id;
        c.name = names.get(r.prospect_id) ?? null;
      }
      if (r.direction === "inbound") c.replies.push(r);
      else c.sent.push(r);
      if (!c.lastAt || (r.sent_at && r.sent_at > c.lastAt)) {
        c.lastAt = r.sent_at ?? c.lastAt;
        if (r.direction === "outbound") c.lastStatus = r.status;
      }
    }
    for (const c of map.values()) {
      c.replies.sort((a, b) => (a.sent_at ?? "").localeCompare(b.sent_at ?? ""));
      c.lastReply = c.replies[c.replies.length - 1] ?? null;
      c.sentiment = c.lastReply?.sentiment ?? null;
    }
    return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [rows, names]);

  const stats = useMemo(() => {
    let sent = 0, delivered = 0, failed = 0, replied = 0, positive = 0, negative = 0;
    for (const r of rows) {
      if (r.direction === "outbound") {
        sent++;
        if (r.status === "delivered") delivered++;
        if (r.status && FAILED.has(r.status)) failed++;
      }
    }
    for (const c of convos) {
      if (c.replies.length) replied++;
      if (c.sentiment === "positive") positive++;
      if (c.sentiment === "negative") negative++;
    }
    return { sent, delivered, failed, replied, positive, negative };
  }, [rows, convos]);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.direction === "inbound" && r.sentiment === null).length,
    [rows],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "replied": return convos.filter((c) => c.replies.length > 0);
      case "positive": return convos.filter((c) => c.sentiment === "positive");
      case "negative": return convos.filter((c) => c.sentiment === "negative");
      case "failed": return convos.filter((c) => c.lastStatus && FAILED.has(c.lastStatus));
      default: return convos;
    }
  }, [convos, filter]);

  const runClassify = useCallback(async () => {
    setClassifying(true);
    setInfo(null);
    try {
      const res = await fetch("/api/sms/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInfo(json.error || `Erreur ${res.status}`);
      } else {
        setInfo(`${json.classified} réponse(s) classée(s) — ${json.positive} positives, ${json.negative} négatives, ${json.neutral} neutres${json.ai ? " (IA)" : " (mots-clés)"}.`);
        await load();
      }
    } catch (e) {
      setInfo(e instanceof Error ? e.message : String(e));
    } finally {
      setClassifying(false);
    }
  }, [load]);

  /* Bascule manuelle du sentiment de la dernière réponse d'une conversation. */
  const setSentiment = useCallback(
    async (c: Convo, s: Sentiment) => {
      if (!c.lastReply) return;
      await supabase.from("sms_messages").update({ sentiment: s, sentiment_source: "manual" }).eq("id", c.lastReply.id);
      if (s === "negative" && c.prospectId) {
        await supabase.from("prospects").update({ status: "negative" }).eq("id", c.prospectId);
      }
      setRows((prev) => prev.map((r) => (r.id === c.lastReply!.id ? { ...r, sentiment: s, sentiment_source: "manual" } : r)));
    },
    [],
  );

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Tous", n: convos.length },
    { key: "replied", label: "Répondu", n: stats.replied },
    { key: "positive", label: "Positifs", n: stats.positive },
    { key: "negative", label: "Négatifs", n: stats.negative },
    { key: "failed", label: "Échecs", n: stats.failed },
  ];

  return (
    <main className="min-h-screen px-4 md:px-8 py-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-neutral-400 hover:text-neutral-100 transition" title="Retour">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-400" />
              Suivi SMS
            </h1>
            <p className="text-xs text-neutral-500">{convos.length} contacts · {stats.sent} SMS envoyés</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-neutral-400 hover:text-neutral-100 transition" title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={runClassify}
            disabled={classifying || pendingCount === 0}
            className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition shadow-lg shadow-violet-900/30"
          >
            {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Classer{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Stat label="Envoyés" value={stats.sent} accent="text-neutral-100" />
        <Stat label="Délivrés" value={stats.delivered} accent="text-emerald-300" />
        <Stat label="Échecs" value={stats.failed} accent="text-rose-300" />
        <Stat label="Répondu" value={stats.replied} accent="text-sky-300" />
        <Stat label="Positifs" value={stats.positive} accent="text-emerald-300" />
        <Stat label="Négatifs" value={stats.negative} accent="text-rose-300" />
      </div>

      {info && <div className="mb-3 text-xs px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20 text-violet-200">{info}</div>}
      {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg border border-rose-900/40 bg-rose-950/20 text-rose-200">{error}</div>}

      {/* Filtres */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              filter === f.key
                ? "border-violet-500/60 bg-violet-950/30 text-violet-200"
                : "border-[var(--color-border)] text-neutral-400 hover:text-neutral-200 hover:border-[var(--color-border-strong)]"
            }`}
          >
            {f.label} <span className="opacity-60">{f.n}</span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-neutral-500 text-sm">Aucun SMS pour ce filtre.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.prospectId ? (
                      <Link href={`/?focus=${c.prospectId}`} className="font-medium text-neutral-100 hover:text-violet-300 transition truncate">
                        {c.name || "Prospect"}
                      </Link>
                    ) : (
                      <span className="font-medium text-neutral-300">{prettyPhone(c.phone)}</span>
                    )}
                    {c.prospectId && <span className="text-xs text-neutral-500">{prettyPhone(c.phone)}</span>}
                    <StatusBadge status={c.lastStatus} />
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                    <Send className="w-3 h-3" /> {c.sent.length} envoyé{c.sent.length > 1 ? "s" : ""}
                    {c.replies.length > 0 && (<><Inbox className="w-3 h-3 ml-1" /> {c.replies.length} réponse{c.replies.length > 1 ? "s" : ""}</>)}
                    <span className="ml-1">· {fmtDate(c.lastAt)}</span>
                  </div>
                </div>

                {/* Sentiment + bascule manuelle (si réponse) */}
                {c.lastReply && (
                  <div className="flex items-center gap-1.5">
                    <SentimentBadge s={c.sentiment} />
                    <div className="flex items-center gap-0.5 ml-1">
                      <button onClick={() => setSentiment(c, "positive")} title="Marquer positif" className={`p-1 rounded ${c.sentiment === "positive" ? "text-emerald-300" : "text-neutral-600 hover:text-emerald-300"} transition`}><ThumbsUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setSentiment(c, "neutral")} title="Marquer neutre" className={`p-1 rounded ${c.sentiment === "neutral" ? "text-neutral-200" : "text-neutral-600 hover:text-neutral-200"} transition`}><Minus className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setSentiment(c, "negative")} title="Marquer négatif" className={`p-1 rounded ${c.sentiment === "negative" ? "text-rose-300" : "text-neutral-600 hover:text-rose-300"} transition`}><ThumbsDown className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dernière réponse */}
              {c.lastReply && (
                <div className="mt-2.5 pl-3 border-l-2 border-violet-800/40 text-sm text-neutral-200">
                  <span className="text-[11px] text-neutral-500 mr-2">Réponse :</span>
                  {c.lastReply.body}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
