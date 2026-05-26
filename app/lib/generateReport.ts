"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompetitorReport } from "./types";
import { generateSalesArgs } from "./gbp";

interface ReportData {
  report: CompetitorReport;
  prospectName: string;
  prospectRating: number | null;
  prospectReviews: number | null;
  prospectScore: number;
  prospectRank: number;
}

export function generateProspectReport(data: ReportData) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const doc = new jsPDF();

  // --- Header ---
  doc.setFillColor(30, 27, 75); // dark purple
  doc.rect(0, 0, 210, 45, "F");

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Analyse Concurrentielle Locale", 105, 18, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(200, 180, 255);
  doc.text(prospectName, 105, 28, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(180, 180, 220);
  doc.text(
    `${report.metier} — ${report.ville} — ${new Date(report.created_at).toLocaleDateString("fr-FR")}`,
    105,
    37,
    { align: "center" },
  );

  // --- Score summary ---
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text("Votre positionnement", 20, 55);

  doc.setFontSize(28);
  doc.setTextColor(
    prospectRank <= 3 ? 16 : prospectRank <= 7 ? 180 : 220,
    prospectRank <= 3 ? 185 : prospectRank <= 7 ? 130 : 60,
    prospectRank <= 3 ? 129 : prospectRank <= 7 ? 0 : 60,
  );
  doc.text(`#${prospectRank}`, 20, 70);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `sur ${report.competitors.length} concurrents — Score GBP : ${prospectScore}/100`,
    42,
    70,
  );

  // --- Ranking table ---
  const merged = [...report.competitors];
  const isInList = merged.some(
    (c) => c.name.toLowerCase() === prospectName.toLowerCase(),
  );
  if (!isInList) {
    merged.push({
      name: prospectName,
      rating: data.prospectRating,
      reviews: data.prospectReviews,
      address: null,
      phone: null,
      website: null,
      maps_url: null,
      category: null,
      gbp_score: prospectScore,
    });
  }
  merged.sort((a, b) => b.gbp_score - a.gbp_score);

  autoTable(doc, {
    startY: 80,
    head: [["Rang", "Nom", "Note", "Avis", "Site", "Score"]],
    body: merged.map((c, i) => [
      `#${i + 1}`,
      c.name + (c.name.toLowerCase() === prospectName.toLowerCase() ? " (VOUS)" : ""),
      c.rating != null ? String(c.rating) : "—",
      c.reviews != null ? String(c.reviews) : "0",
      c.website ? "Oui" : "Non",
      `${c.gbp_score}/100`,
    ]),
    headStyles: {
      fillColor: [109, 40, 217], // violet-600
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    didParseCell(hookData) {
      const raw = hookData.row.raw;
      const rowName = String(Array.isArray(raw) ? raw[1] ?? "" : "");
      if (rowName.includes("(VOUS)")) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [237, 233, 254]; // violet-100
      }
    },
  });

  // --- Budget estimate ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEndY = ((doc as any).lastAutoTable?.finalY ?? 170) + 12;

  if (report.ads_budget_est != null) {
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(20, tableEndY, 170, 22, 3, 3, "F");

    doc.setFontSize(10);
    doc.setTextColor(109, 40, 217);
    doc.text("Budget Google Ads estimé dans votre secteur :", 28, tableEndY + 9);

    doc.setFontSize(16);
    doc.setTextColor(30, 27, 75);
    doc.text(`${report.ads_budget_est} €/mois`, 28, tableEndY + 18);
  }

  // --- Sales arguments ---
  const salesArgs = generateSalesArgs(
    prospectName,
    prospectScore,
    report.competitors,
    report.ads_budget_est,
  );

  if (salesArgs.length > 0) {
    const argsY = tableEndY + (report.ads_budget_est != null ? 32 : 0);
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text("Points clés", 20, argsY);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    salesArgs.forEach((arg, i) => {
      const y = argsY + 8 + i * 7;
      doc.text(`• ${arg}`, 24, y, { maxWidth: 162 });
    });
  }

  // --- CTA footer ---
  const ctaY = 270;
  doc.setFillColor(109, 40, 217);
  doc.roundedRect(20, ctaY, 170, 16, 3, 3, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "Discutons de votre visibilité en ligne — audit gratuit et sans engagement",
    105,
    ctaY + 10,
    { align: "center" },
  );

  // --- Save ---
  const safeName = prospectName
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`rapport-${safeName}.pdf`);
}
