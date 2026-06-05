"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import { instagramDmMsg } from "@/app/lib/instagram";
import { shortCode } from "@/app/lib/links";

interface IgLead {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  external_url: string | null;
  followers: number | null;
  category: string | null;
  metier: string | null;
  ville: string | null;
  booking_platform: string | null;
  hashtag_source: string | null;
  status: string;
  notes: string;
  discovered_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "À contacter",
  contacted: "Contacté",
  positive: "Positif",
  negative: "Négatif",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "#6b7280",
  contacted: "#2563eb",
  positive: "#16a34a",
  negative: "#dc2626",
};

export default function InstagramPage() {
  const [hashtag, setHashtag] = useState("");
  const [target, setTarget] = useState(100);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [leads, setLeads] = useState<IgLead[]>([]);
  const [filter, setFilter] = useState<string>("todo");
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadLeads = useCallback(async () => {
    if (!supabaseConfigured) return;
    const { data } = await supabase
      .from("instagram_prospects")
      .select("*")
      .order("discovered_at", { ascending: false })
      .limit(1000);
    setLeads((data ?? []) as IgLead[]);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const runDiscover = useCallback(async () => {
    const tag = hashtag.replace(/^#/, "").trim();
    if (!tag) {
      setMsg("Entre un hashtag (ex. coiffeurbordeaux).");
      return;
    }
    setLoading(true);
    setMsg("Recherche en cours… (Apify, ça peut prendre 1-3 min)");
    try {
      const res = await fetch("/api/instagram/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtag: tag, target }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`Erreur : ${json.error ?? res.status}`);
      } else {
        setMsg(
          `✓ ${json.inserted} nouveaux leads (${json.qualified} sans site sur ${json.scanned} comptes scannés)` +
            (json.capHit ? " — plafond atteint." : "") +
            (json.note ? ` ${json.note}` : ""),
        );
        await loadLeads();
      }
    } catch (e) {
      setMsg(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [hashtag, target, loadLeads]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch(`/api/instagram/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }, []);

  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }, []);

  const shown = useMemo(() => leads.filter((l) => filter === "all" || l.status === filter), [leads, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, todo: 0, contacted: 0, positive: 0, negative: 0 };
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Prospection Instagram</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", fontSize: 14 }}>
        Découvre des comptes pros <strong>sans site web</strong> par hashtag. Les messages sont prêts — tu les envoies à la main.
      </p>

      {/* Barre de recherche */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ flex: "1 1 240px" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Hashtag</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", padding: "0 10px" }}>
            <span style={{ color: "#9ca3af" }}>#</span>
            <input
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && runDiscover()}
              placeholder="coiffeurbordeaux"
              style={{ flex: 1, border: "none", outline: "none", padding: "10px 6px", fontSize: 15 }}
            />
          </div>
        </div>
        <div style={{ width: 110 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Cible</label>
          <input
            type="number"
            min={1}
            max={300}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px", fontSize: 15, boxSizing: "border-box" }}
          />
        </div>
        <button
          onClick={runDiscover}
          disabled={loading}
          style={{ background: loading ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "Recherche…" : "Lancer la recherche"}
        </button>
      </div>

      {msg && (
        <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3", borderRadius: 8, padding: "10px 14px", fontSize: 14, marginBottom: 20 }}>{msg}</div>
      )}

      {/* Filtres statut */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {(["todo", "contacted", "positive", "negative", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              border: "1px solid", borderColor: filter === s ? "#7c3aed" : "#e5e7eb",
              background: filter === s ? "#7c3aed" : "#fff", color: filter === s ? "#fff" : "#374151",
              borderRadius: 999, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {s === "all" ? "Tous" : STATUS_LABEL[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Liste leads */}
      {shown.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "60px 0", border: "1px dashed #e5e7eb", borderRadius: 12 }}>
          Aucun lead. Lance une recherche par hashtag ci-dessus.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {shown.map((l) => {
            const link = origin ? `${origin}/di/${shortCode(l.id)}` : "";
            const dm = instagramDmMsg({ metier: l.metier ?? "", ville: l.ville ?? "", bookingPlatform: l.booking_platform }, link);
            return (
              <div key={l.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  <div>
                    <a href={`https://instagram.com/${l.username}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 16, color: "#7c3aed", textDecoration: "none" }}>
                      @{l.username}
                    </a>
                    <span style={{ color: "#6b7280", fontSize: 14, marginLeft: 8 }}>{l.full_name}</span>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      {l.followers != null ? `${l.followers.toLocaleString("fr-FR")} abonnés` : "—"}
                      {l.category ? ` · ${l.category}` : ""}
                      {l.metier ? ` · ${l.metier}` : ""}
                      {l.ville ? ` · ${l.ville}` : ""}
                      {l.booking_platform && <span style={{ color: "#d97706", fontWeight: 600 }}> · {l.booking_platform}</span>}
                      {l.hashtag_source ? ` · #${l.hashtag_source}` : ""}
                    </div>
                  </div>
                  <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, color: STATUS_COLOR[l.status], border: `1px solid ${STATUS_COLOR[l.status]}`, borderRadius: 999, padding: "2px 10px" }}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </div>

                {l.bio && <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 12px", whiteSpace: "pre-line" }}>{l.bio}</p>}

                {/* Messages */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {([["Avec lien", dm.withLink, `${l.id}-w`], ["Sans lien (tease)", dm.tease, `${l.id}-t`]] as const).map(([title, text, key]) => (
                    <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#f9fafb" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
                        <button onClick={() => copy(key, text)} style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", background: "none", border: "none", cursor: "pointer" }}>
                          {copied === key ? "✓ Copié" : "Copier"}
                        </button>
                      </div>
                      <p style={{ fontSize: 12.5, color: "#374151", margin: 0, whiteSpace: "pre-line", lineHeight: 1.5 }}>{text}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <a href={`https://instagram.com/${l.username}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, background: "#111827", color: "#fff", borderRadius: 8, padding: "7px 14px", textDecoration: "none" }}>
                    Ouvrir le DM →
                  </a>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: 8, padding: "7px 14px", textDecoration: "none" }}>
                      Voir l&apos;aperçu
                    </a>
                  )}
                  <span style={{ flex: 1 }} />
                  {(["contacted", "positive", "negative"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(l.id, s)}
                      style={{ fontSize: 12, fontWeight: 600, border: `1px solid ${STATUS_COLOR[s]}`, background: l.status === s ? STATUS_COLOR[s] : "#fff", color: l.status === s ? "#fff" : STATUS_COLOR[s], borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
