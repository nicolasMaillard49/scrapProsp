"use client";

import { useEffect, useRef, useState } from "react";
import { TEMPLATES, type TemplateKey } from "@/app/lib/demoTemplate";
import type { TemplateProps } from "@/app/maquette/templates/data";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

interface Props {
  prospect: TemplateProps;
  prospectId: string;
  initialStyle: TemplateKey;
  initialExpiresAt: string | null;
  /** Stripe Payment Link complet (avec client_reference_id) — null si non configuré. */
  stripeUrl: string | null;
}

/** Payload des commandes envoyées par LiveRemote (CRM) pendant l'appel. */
export interface RemoteCommand {
  action: "style" | "goto" | "ping";
  value?: string;
}

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

function track(payload: Record<string, unknown>, beacon = false): Promise<Response> | void {
  const body = JSON.stringify(payload);
  if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/demo/track", body);
    return;
  }
  return fetch("/api/demo/track", { method: "POST", body, keepalive: true });
}

function fmtRemaining(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (d > 0) return `${d}j ${h}h ${m}min`;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  return `${m}min ${s}s`;
}

/**
 * Enveloppe cliente des démos publiques :
 *  - tracking vues + durée (heartbeat) -> /api/demo/track (notif Telegram côté serveur)
 *  - compte à rebours d'expiration (le chrono démarre à la 1re ouverture)
 *  - télécommande live : reçoit les commandes Realtime du CRM (changement de
 *    template, scroll vers une section, ping) pendant l'appel + presence
 *  - CTA « Je le veux » -> Stripe Payment Link (paiement en totalité)
 */
export default function DemoLive({ prospect, prospectId, initialStyle, initialExpiresAt, stripeUrl }: Props) {
  const [styleKey, setStyleKey] = useState<TemplateKey>(initialStyle);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [now, setNow] = useState(() => Date.now());
  const [pinged, setPinged] = useState(false);
  const sessionRef = useRef<string>("");
  const secondsRef = useRef(0);

  // ── Tracking : vue à l'ouverture, heartbeat (durée), beacon à la fermeture ──
  useEffect(() => {
    sessionRef.current = newSessionId();
    const p = track({ id: prospectId, session: sessionRef.current, event: "view" });
    p?.then((r) => r.json())
      .then((j) => { if (j?.expiresAt) setExpiresAt(j.expiresAt); })
      .catch(() => {});

    const tick = setInterval(() => {
      if (document.visibilityState === "visible") secondsRef.current += 1;
    }, 1000);
    const heartbeat = setInterval(() => {
      track({ id: prospectId, session: sessionRef.current, event: "heartbeat", seconds: secondsRef.current });
    }, 15_000);
    const onHide = () => {
      track({ id: prospectId, session: sessionRef.current, event: "heartbeat", seconds: secondsRef.current }, true);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", onHide);
    };
  }, [prospectId]);

  // ── Télécommande live (Supabase Realtime broadcast + presence) ──
  useEffect(() => {
    if (!supabaseConfigured) return;
    const channel = supabase.channel(`demo-${prospectId}`, {
      config: { presence: { key: "prospect" } },
    });
    channel.on("broadcast", { event: "remote" }, ({ payload }) => {
      const cmd = payload as RemoteCommand;
      if (cmd.action === "style" && cmd.value && cmd.value in TEMPLATES) {
        setStyleKey(cmd.value as TemplateKey);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (cmd.action === "goto" && cmd.value) {
        document.getElementById(cmd.value)?.scrollIntoView({ behavior: "smooth" });
      } else if (cmd.action === "ping") {
        setPinged(true);
        setTimeout(() => setPinged(false), 2200);
      }
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") channel.track({ online_at: new Date().toISOString() });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [prospectId]);

  // ── Compte à rebours ──
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiryMs = expiresAt ? new Date(expiresAt).getTime() - now : null;
  const expired = expiryMs != null && expiryMs <= 0;
  const urgent = expiryMs != null && expiryMs < 24 * 3600 * 1000;
  const nmfPhone = process.env.NEXT_PUBLIC_NMF_PHONE;

  const Template = TEMPLATES[styleKey];

  const onCta = () => {
    if (!stripeUrl) return;
    track({ id: prospectId, session: sessionRef.current, event: "cta" }, true);
    window.location.href = stripeUrl;
  };

  return (
    <>
      <div style={expired ? { filter: "blur(8px)", pointerEvents: "none", userSelect: "none", height: "100vh", overflow: "hidden" } : undefined}>
        <Template {...prospect} nmfCredit />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes demo-live-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes demo-live-pop { 0% { transform: scale(0.2); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        @media (max-width: 640px) { .demo-countdown { top: auto !important; bottom: 70px !important; right: 12px !important; font-size: 11px !important; } }
      `}} />

      {/* ── Compte à rebours d'expiration ── */}
      {!expired && expiryMs != null && (
        <div className="demo-countdown" style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 70,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${urgent ? "rgba(248,113,113,0.7)" : "rgba(167,139,250,0.4)"}`,
          borderRadius: 999,
          padding: "8px 16px",
          fontFamily: "'Space Mono', monospace",
          fontSize: 12,
          color: urgent ? "#fca5a5" : "rgba(255,255,255,0.85)",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", display: "inline-block",
            background: urgent ? "#f87171" : "#a78bfa",
            animation: "demo-live-pulse 1.2s ease-in-out infinite",
          }} />
          Démo en ligne encore {fmtRemaining(expiryMs)}
        </div>
      )}

      {/* ── CTA « Je le veux » -> Stripe ── */}
      {!expired && stripeUrl && (
        <button onClick={onCta} style={{
          position: "fixed",
          bottom: 18,
          right: 18,
          zIndex: 70,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "linear-gradient(120deg, #7c3aed, #c026d3)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "14px 24px",
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          cursor: "pointer",
          boxShadow: "0 8px 32px rgba(124,58,237,0.5)",
        }}>
          🚀 Je veux ce site
        </button>
      )}

      {/* ── Ping « regardez l'écran » envoyé depuis le CRM pendant l'appel ── */}
      {pinged && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 120, animation: "demo-live-pop 2.2s ease-out forwards" }}>✨</div>
        </div>
      )}

      {/* ── Démo expirée ── */}
      {expired && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(5,5,8,0.82)",
        }}>
          <div style={{
            textAlign: "center",
            maxWidth: 460,
            padding: "48px 32px",
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Cette démo a expiré</div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
              La démo de <strong>{prospect.name}</strong> n&apos;est plus en ligne.
              Bonne nouvelle : elle peut être réactivée (et publiée pour de vrai) en un appel.
            </p>
            {nmfPhone && (
              <a href={`tel:${nmfPhone.replace(/\s/g, "")}`} style={{
                display: "inline-block",
                background: "linear-gradient(120deg, #7c3aed, #c026d3)",
                color: "#fff",
                fontWeight: 700,
                padding: "14px 32px",
                borderRadius: 999,
                textDecoration: "none",
                fontSize: 17,
              }}>
                📞 NMF Agence — {nmfPhone}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
