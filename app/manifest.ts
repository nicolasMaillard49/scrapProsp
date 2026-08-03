import type { MetadataRoute } from "next";

/**
 * Manifeste PWA — servi sur /manifest.webmanifest.
 *
 * À ne pas confondre avec `public/manifest.json`, qui est un fichier de
 * DONNÉES (la liste des régions et leurs CSV) et n'a rien d'un manifeste web.
 * Les deux chemins cohabitent sans se marcher dessus.
 *
 * `short_name` est le libellé affiché sous l'icône une fois l'app ajoutée à
 * l'écran d'accueil : « Prospects Tracker » y serait tronqué.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prospects Tracker",
    short_name: "Prospects",
    description: "Suivi des appels de prospection",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0D14",
    theme_color: "#0B0D14",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
