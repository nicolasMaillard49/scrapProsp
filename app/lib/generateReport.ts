"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompetitorReport } from "./types";
import { generateSalesArgs } from "./gbp";
import { estimateLeadsPerTier, estimateAdsTiers } from "./competitor-config";

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
  greenBg: [236, 253, 245] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  text: [40, 40, 50] as [number, number, number],
  textMuted: [120, 120, 130] as [number, number, number],
  textLight: [160, 160, 170] as [number, number, number],
  border: [220, 220, 230] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bgLight: [250, 249, 255] as [number, number, number],
};

type RGB = [number, number, number];

function scoreColor(score: number): RGB {
  if (score >= 70) return C.green;
  if (score >= 40) return C.amber;
  return C.rose;
}

/* ── Drawing helpers ── */
function drawLine(doc: jsPDF, x1: number, y: number, x2: number, color: RGB = C.border, width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y, x2, y);
}

function drawAccentBar(doc: jsPDF, y: number) {
  doc.setFillColor(...C.purple);
  doc.rect(20, y, 40, 1.2, "F");
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  drawAccentBar(doc, y);
  doc.setFontSize(13);
  doc.setTextColor(...C.text);
  doc.text(title, 20, y + 9);
  return y + 14;
}

function drawFooter(doc: jsPDF, text: string) {
  const pw = 210;
  doc.setFillColor(...C.dark);
  doc.rect(0, 284, pw, 13, "F");
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 200);
  doc.text(text, pw / 2, 291, { align: "center" });
}

function drawMetricCard(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  label: string, mainValue: string, subValue: string, mainColor: RGB,
) {
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  doc.setDrawColor(...C.purpleBg2);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, "S");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text(label, x + 6, y + 9);
  doc.setFontSize(22);
  doc.setTextColor(...mainColor);
  doc.text(mainValue, x + 6, y + 23);
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text(subValue, x + 6 + doc.getTextWidth(mainValue) + 3, y + 23);
}

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function generateDevisNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `DEV-${y}${m}${d}-${rand}`;
}

/* ── Estimate new ranking with site + ads ── */
function estimateNewRank(
  prospectScore: number,
  competitors: { name: string; gbp_score: number }[],
  prospectName: string,
  siteBonus: number,
  adsBonus: number,
): { newScore: number; newRank: number; total: number } {
  const newScore = Math.min(100, prospectScore + siteBonus + adsBonus);
  const all = competitors.map((c) => ({
    name: c.name,
    score: c.name.toLowerCase() === prospectName.toLowerCase() ? newScore : c.gbp_score,
  }));
  if (!all.some((c) => c.name.toLowerCase() === prospectName.toLowerCase())) {
    all.push({ name: prospectName, score: newScore });
  }
  all.sort((a, b) => b.score - a.score);
  const newRank = all.findIndex((c) => c.name.toLowerCase() === prospectName.toLowerCase()) + 1;
  return { newScore, newRank, total: all.length };
}

