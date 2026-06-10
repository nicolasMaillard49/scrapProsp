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

export async function generateProspectReport(data: ReportData) {
  // Lazy imports — @react-pdf/renderer is heavy, only load when needed
  const [{ pdf }, { ReportPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../components/pdf/ReportPDF"),
  ]);

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
  const doc = React.createElement(ReportPDF, { data, demo }) as any;
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
