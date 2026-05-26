"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";
import ProTemplate from "../templates/ProTemplate";
import CorporateTemplate from "../templates/CorporateTemplate";
import type { TemplateProps } from "../templates/data";

const TEMPLATES = {
  pro: { label: "Pro (JT Plomberie)", component: ProTemplate },
  corporate: { label: "Corporate (EP Renov)", component: CorporateTemplate },
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
    params.then((p) => setProspectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!prospectId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setLoading(false);
      return;
    }

    const supabase = createClient(url, key);
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
          alignItems: "center",
          gap: 12,
          background: "rgba(17,24,39,0.95)",
          backdropFilter: "blur(12px)",
          padding: "12px 20px",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontFamily: "system-ui",
        }}>
          <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>Template :</span>
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTemplate(k)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: template === k ? "#7c3aed" : "rgba(255,255,255,0.08)",
                color: template === k ? "#fff" : "#d1d5db",
              }}
            >
              {TEMPLATES[k].label}
            </button>
          ))}

          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />

          <button
            onClick={() => capture("hero")}
            disabled={capturing}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(124,58,237,0.5)",
              background: "rgba(124,58,237,0.15)",
              color: "#c4b5fd",
              fontSize: 13,
              fontWeight: 600,
              cursor: capturing ? "wait" : "pointer",
            }}
          >
            📷 Hero
          </button>
          <button
            onClick={() => capture("full")}
            disabled={capturing}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#7c3aed",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: capturing ? "wait" : "pointer",
            }}
          >
            📸 Page complète
          </button>
        </div>
      )}

      {/* Template render */}
      <div ref={contentRef}>
        <TemplateComponent {...prospect} />
      </div>
    </>
  );
}
