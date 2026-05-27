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
  darkAlt: [22, 20, 50] as [number, number, number],
  purple: [109, 40, 217] as [number, number, number],
  purpleLight: [139, 92, 246] as [number, number, number],
  purpleBg: [245, 243, 255] as [number, number, number],
  purpleBg2: [237, 233, 254] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  greenBg: [236, 253, 245] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  amberBg: [255, 251, 235] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  text: [40, 40, 50] as [number, number, number],
  textMuted: [120, 120, 130] as [number, number, number],
  textLight: [160, 160, 170] as [number, number, number],
  border: [220, 220, 230] as [number, number, number],
  borderLight: [235, 235, 240] as [number, number, number],
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
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  mainValue: string,
  subValue: string,
  mainColor: RGB,
) {
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  // Border
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
  const mainW = doc.getTextWidth(mainValue);
  doc.text(subValue, x + 6 + mainW + 3, y + 23);
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
  // Add prospect if not in list
  if (!all.some((c) => c.name.toLowerCase() === prospectName.toLowerCase())) {
    all.push({ name: prospectName, score: newScore });
  }
  all.sort((a, b) => b.score - a.score);
  const newRank = all.findIndex((c) => c.name.toLowerCase() === prospectName.toLowerCase()) + 1;
  return { newScore, newRank, total: all.length };
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════ */
export function generateProspectReport(data: ReportData) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const doc = new jsPDF();
  const pw = 210;
  const mx = 20; // margin x
  const contentW = pw - 2 * mx;
  const tiers = report.ads_tiers ?? estimateAdsTiers(report.metier);
  const leadsData = estimateLeadsPerTier(report.metier);
  const dateStr = formatDate(report.created_at);

  // Build merged ranked list
  const merged = [...report.competitors];
  const isInList = merged.some((c) => c.name.toLowerCase() === prospectName.toLowerCase());
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
  const totalCompetitors = merged.length;

  // ═══════════════════════════════════════════════════
  // PAGE 1 — Analyse concurrentielle
  // ═══════════════════════════════════════════════════

  // --- Header band ---
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pw, 52, "F");
  doc.setFillColor(...C.purple);
  doc.rect(0, 52, pw, 1.5, "F");

  // Title
  doc.setFontSize(26);
  doc.setTextColor(...C.white);
  doc.text("Analyse Concurrentielle", mx, 20);

  // Prospect name
  doc.setFontSize(14);
  doc.setTextColor(...C.purpleLight);
  doc.text(prospectName, mx, 32);

  // Subtitle: metier, ville, date
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 200);
  doc.text(`${report.metier} | ${report.ville} | ${dateStr}`, mx, 44);

  // --- 3 Score metric cards ---
  const cardY = 62;
  const cardH = 28;
  const cardW = (contentW - 14) / 3;
  const gap = 7;

  drawMetricCard(doc, mx, cardY, cardW, cardH, "CLASSEMENT ACTUEL", `#${prospectRank}`, `/ ${totalCompetitors}`, scoreColor(prospectScore));
  drawMetricCard(doc, mx + cardW + gap, cardY, cardW, cardH, "SCORE GBP", `${prospectScore}`, "/ 100", scoreColor(prospectScore));
  drawMetricCard(doc, mx + 2 * (cardW + gap), cardY, cardW, cardH, "CONCURRENTS", `${totalCompetitors}`, "analysés", C.purple);

  // --- Ranking table ---
  let yPos = drawSectionTitle(doc, "Classement local", 98);

  autoTable(doc, {
    startY: yPos,
    head: [["#", "Entreprise", "Note", "Avis", "Site web", "Score GBP"]],
    body: merged.map((c, i) => [
      `${i + 1}`,
      c.name + (c.name.toLowerCase() === prospectName.toLowerCase() ? "  << VOUS" : ""),
      c.rating != null ? `${c.rating}/5` : "--",
      c.reviews != null ? `${c.reviews}` : "0",
      c.website ? "Oui" : "Non",
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
      1: { cellWidth: 62 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 18, halign: "center", fontStyle: "bold" },
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
        hookData.cell.styles.textColor = val === "Oui" ? C.green : C.rose;
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY ?? 200) + 8;

  // --- Key sales points ---
  const midTierBudget = tiers[1]?.budget ?? report.ads_budget_est;
  const salesArgs = generateSalesArgs(prospectName, prospectScore, report.competitors, midTierBudget);

  if (salesArgs.length > 0 && yPos < 248) {
    yPos = drawSectionTitle(doc, "Points cles", yPos);
    yPos += 2;
    doc.setFontSize(9);
    salesArgs.forEach((arg) => {
      if (yPos > 272) return;
      doc.setTextColor(...C.purple);
      doc.text(">>", mx + 2, yPos);
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(arg, 152);
      doc.text(lines, mx + 10, yPos);
      yPos += lines.length * 4.5 + 2;
    });
  }

  // --- Page 1 Footer ---
  drawFooter(doc, `Rapport concurrentiel -- ${prospectName} -- ${report.metier} -- ${report.ville} -- ${dateStr}`);

  // ═══════════════════════════════════════════════════
  // PAGE 2 — Devis / Proposition commerciale
  // ═══════════════════════════════════════════════════
  doc.addPage();
  const devisNum = generateDevisNumber();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const validStr = validUntil.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // --- Header band ---
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pw, 50, "F");
  doc.setFillColor(...C.purple);
  doc.rect(0, 50, pw, 1.5, "F");

  // "DEVIS" large
  doc.setFontSize(32);
  doc.setTextColor(...C.white);
  doc.text("DEVIS", mx, 22);

  // Devis number + date
  doc.setFontSize(10);
  doc.setTextColor(...C.purpleLight);
  doc.text(devisNum, mx, 32);

  doc.setFontSize(9);
  doc.setTextColor(160, 160, 200);
  doc.text(`Date : ${formatDate()}`, mx, 42);
  doc.text(`Validite : ${validStr}`, mx + 70, 42);

  // --- Client info box ---
  yPos = 60;
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(mx, yPos, contentW, 22, 2, 2, "F");
  doc.setDrawColor(...C.purpleBg2);
  doc.setLineWidth(0.3);
  doc.roundedRect(mx, yPos, contentW, 22, 2, 2, "S");

  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("CLIENT", mx + 6, yPos + 7);
  doc.setFontSize(12);
  doc.setTextColor(...C.text);
  doc.text(prospectName, mx + 6, yPos + 15);
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text(report.ville, mx + 6 + doc.getTextWidth(prospectName) + 8, yPos + 15);

  // Situation resume on right
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text(`Classement actuel : #${prospectRank}/${totalCompetitors}`, mx + contentW - 55, yPos + 7);
  doc.text(`Score GBP : ${prospectScore}/100`, mx + contentW - 55, yPos + 14);

  // ── SECTION 1: Site vitrine ──
  yPos = 90;
  yPos = drawSectionTitle(doc, "1. Site vitrine professionnel", yPos);

  // Description
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text("Design responsive, SEO local, formulaire de contact, integration Google Maps et fiche GBP.", mx, yPos + 2, { maxWidth: 100 });

  // Price card - creation
  doc.setFillColor(...C.purpleBg);
  doc.roundedRect(140, yPos - 6, 50, 26, 2, 2, "F");
  doc.setDrawColor(...C.purple);
  doc.setLineWidth(0.4);
  doc.roundedRect(140, yPos - 6, 50, 26, 2, 2, "S");
  doc.setFontSize(22);
  doc.setTextColor(...C.purple);
  doc.text("299 EUR", 144, yPos + 6);
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text("creation unique", 150, yPos + 13);

  // Maintenance row
  yPos += 24;
  doc.setFillColor(...C.bgLight);
  doc.roundedRect(mx, yPos, contentW, 14, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text("Maintenance & hebergement inclus", mx + 6, yPos + 6);
  doc.setFontSize(14);
  doc.setTextColor(...C.purple);
  doc.text("29 EUR", 152, yPos + 7);
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text("/mois", 176, yPos + 7);
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textLight);
  doc.text("Mises a jour, hebergement, support, SSL, nom de domaine", mx + 6, yPos + 12);

  // ── SECTION 2: Forfaits Google Ads ──
  yPos += 22;
  yPos = drawSectionTitle(doc, "2. Forfaits Google Ads", yPos);

  if (tiers.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Forfait", "Budget/mois", "Objectif"]],
      body: tiers.map((t) => [t.label, `${t.budget} EUR`, t.desc]),
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
        1: { cellWidth: 35, halign: "center", fontStyle: "bold", textColor: C.purple },
        2: { cellWidth: 95 },
      },
      alternateRowStyles: { fillColor: C.bgLight },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 6;
  }

  // ── SECTION 3: ROI estimation ──
  yPos = drawSectionTitle(doc, "3. Retour sur investissement estime", yPos);

  autoTable(doc, {
    startY: yPos,
    head: [["Forfait", "Clics/mois", "Demandes devis", "Devis signes", "CA mensuel estime"]],
    body: leadsData.map((ld) => [
      ld.label,
      `${ld.clicksPerMonth}`,
      `${ld.leads}`,
      `~${ld.signedDevis}`,
      `${ld.revenueMensuel.toLocaleString("fr-FR")} EUR`,
    ]),
    headStyles: {
      fillColor: C.dark,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8.5, cellPadding: 3, textColor: C.text },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 40, halign: "right", fontStyle: "bold", textColor: C.green },
    },
    alternateRowStyles: { fillColor: C.bgLight },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 3;
  doc.setFontSize(7);
  doc.setTextColor(...C.textLight);
  doc.text(
    `Estimations basees sur les taux de conversion du secteur "${report.metier}" et un panier moyen de ${leadsData[0]?.panier ?? 500} EUR HT.`,
    mx, yPos, { maxWidth: contentW },
  );

  // ══════════════════════════════════════════════════════════════
  // SECTION 4: Estimation du nouveau classement (KEY FEATURE)
  // ══════════════════════════════════════════════════════════════
  yPos += 10;
  yPos = drawSectionTitle(doc, "4. Votre nouveau classement estime", yPos);

  doc.setFontSize(8.5);
  doc.setTextColor(...C.textMuted);
  doc.text(
    `Un site web professionnel ajoute environ 20 points a votre score GBP. Les Google Ads boostent votre visibilite supplementaire.`,
    mx, yPos, { maxWidth: contentW },
  );
  yPos += 8;

  // Ads bonus per tier: eco +5, perf +10, top1 +15
  const adsBonus: Record<string, number> = { eco: 5, performance: 10, top1: 15 };
  const SITE_BONUS = 20;

  // Draw comparison cards for each tier
  const cardColW = (contentW - 10) / tiers.length;
  tiers.forEach((tier, i) => {
    const x = mx + i * (cardColW + 5);
    const bonus = adsBonus[tier.key] ?? 10;
    const est = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, bonus);

    // Card background — use green bg if top 3
    const isTop3 = est.newRank <= 3;
    doc.setFillColor(...(isTop3 ? C.greenBg : C.purpleBg));
    doc.roundedRect(x, yPos, cardColW, 38, 2, 2, "F");
    doc.setDrawColor(...(isTop3 ? C.green : C.purpleBg2));
    doc.setLineWidth(0.4);
    doc.roundedRect(x, yPos, cardColW, 38, 2, 2, "S");

    // Tier label
    doc.setFontSize(8);
    doc.setTextColor(...C.purple);
    doc.text(`Site + ${tier.label}`, x + 4, yPos + 7);

    // Arrow from old rank to new rank
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    doc.text(`#${prospectRank}`, x + 4, yPos + 16);

    doc.setFontSize(10);
    doc.setTextColor(...C.purple);
    doc.text(">>", x + 16, yPos + 16);

    doc.setFontSize(16);
    doc.setTextColor(...(isTop3 ? C.green : C.purple));
    doc.text(`#${est.newRank}`, x + 27, yPos + 17);

    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text(`/${est.total}`, x + 27 + doc.getTextWidth(`#${est.newRank}`) + 1, yPos + 17);

    // Score change
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text(`Score: ${prospectScore} >> ${est.newScore}/100`, x + 4, yPos + 25);

    // Badge
    const gain = prospectRank - est.newRank;
    if (gain > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(...C.green);
      doc.text(`+${gain} place${gain > 1 ? "s" : ""} gagnee${gain > 1 ? "s" : ""}`, x + 4, yPos + 33);
    }
  });

  yPos += 44;

  // ── Recap total costs ──
  if (yPos < 228) {
    yPos = drawSectionTitle(doc, "5. Recapitulatif tarifaire", yPos);

    const recapRows = tiers.map((tier) => {
      const ld = leadsData.find((l) => l.key === tier.key);
      const bonus = adsBonus[tier.key] ?? 10;
      const est = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, bonus);
      return [
        `Site + ${tier.label}`,
        "299 EUR",
        `29 EUR/mois`,
        `${tier.budget} EUR/mois`,
        `${(29 + tier.budget)} EUR/mois`,
        `#${est.newRank}/${est.total}`,
        `${ld?.revenueMensuel.toLocaleString("fr-FR") ?? "N/A"} EUR`,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["Formule", "Creation", "Maintenance", "Ads/mois", "Total/mois", "Rang estime", "CA estime/mois"]],
      body: recapRows,
      headStyles: {
        fillColor: C.dark,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: C.text },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: "bold" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center", textColor: C.purple },
        4: { cellWidth: 24, halign: "center", fontStyle: "bold", textColor: C.purple },
        5: { cellWidth: 22, halign: "center", fontStyle: "bold", textColor: C.green },
        6: { cellWidth: 30, halign: "right", fontStyle: "bold", textColor: C.green },
      },
      alternateRowStyles: { fillColor: C.bgLight },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY ?? yPos) + 6;
  }

  // ── Conditions ──
  if (yPos < 245) {
    drawLine(doc, mx, yPos, mx + contentW, C.border, 0.3);
    yPos += 6;

    doc.setFontSize(10);
    doc.setTextColor(...C.text);
    doc.text("Conditions", mx, yPos);

    yPos += 6;
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    const conditions = [
      `Devis ${devisNum} valable 30 jours -- Paiement site : 50% a la commande, 50% a la livraison`,
      "Delai de realisation site vitrine : 2 a 3 semaines",
      "Google Ads : engagement minimum 3 mois, resiliable ensuite avec preavis 30 jours",
      "Maintenance mensuelle sans engagement, resiliable a tout moment",
    ];
    conditions.forEach((c) => {
      if (yPos > 270) return;
      doc.text(`-  ${c}`, mx + 4, yPos);
      yPos += 5;
    });
  }

  // ── Signature zone ──
  yPos += 4;
  if (yPos < 260) {
    drawLine(doc, mx, yPos, mx + contentW, C.border, 0.3);
    yPos += 7;

    // Left: prestataire
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    doc.text("Le prestataire", mx, yPos);

    // Right: client
    doc.text("Le client", 120, yPos);

    yPos += 5;
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
    doc.text("Bon pour accord - Date et signature", 120, yPos);
  }

  // --- Page 2 Footer ---
  drawFooter(doc, `${devisNum} -- ${prospectName} -- Valable jusqu'au ${validStr}`);

  // --- Save ---
  const safeName = prospectName
    .replace(/[^a-zA-Z0-9\u00C0-\u017F\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`devis-${safeName}.pdf`);
}
