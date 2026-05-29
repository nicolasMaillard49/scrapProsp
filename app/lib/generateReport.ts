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
}

export async function generateProspectReport(data: ReportData) {
  // Lazy imports — @react-pdf/renderer is heavy, only load when needed
  const [{ pdf }, { ReportPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../components/pdf/ReportPDF"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(ReportPDF, { data }) as any;
  const blob = await pdf(doc).toBlob();

  // Programmatic download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = data.prospectName
    .replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  link.href = url;
  link.download = `devis-${safeName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
