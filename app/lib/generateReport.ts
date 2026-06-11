"use client";

import React from "react";
import type { CompetitorReport } from "./types";

export interface ReportData {
  report: CompetitorReport;
  prospectName: string;
  prospectRating: number | null;
  prospectReviews: number | null;
  prospectScore: number;
  prospectRank: number;
  /** UUID du prospect — active le QR code vers sa démo live dans le PDF. */
  prospectId?: string;
}

export interface DemoQr {
  url: string;
  /** Data URL PNG du QR code. */
  qr: string;
}

/** Charge un asset de public/ en data URL (les images du PDF doivent être embarquées). */
async function assetToDataUrl(path: string): Promise<string | undefined> {
  try {
    const res = await fetch(path);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function generateProspectReport(data: ReportData) {
  // Lazy imports — @react-pdf/renderer is heavy, only load when needed
  const [{ pdf }, { ReportPDF }, { pdfThemeFor }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../components/pdf/ReportPDF"),
    import("../components/pdf/pdf-theme"),
  ]);

  // Photos du thème métier (plombier : héro, vague, salle de bain)
  const theme = pdfThemeFor(data.report.metier);
  const [hero, wave, side] = await Promise.all(
    [theme.heroImage, theme.waveImage, theme.sideImage].map((p) => (p ? assetToDataUrl(p) : Promise.resolve(undefined))),
  );
  const assets = { hero, wave, side };

  // QR vers la démo live : le prospect scanne le PDF et voit SON site.
  let demo: DemoQr | null = null;
  if (data.prospectId) {
    try {
      const [{ default: QRCode }, { demoUrl }] = await Promise.all([
        import("qrcode"),
        import("./links"),
      ]);
      const url = demoUrl(data.prospectId);
      const qr = await QRCode.toDataURL(url, {
        width: 260,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#0f0e24", light: "#ffffff" },
      });
      demo = { url, qr };
    } catch {
      demo = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(ReportPDF, { data, demo, assets }) as any;
  const blob = await pdf(doc).toBlob();

  // Programmatic download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = data.prospectName
    .replace(/[^a-zA-Z0-9À-ſ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  link.href = url;
  link.download = `projet-${safeName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
