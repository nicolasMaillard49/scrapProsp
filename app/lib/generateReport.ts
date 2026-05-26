"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompetitorReport } from "./types";
import { generateSalesArgs } from "./gbp";
import { estimateLeadsPerTier } from "./competitor-config";

interface ReportData {
  report: CompetitorReport;
  prospectName: string;
  prospectRating: number | null;
  prospectReviews: number | null;
  prospectScore: number;
  prospectRank: number;
}

/* ── Color palette ── */
const C = {
  dark: [15, 14, 36] as [number, number, number],
  purple: [109, 40, 217] as [number, number, number],
  purpleLight: [139, 92, 246] as [number, number, number],
  purpleBg: [245, 243, 255] as [number, number, number],
  purpleBg2: [237, 233, 254] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  text: [40, 40, 50] as [number, number, number],
  textMuted: [120, 120, 130] as [number, number, number],
  textLight: [160, 160, 170] as [number, number, number],
  border: [220, 220, 230] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function scoreColor(score: number): [number, number, number] {
  if (score >= 70) return C.green;
  if (score >= 40) return C.amber;
  return C.rose;
}

/* ── Helpers ── */
function drawLine(doc: jsPDF, x1: number, y: number, x2: number, color = C.border, width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y, x2, y);
}

function drawAccentBar(doc: jsPDF, y: number) {
  doc.setFillColor(...C.purple);
  doc.rect(20, y, 40, 1.2, "F");
}

