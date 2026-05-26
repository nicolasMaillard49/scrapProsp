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

/* ── Pricing data for the devis section ── */

const DEVIS_ITEMS = [
  {
    ref: "SITE-01",
    label: "Création site vitrine professionnel",
    desc: "Site responsive, optimisé SEO, formulaire de contact, intégration Google Maps et fiche Google Business Profile.",
    prix: 990,
  },
  {
    ref: "GBP-01",
    label: "Optimisation Google Business Profile",
    desc: "Audit complet, optimisation fiche, photos, catégories, posts réguliers pendant 3 mois.",
    prix: 290,
  },
  {
    ref: "FORM-01",
    label: "Formation & accompagnement",
    desc: "Formation à la gestion du site, réponse aux avis, bonnes pratiques réseaux sociaux (2h).",
    prix: 190,
  },
];

const PACK_DISCOUNT = 0.15; // 15% discount on pack

export function generateProspectReport(data: ReportData) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const doc = new jsPDF();

  // ═══════════════════════════════════════════
  // PAGE 1 — Analyse concurrentielle
  // ═══════════════════════════════════════════

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

  // --- Ads tiers table ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEndY = ((doc as any).lastAutoTable?.finalY ?? 170) + 12;
  const tiers = report.ads_tiers ?? [];
  if (tiers.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(109, 40, 217);
    doc.text("Forfaits Google Ads", 20, tableEndY);

    autoTable(doc, {
      startY: tableEndY + 4,
      head: [["Forfait", "Budget/mois", "Objectif"]],
      body: tiers.map((t) => [t.label, `${t.budget} €`, t.desc]),
      headStyles: {
        fillColor: [109, 40, 217],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { fontStyle: "bold", halign: "center" } },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });
  } else if (report.ads_budget_est != null) {
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(20, tableEndY, 170, 22, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(109, 40, 217);
    doc.text("Budget Google Ads estimé :", 28, tableEndY + 9);
    doc.setFontSize(16);
    doc.setTextColor(30, 27, 75);
    doc.text(`${report.ads_budget_est} €/mois`, 28, tableEndY + 18);
  }

  // --- Sales arguments ---
  const midTierBudget = tiers[1]?.budget ?? report.ads_budget_est;
  const salesArgs = generateSalesArgs(
    prospectName,
    prospectScore,
    report.competitors,
    midTierBudget,
  );

  if (salesArgs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const argsY = ((doc as any).lastAutoTable?.finalY ?? tableEndY) + 12;
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

  // ═══════════════════════════════════════════
  // PAGE 2 — Proposition commerciale (devis)
  // ═══════════════════════════════════════════

  doc.addPage();

  // Header
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, 210, 35, "F");

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Proposition Commerciale", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(200, 180, 255);
  doc.text(`${prospectName} — ${report.ville}`, 105, 25, { align: "center" });

  // Validity
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 220);
  doc.text(`Valable jusqu'au ${validUntil.toLocaleDateString("fr-FR")}`, 105, 32, { align: "center" });

  // Intro text
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Suite à notre analyse de votre positionnement (${prospectScore}/100, #${prospectRank} sur ${merged.length}),`,
    20,
    46,
  );
  doc.text("voici notre proposition pour améliorer votre visibilité en ligne :", 20, 53);

  // --- Services table ---
  const devisRows = DEVIS_ITEMS.map((item) => [
    item.ref,
    item.label,
    item.desc,
    `${item.prix} €`,
  ]);

  // Add ads tier if available (mid-tier as example)
  const adsTier = tiers[1] ?? tiers[0];
  if (adsTier) {
    devisRows.push([
      "ADS-01",
      `Gestion Google Ads — ${adsTier.label}`,
      `${adsTier.desc}. Budget média + gestion/mois.`,
      `${adsTier.budget} €/mois`,
    ]);
  }

  autoTable(doc, {
    startY: 60,
    head: [["Réf.", "Prestation", "Description", "Prix HT"]],
    body: devisRows,
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: 90 },
      3: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [245, 243, 255] },
  });

  // --- Pack total ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devisEndY = ((doc as any).lastAutoTable?.finalY ?? 140) + 8;

  const totalHT = DEVIS_ITEMS.reduce((sum, item) => sum + item.prix, 0);
  const packPrice = Math.round(totalHT * (1 - PACK_DISCOUNT));

  // Pack box
  doc.setFillColor(237, 233, 254); // violet-100
  doc.roundedRect(20, devisEndY, 170, 40, 3, 3, "F");

  doc.setFontSize(13);
  doc.setTextColor(109, 40, 217);
  doc.text("Pack Visibilité Complète", 28, devisEndY + 10);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("Site vitrine + GBP + Formation — tout inclus pour démarrer", 28, devisEndY + 18);

  // Strikethrough original price
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  const origText = `${totalHT} € HT`;
  doc.text(origText, 140, devisEndY + 10);
  const origWidth = doc.getTextWidth(origText);
  doc.setDrawColor(180, 180, 180);
  doc.line(140, devisEndY + 9, 140 + origWidth, devisEndY + 9);

  // Pack price
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75);
  doc.text(`${packPrice} € HT`, 140, devisEndY + 22);

  doc.setFontSize(9);
  doc.setTextColor(109, 40, 217);
  doc.text(`-${Math.round(PACK_DISCOUNT * 100)}%`, 140, devisEndY + 30);

  // --- Ads management note ---
  if (adsTier) {
    const adsNoteY = devisEndY + 50;
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(20, adsNoteY, 170, 20, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(109, 40, 217);
    doc.text("Google Ads en option :", 28, adsNoteY + 8);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `à partir de ${tiers[0]?.budget ?? adsTier.budget} €/mois (budget média + gestion incluse)`,
      28,
      adsNoteY + 15,
    );
  }

  // --- Conditions ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const condY = adsTier ? devisEndY + 80 : devisEndY + 52;
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text("Conditions", 20, condY);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const conditions = [
    "• Devis valable 30 jours à compter de la date d'émission",
    "• Paiement : 50% à la commande, 50% à la livraison",
    "• Délai de réalisation site vitrine : 2 à 3 semaines",
    "• Formation dispensée sur site ou en visioconférence",
    "• Google Ads : engagement minimum 3 mois, résiliable ensuite",
    "• Hébergement & nom de domaine offerts la 1ère année",
  ];
  conditions.forEach((c, i) => {
    doc.text(c, 24, condY + 8 + i * 6);
  });

  // --- Signature zone ---
  const sigY = condY + 56;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);

  // Left: Prestataire
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Le prestataire", 20, sigY);
  doc.line(20, sigY + 20, 90, sigY + 20);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Date et signature", 20, sigY + 25);

  // Right: Client
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Le client", 120, sigY);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(prospectName, 120, sigY + 8);
  doc.line(120, sigY + 20, 190, sigY + 20);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Bon pour accord — Date et signature', 120, sigY + 25);

  // --- Footer CTA ---
  doc.setFillColor(109, 40, 217);
  doc.roundedRect(20, 270, 170, 16, 3, 3, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "Prêt à booster votre visibilité ? Contactez-nous dès maintenant !",
    105,
    280,
    { align: "center" },
  );

  // --- Save ---
  const safeName = prospectName
    .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`rapport-${safeName}.pdf`);
}
