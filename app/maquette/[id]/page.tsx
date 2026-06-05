"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";
import ProTemplate from "../templates/ProTemplate";
import CorporateTemplate from "../templates/CorporateTemplate";
import MinimalTemplate from "../templates/MinimalTemplate";
import ElectricTemplate from "../templates/ElectricTemplate";
import ForestTemplate from "../templates/ForestTemplate";
import LuxeTemplate from "../templates/LuxeTemplate";
import TerraTemplate from "../templates/TerraTemplate";
import SalonTemplate from "../templates/SalonTemplate";
import type { TemplateProps } from "../templates/data";

const TEMPLATES = {
  pro: { label: "Pro", component: ProTemplate },
  corporate: { label: "Corporate", component: CorporateTemplate },
  minimal: { label: "Minimal", component: MinimalTemplate },
  electric: { label: "Electric", component: ElectricTemplate },
  forest: { label: "Forest", component: ForestTemplate },
  luxe: { label: "Luxe", component: LuxeTemplate },
  terra: { label: "Terra", component: TerraTemplate },
  salon: { label: "Salon", component: SalonTemplate },
} as const;

type TemplateKey = keyof typeof TEMPLATES;

export default function MaquettePage({ params }: { params: Promise<{ id: string }> }) {
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [prospect, setProspect] = useState<TemplateProps | null>(null);
  const [template, setTemplate] = useState<TemplateKey>("pro");
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setProspectId(p.id)).catch(() => {});
  }, [params]);

  useEffect(() => {
    if (!prospectId) return;

    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase
      .from("prospects")
      .select("name, metier, phone, ville, rating, reviews, address")
      .eq("id", prospectId)
      .single()
      .then(({ data }) => {
        if (data) setProspect(data as TemplateProps);
        setLoading(false);
      });
  }, [prospectId]);

  const capture = useCallback(async (mode: "full" | "hero") => {
    if (!contentRef.current) return;
    setCapturing(true);
    setToolbarHidden(true);

    // Wait for toolbar to hide
    await new Promise((r) => setTimeout(r, 100));

    try {
      const target = mode === "hero"
        ? (contentRef.current.querySelector("section") as HTMLElement) ?? contentRef.current
        : contentRef.current;

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1440,
        windowHeight: mode === "hero" ? 700 : undefined,
      });

      const link = document.createElement("a");
      const safeName = prospect?.name.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").replace(/\s+/g, "-").toLowerCase() ?? "maquette";
      link.download = `maquette-${safeName}-${mode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setToolbarHidden(false);
      setCapturing(false);
    }
  }, [prospect]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "system-ui", color: "#6b7280" }}>
        Chargement...
      </div>
    );
  }

  if (!prospect) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "system-ui", color: "#ef4444" }}>
        Prospect non trouvé
      </div>
    );
  }

  const TemplateComponent = TEMPLATES[template].component;

  return (
    <>
      {/* Floating toolbar */}
      {!toolbarHidden && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          background: "rgba(17,24,39,0.95)",
          backdropFilter: "blur(12px)",
          padding: "14px 20px",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontFamily: "system-ui",
          maxWidth: "95vw",
        }}>
          {/* Template selector row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, marginRight: 4 }}>Style :</span>
            {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setTemplate(k)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: template === k ? "#7c3aed" : "rgba(255,255,255,0.08)",
                  color: template === k ? "#fff" : "#d1d5db",
                  transition: "all 0.15s",
                }}
              >
                {TEMPLATES[k].label}
              </button>
            ))}
          </div>
          {/* Actions row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => capture("hero")}
              disabled={capturing}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: "1px solid rgba(124,58,237,0.5)",
                background: "rgba(124,58,237,0.15)",
                color: "#c4b5fd",
                fontSize: 12,
                fontWeight: 600,
                cursor: capturing ? "wait" : "pointer",
              }}
            >
              Hero
            </button>
            <button
              onClick={() => capture("full")}
              disabled={capturing}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: capturing ? "wait" : "pointer",
              }}
            >
              Page complete
            </button>
          </div>
        </div>
      )}

      {/* Template render */}
      <div ref={contentRef}>
        <TemplateComponent {...prospect} />
      </div>
    </>
  );
}
