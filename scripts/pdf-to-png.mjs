// Convertit un PDF en PNG (une image par page) pour vérifier visuellement le rendu.
// Usage : node scripts/pdf-to-png.mjs [fichier.pdf] [dossier-sortie]

import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const pdfPath = process.argv[2] ?? "projet-preview.pdf";
const outDir = process.argv[3] ?? ".preview";
mkdirSync(outDir, { recursive: true });

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
const stem = basename(pdfPath, ".pdf");

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale: 2 });
  const canvas = createCanvas(vp.width, vp.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  const out = join(outDir, `${stem}-p${i}.png`);
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(out);
}