/** Check if we need a page break, add page + footer if so */
function ensureSpace(doc: jsPDF, yPos: number, needed: number, footerText: string): number {
  if (yPos + needed > 278) {
    drawFooter(doc, footerText);
    doc.addPage();
    return 20;
  }
  return yPos;
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════ */
export function generateProspectReport(data: ReportData) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const doc = new jsPDF();
  const pw = 210;
  const mx = 20;
  const contentW = pw - 2 * mx;
  const tiers = report.ads_tiers ?? estimateAdsTiers(report.metier);
  const leadsData = estimateLeadsPerTier(report.metier);
  const dateStr = formatDate(report.created_at);
  const devisNum = generateDevisNumber();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const validStr = validUntil.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const footerDevis = `${devisNum} \u2014 ${prospectName} \u2014 Valable jusqu'au ${validStr}`;

  // Build merged ranked list
  const merged = [...report.competitors];
  const isInList = merged.some((c) => c.name.toLowerCase() === prospectName.toLowerCase());
  if (!isInList) {
    merged.push({
      name: prospectName,
      rating: data.prospectRating,
      reviews: data.prospectReviews,
      address: null, phone: null, website: null, maps_url: null, category: null,
      gbp_score: prospectScore,
    });
  }
  merged.sort((a, b) => b.gbp_score - a.gbp_score);
  const totalCompetitors = merged.length;

  // Ads bonus per tier
  const adsBonus: Record<string, number> = { eco: 5, performance: 10, top1: 15 };
  const SITE_BONUS = 20;

  // ═══════════════════════════════════════════════════
  // PAGE 1 \u2014 Analyse concurrentielle
  // ═══════════════════════════════════════════════════

  // Header band
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pw, 52, "F");
  doc.setFillColor(...C.purple);
  doc.rect(0, 52, pw, 1.5, "F");

  doc.setFontSize(26);
  doc.setTextColor(...C.white);
  doc.text("Analyse Concurrentielle", mx, 20);

  doc.setFontSize(14);
  doc.setTextColor(...C.purpleLight);
  doc.text(prospectName, mx, 32);

  doc.setFontSize(9);
  doc.setTextColor(160, 160, 200);
  doc.text(`${report.metier} \u00B7 ${report.ville} \u00B7 ${dateStr}`, mx, 44);

  // 3 metric cards
  const cardY = 62;
  const cardH = 28;
  const cardW = (contentW - 14) / 3;
  const gap = 7;

  drawMetricCard(doc, mx, cardY, cardW, cardH, "CLASSEMENT ACTUEL", `#${prospectRank}`, `/ ${totalCompetitors}`, scoreColor(prospectScore));
  drawMetricCard(doc, mx + cardW + gap, cardY, cardW, cardH, "SCORE GBP", `${prospectScore}`, "/ 100", scoreColor(prospectScore));
  drawMetricCard(doc, mx + 2 * (cardW + gap), cardY, cardW, cardH, "CONCURRENTS", `${totalCompetitors}`, "analys\u00E9s", C.purple);

  // Ranking table
  let yPos = drawSectionTitle(doc, "Classement local", 98);

  autoTable(doc, {
    startY: yPos,
    head: [["#", "Entreprise", "Note", "Avis", "Site", "Score"]],
    body: merged.map((c, i) => [
      `${i + 1}`,
      c.name + (c.name.toLowerCase() === prospectName.toLowerCase() ? "  \u2190 VOUS" : ""),
      c.rating != null ? `${c.rating}/5` : "\u2014",
      c.reviews != null ? `${c.reviews}` : "0",
      c.website ? "\u2713" : "\u2717",
      `${c.gbp_score}`,
    ]),
    headStyles: { fillColor: C.dark, textColor: 255, fontStyle: "bold", fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: C.text },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 62 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: C.bgLight },
    didParseCell(hookData) {
      const raw = hookData.row.raw;
      const rowName = String(Array.isArray(raw) ? raw[1] ?? "" : "");
      if (rowName.includes("VOUS")) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = C.purpleBg2;
      }
      if (hookData.section === "body" && hookData.column.index === 5) {
        const val = parseInt(String(hookData.cell.raw), 10);
        if (!isNaN(val)) hookData.cell.styles.textColor = scoreColor(val);
      }
      if (hookData.section === "body" && hookData.column.index === 4) {
        const val = String(hookData.cell.raw);
        hookData.cell.styles.textColor = val === "\u2713" ? C.green : C.rose;
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY ?? 200) + 8;

  // Sales arguments
  const midTierBudget = tiers[1]?.budget ?? report.ads_budget_est;
  const salesArgs = generateSalesArgs(prospectName, prospectScore, report.competitors, midTierBudget);

  if (salesArgs.length > 0 && yPos < 248) {
    yPos = drawSectionTitle(doc, "Points cl\u00E9s", yPos);
    yPos += 2;
    doc.setFontSize(9);
    salesArgs.forEach((arg) => {
      if (yPos > 272) return;
      doc.setTextColor(...C.purple);
      doc.text("\u2192", mx + 2, yPos);
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(arg, 152);
      doc.text(lines, mx + 10, yPos);
      yPos += lines.length * 4.5 + 2;
    });
  }

  drawFooter(doc, `Rapport concurrentiel \u2014 ${prospectName} \u2014 ${report.metier} \u2014 ${report.ville}`);

  // ═══════════════════════════════════════════════════
  // PAGE 2 \u2014 Devis
  // ═══════════════════════════════════════════════════
  doc.addPage();

  // Header band
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pw, 48, "F");
  doc.setFillColor(...C.purple);
  doc.rect(0, 48, pw, 1.5, "F");

  doc.setFontSize(30);
  doc.setTextColor(...C.white);
  doc.text("DEVIS", mx, 20);

  doc.setFontSize(10);
  doc.setTextColor(...C.purpleLight);
  doc.text(devisNum, mx, 30);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 200);
  doc.text(`Date : ${formatDate()}  \u00B7  Validit\u00E9 : ${validStr}`, mx, 40);

  // Client info box
  yPos = 56;
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(mx, yPos, contentW, 18, 2, 2, "F");
  doc.setDrawColor(...C.purpleBg2);
  doc.setLineWidth(0.3);
  doc.roundedRect(mx, yPos, contentW, 18, 2, 2, "S");
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text("CLIENT", mx + 5, yPos + 6);
  doc.setFontSize(11);
  doc.setTextColor(...C.text);
  doc.text(prospectName, mx + 5, yPos + 13);
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text(`${report.ville}  \u00B7  Classement actuel : #${prospectRank}/${totalCompetitors}  \u00B7  Score : ${prospectScore}/100`, mx + 5 + doc.getTextWidth(prospectName) + 6, yPos + 13);

  // ── SECTION 1: Site vitrine ──
  yPos = 80;
  yPos = drawSectionTitle(doc, "1. Site vitrine professionnel", yPos);

  doc.setFontSize(8.5);
  doc.setTextColor(...C.textMuted);
  doc.text("Design responsive, SEO local, formulaire de contact, int\u00E9gration Google Maps & fiche GBP.", mx, yPos + 1, { maxWidth: 105 });

  // Price card
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(138, yPos - 6, 52, 24, 2, 2, "F");
  doc.setDrawColor(...C.purple);
  doc.setLineWidth(0.4);
  doc.roundedRect(138, yPos - 6, 52, 24, 2, 2, "S");
  doc.setFontSize(22);
  doc.setTextColor(...C.purple);
  doc.text("299\u20AC", 148, yPos + 5);
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text("cr\u00E9ation unique", 149, yPos + 12);

  // Maintenance row
  yPos += 22;
  doc.setFillColor(...C.bgLight);
  doc.roundedRect(mx, yPos, contentW, 12, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text("Maintenance & h\u00E9bergement inclus", mx + 5, yPos + 5.5);
  doc.setFontSize(13);
  doc.setTextColor(...C.purple);
  doc.text("29\u20AC", 155, yPos + 6);
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text("/mois", 170, yPos + 6);
  doc.setFontSize(7);
  doc.setTextColor(...C.textLight);
  doc.text("Mises \u00E0 jour, h\u00E9bergement, support, SSL, nom de domaine", mx + 5, yPos + 10.5);

  // ── SECTION 2: Forfaits Google Ads ──
  yPos += 18;
  yPos = drawSectionTitle(doc, "2. Forfaits Google Ads", yPos);

  if (tiers.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Forfait", "Budget/mois", "Objectif"]],
      body: tiers.map((t) => [t.label, `${t.budget}\u20AC`, t.desc]),
      headStyles: { fillColor: C.dark, textColor: 255, fontStyle: "bold", fontSize: 8.5, cellPadding: 2.5 },
      bodyStyles: { fontSize: 8.5, cellPadding: 2.5, textColor: C.text },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold" },
        1: { cellWidth: 28, halign: "center", fontStyle: "bold", textColor: C.purple },
        2: { cellWidth: 100 },
      },
      alternateRowStyles: { fillColor: C.bgLight },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 5;
  }

  // ── SECTION 3: ROI estimation ──
  yPos = drawSectionTitle(doc, "3. Retour sur investissement estim\u00E9", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [["Forfait", "Demandes devis/mois", "Devis sign\u00E9s", "CA mensuel estim\u00E9"]],
    body: leadsData.map((ld) => [
      ld.label,
      `${ld.leads}`,
      `${ld.signedDevis}`,
      `${ld.revenueMensuel.toLocaleString("fr-FR")}\u20AC`,
    ]),
    headStyles: { fillColor: C.dark, textColor: 255, fontStyle: "bold", fontSize: 8, cellPadding: 2.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 2.5, textColor: C.text },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 38, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 40, halign: "right", fontStyle: "bold", textColor: C.green },
    },
    alternateRowStyles: { fillColor: C.bgLight },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 2;
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textLight);
  doc.text(
    `Estimations bas\u00E9es sur le taux de conversion du secteur "${report.metier}" et un panier moyen de ${leadsData[0]?.panier ?? 500}\u20AC HT.`,
    mx, yPos, { maxWidth: contentW },
  );

  // ══════════════════════════════════════════════════════════════
  // SECTION 4: Nouveau classement estim\u00E9
  // ══════════════════════════════════════════════════════════════
  yPos += 8;
  yPos = ensureSpace(doc, yPos, 55, footerDevis);
  yPos = drawSectionTitle(doc, "4. Votre nouveau classement estim\u00E9", yPos);

  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text(
    `Un site web ajoute +20 points \u00E0 votre score GBP. Les Google Ads boostent votre visibilit\u00E9 suppl\u00E9mentaire.`,
    mx, yPos, { maxWidth: contentW },
  );
  yPos += 7;

  // 3 ranking cards side by side
  const cardColW = (contentW - 10) / tiers.length;
  tiers.forEach((tier, i) => {
    const x = mx + i * (cardColW + 5);
    const bonus = adsBonus[tier.key] ?? 10;
    const est = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, bonus);
    const isTop3 = est.newRank <= 3;
    const gain = prospectRank - est.newRank;

    doc.setFillColor(...(isTop3 ? C.greenBg : C.purpleBg));
    doc.roundedRect(x, yPos, cardColW, 34, 2, 2, "F");
    doc.setDrawColor(...(isTop3 ? C.green : C.purpleBg2));
    doc.setLineWidth(0.4);
    doc.roundedRect(x, yPos, cardColW, 34, 2, 2, "S");

    // Tier label
    doc.setFontSize(7.5);
    doc.setTextColor(...C.purple);
    doc.text(`Site + ${tier.label}`, x + 4, yPos + 7);

    // Rank transition: #8 → #3
    doc.setFontSize(9);
    doc.setTextColor(...C.textMuted);
    doc.text(`#${prospectRank}`, x + 4, yPos + 16);
    doc.setFontSize(10);
    doc.setTextColor(...C.purple);
    doc.text("\u2192", x + 16, yPos + 16);
    doc.setFontSize(16);
    doc.setTextColor(...(isTop3 ? C.green : C.purple));
    doc.text(`#${est.newRank}`, x + 24, yPos + 17);
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text(`/${est.total}`, x + 24 + doc.getTextWidth(`#${est.newRank}`) + 1, yPos + 17);

    // Score + gain
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`Score: ${prospectScore} \u2192 ${est.newScore}/100`, x + 4, yPos + 24);
    if (gain > 0) {
      doc.setFontSize(7);
      doc.setTextColor(...C.green);
      doc.text(`+${gain} place${gain > 1 ? "s" : ""} gagn\u00E9e${gain > 1 ? "s" : ""}`, x + 4, yPos + 30);
    }
  });

  yPos += 40;

  // ── SECTION 5: R\u00E9capitulatif ──
  yPos = ensureSpace(doc, yPos, 40, footerDevis);
  yPos = drawSectionTitle(doc, "5. R\u00E9capitulatif tarifaire", yPos);

  const recapRows = tiers.map((tier) => {
    const ld = leadsData.find((l) => l.key === tier.key);
    const bonus = adsBonus[tier.key] ?? 10;
    const est = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, bonus);
    return [
      `Site + ${tier.label}`,
      "299\u20AC",
      `${29 + tier.budget}\u20AC/mois`,
      `#${est.newRank}/${est.total}`,
      `${ld?.revenueMensuel.toLocaleString("fr-FR") ?? "N/A"}\u20AC`,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["Formule", "Cr\u00E9ation", "Total/mois", "Rang estim\u00E9", "CA estim\u00E9/mois"]],
    body: recapRows,
    headStyles: { fillColor: C.dark, textColor: 255, fontStyle: "bold", fontSize: 7.5, cellPadding: 2.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: C.text },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: "bold" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 28, halign: "center", fontStyle: "bold", textColor: C.purple },
      3: { cellWidth: 28, halign: "center", fontStyle: "bold", textColor: C.green },
      4: { cellWidth: 34, halign: "right", fontStyle: "bold", textColor: C.green },
    },
    alternateRowStyles: { fillColor: C.bgLight },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 6;

  // ── Conditions ──
  yPos = ensureSpace(doc, yPos, 30, footerDevis);
  drawLine(doc, mx, yPos, mx + contentW);
  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  doc.text("Conditions", mx, yPos);
  yPos += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  const conditions = [
    `Devis ${devisNum} valable 30 jours \u2014 Paiement site : 50% \u00E0 la commande, 50% \u00E0 la livraison`,
    "D\u00E9lai de r\u00E9alisation site vitrine : 2 \u00E0 3 semaines",
    "Google Ads : engagement minimum 3 mois, r\u00E9siliable ensuite avec pr\u00E9avis 30 jours",
    "Maintenance mensuelle sans engagement, r\u00E9siliable \u00E0 tout moment",
  ];
  conditions.forEach((c) => {
    doc.text(`\u2022  ${c}`, mx + 3, yPos);
    yPos += 4.5;
  });

  // ── Signature zone ──
  yPos += 3;
  yPos = ensureSpace(doc, yPos, 28, footerDevis);
  drawLine(doc, mx, yPos, mx + contentW);
  yPos += 6;

  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("Le prestataire", mx, yPos);
  doc.text("Le client", 120, yPos);

  yPos += 4;
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(prospectName, 120, yPos);

  yPos += 12;
  drawLine(doc, mx, yPos, 90, C.border, 0.5);
  drawLine(doc, 120, yPos, mx + contentW, C.border, 0.5);
  yPos += 4;
  doc.setFontSize(7);
  doc.setTextColor(...C.textLight);
  doc.text("Date et signature", mx, yPos);
  doc.text("Bon pour accord \u2014 Date et signature", 120, yPos);

  // Footer
  drawFooter(doc, footerDevis);

  // Save
  const safeName = prospectName
    .replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`devis-${safeName}.pdf`);
}
