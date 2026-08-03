// Régénère toutes les icônes depuis app/icon.svg, seule source de vérité.
//
//   node scripts/build-icons.mjs
//
// Produit :
//   app/apple-icon.png        180  → <link rel="apple-touch-icon"> (Next.js).
//                                    SANS ce fichier, l'ajout à l'écran
//                                    d'accueil iPhone retombe sur la première
//                                    lettre du titre — le fameux « P ».
//   public/icon-192.png       192  ┐ référencés par le manifeste PWA
//   public/icon-512.png       512  ┘ (app/manifest.ts)
//   extension/icons/icon-*.png      16 / 32 / 48 / 128, barre d'outils Chrome.

import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "app/icon.svg"));

// density élevée : le rendu part d'un raster large puis réduit, sinon les
// courbes de la marque crénellent aux petites tailles.
const png = (size, out) =>
  sharp(svg, { density: 1200 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(root, out))
    .then(() => console.log(`  ${out.padEnd(34)} ${size}×${size}`));

console.log("Icônes régénérées depuis app/icon.svg :");
await Promise.all([
  png(180, "app/apple-icon.png"),
  png(192, "public/icon-192.png"),
  png(512, "public/icon-512.png"),
  png(16, "extension/icons/icon-16.png"),
  png(32, "extension/icons/icon-32.png"),
  png(48, "extension/icons/icon-48.png"),
  png(128, "extension/icons/icon-128.png"),
]);
