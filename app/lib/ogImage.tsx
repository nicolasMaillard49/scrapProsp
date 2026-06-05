import { ImageResponse } from "next/og";
import { metierLabel } from "@/app/maquette/templates/data";
import type { TemplateProps } from "@/app/maquette/templates/data";

/** Dimensions standard d'une OG image (carte de partage WhatsApp / social). */
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "Aperçu de site web — NMF Agence";

/**
 * Génère l'OG image personnalisée d'une démo (nom + métier + ville aux couleurs
 * NMF). Affichée en carte de partage sur WhatsApp, iMessage partagé, réseaux.
 * Satori (next/og) : uniquement du flex, pas de grid.
 */
export function renderOgImage(prospect: TemplateProps | null) {
  const name = prospect?.name ?? "Votre entreprise";
  const label = prospect ? metierLabel(prospect.metier) : "Artisan";
  const ville = prospect?.ville ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0c 0%, #1b1030 60%, #2a1247 100%)",
          color: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        {/* En-tête marque */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#a78bfa" }}>NMF Agence</div>
          <div style={{ display: "flex", fontSize: 24, color: "#9ca3af", marginLeft: 16 }}>· aperçu de votre futur site</div>
        </div>

        {/* Nom + métier/ville */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: "flex", fontSize: 40, color: "#c4b5fd", marginTop: 18 }}>
            {ville ? `${label} · ${ville}` : label}
          </div>
        </div>

        {/* Badge confiance */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              background: "#22c55e",
              color: "#04130a",
              padding: "10px 24px",
              borderRadius: 10,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Gratuit · sans engagement
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#e5e7eb", marginLeft: 20 }}>
            Découvrez votre site →
          </div>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
