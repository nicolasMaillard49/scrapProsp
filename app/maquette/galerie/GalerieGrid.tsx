"use client";

import { useState } from "react";
import type { Family, ShowcaseEntry } from "../templates/showcase";

/* ──────────────────────────────────────────────────────────────
 * Planche de contact des maquettes.
 *
 * Chaque vignette est la VRAIE maquette dans une iframe, pas une capture :
 * une maquette modifiée se voit ici au rechargement, sans regénérer d'image.
 * Les iframes isolent aussi les <style> globaux que chaque maquette injecte —
 * quinze d'entre eux dans le même document se marcheraient dessus.
 *
 * L'iframe se déplace au survol (translateY) : ça donne le bas de page sans
 * avoir à ouvrir la maquette, notamment le bloc d'offre et son prix.
 * ────────────────────────────────────────────────────────────── */

interface Device {
  frameW: number;
  frameH: number;
  shotW: number;
  shotH: number;
  /** Déplacement au survol, en pixels de la page (avant mise à l'échelle). */
  shift: number;
}

const DEVICES: Record<"desktop" | "mobile", Device> = {
  desktop: { frameW: 1440, frameH: 5200, shotW: 440, shotH: 580, shift: -2200 },
  mobile: { frameW: 420, frameH: 7200, shotW: 250, shotH: 580, shift: -2600 },
};

const FAMILY_LABEL: Record<Family, string> = {
  niche: "Niche",
  artisan: "Artisan",
  sante: "Libéral",
  editorial: "Éditorial",
};

const FAMILY_COLOR: Record<Family, string> = {
  niche: "#a78bfa",
  artisan: "#38bdf8",
  sante: "#34d399",
  editorial: "#fbbf24",
};

type Filter = "all" | Family;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "niche", label: "Niches Instagram" },
  { key: "artisan", label: "Artisans" },
  { key: "sante", label: "Libérales" },
  { key: "editorial", label: "Éditorial" },
];

export default function GalerieGrid({ entries }: { entries: ShowcaseEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const d = DEVICES[device];
  const scale = d.shotW / d.frameW;
  const shown = filter === "all" ? entries : entries.filter((e) => e.family === filter);

  return (
    <div style={{ background: "#0b0f19", minHeight: "100vh", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
      {/* L'échelle et le déplacement dépendent de l'écran choisi : ils vivent
          donc ici, en CSS, et non en style inline — un transform inline
          l'emporterait sur la règle :hover et la vignette resterait figée. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .shot iframe { transform: scale(${scale}); transform-origin: top left; transition: transform 5s ease-in-out; }
        .card:hover .shot iframe { transform: scale(${scale}) translateY(${d.shift}px); transition-duration: 7s; }
        .card { transition: border-color .15s, transform .15s; }
        .card:hover { border-color: rgba(167,139,250,.55); transform: translateY(-2px); }
        .chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; line-height:18px; }
      `,
        }}
      />

      {/* En-tête */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(11,15,25,0.92)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "18px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>
            Les maquettes
          </h1>
          <span style={{ color: "#9ca3af", fontSize: 13 }}>
            {entries.length} directions artistiques — ce qu'on peut montrer à un prospect selon son métier
          </span>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filter === f.key ? "#7c3aed" : "rgba(255,255,255,0.07)",
                  color: filter === f.key ? "#fff" : "#d1d5db",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "#6b7280", fontSize: 12 }}>Écran :</span>
            {(["desktop", "mobile"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setDevice(k)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: device === k ? "rgba(124,58,237,0.25)" : "transparent",
                  color: device === k ? "#c4b5fd" : "#9ca3af",
                }}
              >
                {k === "desktop" ? "Bureau 1440" : "Mobile 420"}
              </button>
            ))}
          </div>

          <span style={{ color: "#6b7280", fontSize: 12, marginLeft: "auto" }}>
            Survolez une vignette pour dérouler la page
          </span>
        </div>
      </header>

      {/* Grille */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 22,
          padding: "26px 28px 60px",
          alignItems: "flex-start",
        }}
      >
        {shown.map((e) => (
          <article
            key={e.key}
            className="card"
            style={{
              width: d.shotW,
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* Vignette */}
            <a
              href={`/maquette/apercu/${e.key}`}
              target="_blank"
              rel="noreferrer"
              className="shot"
              style={{
                display: "block",
                position: "relative",
                width: d.shotW,
                height: d.shotH,
                overflow: "hidden",
                background: "#fff",
                borderBottom: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <iframe
                src={`/maquette/apercu/${e.key}`}
                title={`Maquette ${e.label}`}
                loading="lazy"
                scrolling="no"
                style={{
                  width: d.frameW,
                  height: d.frameH,
                  border: 0,
                  // Sans ça l'iframe avalerait le survol et le clic : c'est le
                  // lien parent qui doit les recevoir.
                  pointerEvents: "none",
                }}
              />
            </a>

            {/* Fiche */}
            <div style={{ padding: "12px 14px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{e.label}</span>
                <span
                  className="chip"
                  style={{
                    background: `${FAMILY_COLOR[e.family]}22`,
                    color: FAMILY_COLOR[e.family],
                    border: `1px solid ${FAMILY_COLOR[e.family]}44`,
                  }}
                >
                  {FAMILY_LABEL[e.family]}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: e.price === 500 ? "#34d399" : "#e5e7eb" }}>
                  {e.price ? `${e.price} € HT` : "selon métier"}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 6 }}>
                « {e.da} » — {e.palette}
              </div>

              <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.5, color: "#9ca3af" }}>{e.pitch}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                {e.metiers.length === 0 ? (
                  <span className="chip" style={{ background: "rgba(255,255,255,0.05)", color: "#6b7280" }}>
                    aucun métier routé automatiquement
                  </span>
                ) : (
                  e.metiers.map((m) => (
                    <span key={m} className="chip" style={{ background: "rgba(255,255,255,0.06)", color: "#d1d5db" }}>
                      {m}
                    </span>
                  ))
                )}
              </div>

              {e.aliases && (
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                  Reconnaît aussi : {e.aliases}
                </div>
              )}

              {!e.ownContent && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#fca5a5",
                    background: "rgba(239,68,68,0.09)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 7,
                    padding: "6px 8px",
                    marginBottom: 8,
                  }}
                >
                  Contenu générique : ce métier n'a pas ses prestations, la page affiche celles du plombier.
                </div>
              )}

              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <a
                  href={`/maquette/apercu/${e.key}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#c4b5fd", textDecoration: "none", fontWeight: 600 }}
                >
                  Ouvrir ↗
                </a>
                <span style={{ color: "#374151" }}>·</span>
                <span style={{ color: "#6b7280" }}>
                  {e.demo.name} — {e.demo.ville}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
