"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Circle, CircleMarker } from "leaflet";

/**
 * Carte interactive « ville + rayon » (façon Lokads).
 * Géocode la ville via la BAN (api-adresse.data.gouv.fr, gratuit), affiche un
 * cercle dont le rayon suit le slider, et recadre la vue sur ce cercle.
 * Tuiles CARTO « light » (gratuites, rendu épuré). Leaflet chargé côté client.
 */
export default function MapRadius({ ville, radiusKm }: { ville: string; radiusKm: number }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);

  // Géocodage de la ville (debounce léger).
  useEffect(() => {
    if (!ville || ville.trim().length < 2) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&type=municipality&limit=1`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const f = d?.features?.[0];
          if (f) setCenter([f.geometry.coordinates[1], f.geometry.coordinates[0]]);
          setLoading(false);
        })
        .catch(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ville]);

  // Création / mise à jour de la carte.
  useEffect(() => {
    if (!center || !elRef.current) return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed) return;
      let map = mapRef.current;
      if (!map) {
        map = L.map(elRef.current!, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          touchZoom: false,
          keyboard: false,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
        // Vue initiale valide AVANT toute chose → les tuiles commencent à charger.
        map.setView(center, 11);
        mapRef.current = map;
      }
      const accent = "#ff6e00";
      const r = Math.max(radiusKm, 1) * 1000;
      if (!circleRef.current) {
        circleRef.current = L.circle(center, { radius: r, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.12 }).addTo(map);
        markerRef.current = L.circleMarker(center, { radius: 6, color: "#fff", weight: 2, fillColor: accent, fillOpacity: 1 }).addTo(map);
      } else {
        circleRef.current.setLatLng(center).setRadius(r);
        markerRef.current?.setLatLng(center);
      }
      // Recadre sur le cercle APRÈS avoir corrigé la taille du conteneur.
      map.invalidateSize();
      map.fitBounds(circleRef.current.getBounds(), { padding: [26, 26], maxZoom: 13, animate: false });
      setTimeout(() => {
        map?.invalidateSize();
        if (circleRef.current) map?.fitBounds(circleRef.current.getBounds(), { padding: [26, 26], maxZoom: 13, animate: false });
      }, 120);
    })();
    return () => {
      disposed = true;
    };
  }, [center, radiusKm]);

  // Nettoyage au démontage.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <div className="fnl-map">
      {loading && <div className="fnl-map-loading">···</div>}
      <div ref={elRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
