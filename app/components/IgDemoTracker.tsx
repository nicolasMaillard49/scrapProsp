"use client";

import { useEffect, useRef } from "react";

/**
 * Traceur des maquettes Instagram — n'affiche RIEN.
 *
 * Volontairement bien plus maigre que `DemoLive` : ni compte à rebours, ni
 * télécommande Realtime, ni CTA Stripe. Une maquette Instagram se montre, elle
 * ne se vend pas toute seule — et surtout, elle est envoyée en DM au 3ᵉ
 * message : tout ce qui ressemble à une page de vente la ferait fermer.
 *
 * Une session = une ouverture. Le heartbeat fait monter la durée, qui est la
 * moitié du signal : ouvrir trois secondes et rester deux minutes ne disent
 * pas la même chose.
 */
export default function IgDemoTracker({ prospectId }: { prospectId: string }) {
  const started = useRef(false);

  useEffect(() => {
    // React 18 monte deux fois en dev (StrictMode) : sans cette garde, chaque
    // ouverture compterait double et déclencherait deux notifications.
    if (started.current) return;
    started.current = true;

    const session = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      }
    })();

    const t0 = Date.now();
    const post = (payload: Record<string, unknown>, beacon = false) => {
      const body = JSON.stringify({ id: prospectId, session, ...payload });
      if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/instagram/demo-view", body);
        return;
      }
      void fetch("/api/instagram/demo-view", { method: "POST", body, keepalive: true }).catch(() => {});
    };

    post({ event: "view" });

    const beat = setInterval(() => {
      // Onglet en arrière-plan : il ne le REGARDE pas. Compter ce temps
      // gonflerait le seul chiffre qui dit s'il s'y est intéressé.
      if (document.visibilityState !== "visible") return;
      post({ event: "heartbeat", seconds: Math.round((Date.now() - t0) / 1000) });
    }, 15_000);

    // Fermeture : `sendBeacon` est le seul envoi qui survit à la page.
    const bye = () => post({ event: "heartbeat", seconds: Math.round((Date.now() - t0) / 1000) }, true);
    window.addEventListener("pagehide", bye);

    return () => {
      clearInterval(beat);
      window.removeEventListener("pagehide", bye);
    };
  }, [prospectId]);

  return null;
}