export function generateProspectReport(data: ReportData) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const doc = new jsPDF();
  const pw = 210; // page width
  const tiers = report.ads_tiers ?? [];
  const leadsData = estimateLeadsPerTier(report.metier);

  // ═══════════════════════════════════════════════════
  // PAGE 1 — Analyse concurrentielle
  // ═══════════════════════════════════════════════════

  // --- Header band ---
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pw, 48, "F");

  // Accent line
  doc.setFillColor(...C.purple);
  doc.rect(0, 48, pw, 1.5, "F");

  // Title
  doc.setFontSize(24);
  doc.setTextColor(...C.white);
  doc.text("Analyse Concurrentielle", 20, 20);

  doc.setFontSize(13);
  doc.setTextColor(...C.purpleLight);
  doc.text(prospectName, 20, 30);

  doc.setFontSize(9);
  doc.setTextColor(160, 160, 200);
  const dateStr = report.created_at
    ? new Date(report.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`${report.metier} · ${report.ville} · ${dateStr}`, 20, 40);

  // --- Score cards row ---
  const cardY = 58;
  const cardH = 28;
  const cardW = 52;
  const gap = 7;

  // Card 1: Rang
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(20, cardY, cardW, cardH, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("CLASSEMENT", 26, cardY + 8);
  doc.setFontSize(22);
  doc.setTextColor(...scoreColor(prospectScore));
  doc.text(`#${prospectRank}`, 26, cardY + 22);
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text(`/ ${report.competitors.length}`, 26 + doc.getTextWidth(`#${prospectRank}`) + 3, cardY + 22);

  // Card 2: Score GBP
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(20 + cardW + gap, cardY, cardW, cardH, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("SCORE GBP", 26 + cardW + gap, cardY + 8);
  doc.setFontSize(22);
  doc.setTextColor(...scoreColor(prospectScore));
  doc.text(`${prospectScore}`, 26 + cardW + gap, cardY + 22);
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text("/ 100", 26 + cardW + gap + doc.getTextWidth(`${prospectScore}`) + 3, cardY + 22);

  // Card 3: Concurrents
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(20 + 2 * (cardW + gap), cardY, cardW, cardH, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("CONCURRENTS", 26 + 2 * (cardW + gap), cardY + 8);
  doc.setFontSize(22);
  doc.setTextColor(...C.purple);
  doc.text(`${report.competitors.length}`, 26 + 2 * (cardW + gap), cardY + 22);
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text("analysés", 26 + 2 * (cardW + gap) + doc.getTextWidth(`${report.competitors.length}`) + 3, cardY + 22);

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

  drawAccentBar(doc, 94);

  doc.setFontSize(13);
  doc.setTextColor(...C.text);
  doc.text("Classement local", 20, 103);

  autoTable(doc, {
    startY: 108,
    head: [["#", "Entreprise", "Note", "Avis", "Site", "Score"]],
    body: merged.map((c, i) => [
      `${i + 1}`,
      c.name + (c.name.toLowerCase() === prospectName.toLowerCase() ? "  ← VOUS" : ""),
      c.rating != null ? `${c.rating}` : "—",
      c.reviews != null ? `${c.reviews}` : "0",
      c.website ? "✓" : "✗",
      `${c.gbp_score}`,
    ]),
    headStyles: {
      fillColor: C.dark,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: C.text },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 249, 255] },
    didParseCell(hookData) {
      const raw = hookData.row.raw;
      const rowName = String(Array.isArray(raw) ? raw[1] ?? "" : "");
      if (rowName.includes("VOUS")) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = C.purpleBg2;
      }
      // Color the score
      if (hookData.section === "body" && hookData.column.index === 5) {
        const val = parseInt(String(hookData.cell.raw), 10);
        if (!isNaN(val)) {
          hookData.cell.styles.textColor = scoreColor(val);
        }
      }
      // Color site column
      if (hookData.section === "body" && hookData.column.index === 4) {
        const val = String(hookData.cell.raw);
        hookData.cell.styles.textColor = val === "✓" ? C.green : C.rose;
      }
    },
  });

  // --- Points clés ---
  const midTierBudget = tiers[1]?.budget ?? report.ads_budget_est;
  const salesArgs = generateSalesArgs(
    prospectName,
    prospectScore,
    report.competitors,
    midTierBudget,
  );

  if (salesArgs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const argsY = ((doc as any).lastAutoTable?.finalY ?? 200) + 10;

    if (argsY < 250) {
      drawAccentBar(doc, argsY);
      doc.setFontSize(13);
      doc.setTextColor(...C.text);
      doc.text("Points clés pour votre prospection", 20, argsY + 9);

      doc.setFontSize(9);
      salesArgs.forEach((arg, i) => {
        const y = argsY + 17 + i * 7;
        if (y > 275) return;
        doc.setTextColor(...C.purple);
        doc.text("→", 24, y);
        doc.setTextColor(...C.text);
        doc.text(arg, 30, y, { maxWidth: 156 });
      });
    }
  }

  // --- Footer ---
  doc.setFillColor(...C.dark);
  doc.rect(0, 284, pw, 13, "F");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 200);
  doc.text("Rapport généré automatiquement — Données Google Maps", pw / 2, 292, { align: "center" });

  // ═══════════════════════════════════════════════════
  // PAGE 2 — Proposition commerciale
  // ═══════════════════════════════════════════════════

  doc.addPage();

  // --- Header ---
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pw, 42, "F");
  doc.setFillColor(...C.purple);
  doc.rect(0, 42, pw, 1.5, "F");

  doc.setFontSize(22);
  doc.setTextColor(...C.white);
  doc.text("Proposition Commerciale", 20, 18);

  doc.setFontSize(12);
  doc.setTextColor(...C.purpleLight);
  doc.text(prospectName, 20, 28);

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 200);
  doc.text(`${report.ville} · Valable jusqu'au ${validUntil.toLocaleDateString("fr-FR")}`, 20, 37);

  // --- Context line ---
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  doc.text(
    `Actuellement classé #${prospectRank} sur ${merged.length} (score ${prospectScore}/100), voici comment améliorer votre visibilité :`,
    20, 54, { maxWidth: 170 },
  );

  // ── SECTION 1: Site vitrine ──
  let yPos = 68;
  drawAccentBar(doc, yPos);
  yPos += 9;
  doc.setFontSize(14);
  doc.setTextColor(...C.text);
  doc.text("Site vitrine professionnel", 20, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text("Design responsive, SEO local, formulaire de contact, intégration Google Maps et fiche GBP.", 20, yPos, { maxWidth: 110 });

  // Price box
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(140, yPos - 10, 50, 24, 2, 2, "F");
  doc.setFontSize(20);
  doc.setTextColor(...C.purple);
  doc.text("299€", 152, yPos - 1);
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("création unique", 148, yPos + 6);

  // Maintenance
  yPos += 16;
  doc.setFillColor(250, 249, 255);
  doc.roundedRect(20, yPos, 170, 14, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text("Maintenance & hébergement inclus", 28, yPos + 6);
  doc.setFontSize(13);
  doc.setTextColor(...C.purple);
  doc.text("29€", 160, yPos + 6);
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("/mois", 175, yPos + 6);
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("Mises à jour, hébergement, support, SSL, nom de domaine", 28, yPos + 11);

  // ── SECTION 2: Forfaits Ads ──
  yPos += 24;
  if (tiers.length > 0) {
    drawAccentBar(doc, yPos);
    yPos += 9;
    doc.setFontSize(14);
    doc.setTextColor(...C.text);
    doc.text("Forfaits Google Ads", 20, yPos);

    yPos += 6;
    autoTable(doc, {
      startY: yPos,
      head: [["Forfait", "Budget/mois", "Objectif"]],
      body: tiers.map((t) => [t.label, `${t.budget} €`, t.desc]),
      headStyles: {
        fillColor: C.dark,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3, textColor: C.text },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold" },
        1: { cellWidth: 30, halign: "center", fontStyle: "bold", textColor: C.purple },
        2: { cellWidth: 100 },
      },
      alternateRowStyles: { fillColor: [250, 249, 255] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 6;

    // ── SECTION 3: Estimation de leads ──
    drawAccentBar(doc, yPos);
    yPos += 9;
    doc.setFontSize(14);
    doc.setTextColor(...C.text);
    doc.text("Retour sur investissement estimé", 20, yPos);

    yPos += 6;
    autoTable(doc, {
      startY: yPos,
      head: [["Forfait", "Demandes devis/mois", "Devis signés", "CA mensuel estimé"]],
      body: leadsData.map((ld) => [
        ld.label,
        `${ld.leads}`,
        `~${ld.signedDevis}`,
        `${ld.revenueMensuel.toLocaleString("fr-FR")} €`,
      ]),
      headStyles: {
        fillColor: C.dark,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3, textColor: C.text },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold" },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 45, halign: "right", fontStyle: "bold", textColor: C.green },
      },
      alternateRowStyles: { fillColor: [250, 249, 255] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 4;
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textLight);
    doc.text(
      `Estimations basées sur les taux de conversion moyens du secteur "${report.metier}" et un panier moyen de ${leadsData[0]?.panier ?? 500}€ HT.`,
      20, yPos, { maxWidth: 170 },
    );
  }

  // ── Conditions ──
  yPos += 12;
  if (yPos < 235) {
    drawLine(doc, 20, yPos, 190);
    yPos += 8;

    doc.setFontSize(11);
    doc.setTextColor(...C.text);
    doc.text("Conditions", 20, yPos);

    yPos += 7;
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    const conditions = [
      "Devis valable 30 jours · Paiement site : 50% commande, 50% livraison",
      "Délai de réalisation site vitrine : 2 à 3 semaines",
      "Google Ads : engagement minimum 3 mois, résiliable ensuite",
      "Maintenance mensuelle résiliable à tout moment",
    ];
    conditions.forEach((c) => {
      doc.text(`·  ${c}`, 24, yPos);
      yPos += 5.5;
    });
  }

  // ── Signature zone ──
  yPos += 6;
  if (yPos < 258) {
    drawLine(doc, 20, yPos, 190);
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(...C.textMuted);
    doc.text("Le prestataire", 20, yPos);
    doc.text("Le client", 120, yPos);

    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(prospectName, 120, yPos);

    yPos += 15;
    drawLine(doc, 20, yPos, 90, C.border, 0.5);
    drawLine(doc, 120, yPos, 190, C.border, 0.5);

    yPos += 4;
    doc.setFontSize(7);
    doc.setTextColor(...C.textLight);
    doc.text("Date et signature", 20, yPos);
    doc.text("Bon pour accord · Date et signature", 120, yPos);
  }

  // --- Footer ---
  doc.setFillColor(...C.dark);
  doc.rect(0, 284, pw, 13, "F");
  doc.setFontSize(9);
  doc.setTextColor(...C.purpleLight);
  doc.text("Prêt à booster votre visibilité ? Contactez-nous dès maintenant", pw / 2, 292, { align: "center" });

  // --- Save ---
  const safeName = prospectName
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`rapport-${safeName}.pdf`);
}
