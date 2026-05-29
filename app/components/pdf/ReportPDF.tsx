import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CompetitorReport, CompetitorResult } from "../../lib/types";
import { estimateAdsTiers, estimateLeadsPerTier } from "../../lib/competitor-config";
import { generateSalesArgs } from "../../lib/gbp";

/* ── Data interface ── */
export interface ReportData {
  report: CompetitorReport;
  prospectName: string;
  prospectRating: number | null;
  prospectReviews: number | null;
  prospectScore: number;
  prospectRank: number;
}

/* ── Register Helvetica variants (built-in, just declare weights) ── */
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica", fontWeight: 400 },
    { src: "Helvetica-Bold", fontWeight: 700 },
  ],
});

/* ── Color palette — ink/charcoal with a single vivid violet accent ── */
const C = {
  ink: "#0f0e24",
  inkLight: "#1a1935",
  violet: "#7c3aed",
  violetMuted: "#a78bfa",
  violetBg: "#f3f0ff",
  violetBg2: "#ede9fe",
  green: "#10b981",
  greenBg: "#ecfdf5",
  amber: "#f59e0b",
  rose: "#f43f5e",
  text: "#1e1e2e",
  muted: "#6b7280",
  light: "#9ca3af",
  border: "#e5e7eb",
  white: "#ffffff",
  bg: "#fafafe",
};

function scoreColor(score: number): string {
  if (score >= 70) return C.green;
  if (score >= 40) return C.amber;
  return C.rose;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function fmtDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function devisNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const r = String(Math.floor(Math.random() * 900) + 100);
  return `DEV-${y}${m}${d}-${r}`;
}

function estimateNewRank(
  prospectScore: number,
  competitors: CompetitorResult[],
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

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
  },

  /* ── Header band ── */
  header: {
    backgroundColor: C.ink,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 36,
  },
  headerAccent: {
    width: 40,
    height: 3,
    backgroundColor: C.violet,
    marginBottom: 10,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: C.white,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: C.violetMuted,
    marginTop: 4,
  },
  headerMeta: {
    fontSize: 8,
    color: "#8888aa",
    marginTop: 6,
  },
  headerLine: {
    height: 2,
    backgroundColor: C.violet,
  },

  /* ── Content area ── */
  content: {
    paddingHorizontal: 36,
    paddingTop: 18,
  },

  /* ── Section title ── */
  sectionBar: {
    width: 28,
    height: 2,
    backgroundColor: C.violet,
    borderRadius: 1,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
    marginBottom: 10,
  },

  /* ── Metric cards row ── */
  cardsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: C.violetBg,
    borderRadius: 6,
    padding: 12,
    borderWidth: 0.5,
    borderColor: C.violetBg2,
  },
  cardLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  cardSub: {
    fontSize: 8,
    color: C.muted,
    marginTop: 2,
  },

  /* ── Table ── */
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.ink,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 1,
  },
  tableHeadCell: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.white,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  tableRowHighlight: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: C.violetBg2,
    backgroundColor: C.violetBg2,
  },
  tableCell: {
    fontSize: 8,
    color: C.text,
  },

  /* Column widths for ranking table */
  colRank: { width: 18, textAlign: "center" },
  colName: { flex: 1 },
  colRating: { width: 30, textAlign: "center" },
  colReviews: { width: 30, textAlign: "center" },
  colSite: { width: 24, textAlign: "center" },
  colScore: { width: 30, textAlign: "center" },

  /* ── Sales args ── */
  argRow: {
    flexDirection: "row",
    marginBottom: 5,
    paddingRight: 10,
  },
  argBullet: {
    fontSize: 10,
    color: C.violet,
    marginRight: 6,
    marginTop: -1,
  },
  argText: {
    fontSize: 8.5,
    color: C.text,
    flex: 1,
    lineHeight: 1.4,
  },

  /* ── Footer ── */
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.ink,
    paddingVertical: 6,
    paddingHorizontal: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#8888aa",
  },

  /* ══ PAGE 2 — Devis ══ */
  devisHeader: {
    backgroundColor: C.ink,
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 36,
  },
  devisTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: C.white,
    letterSpacing: 1,
  },
  devisNum: {
    fontSize: 10,
    color: C.violetMuted,
    marginTop: 4,
  },
  devisMeta: {
    fontSize: 8,
    color: "#8888aa",
    marginTop: 4,
  },

  /* Client info box */
  clientBox: {
    backgroundColor: C.violetBg,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: C.violetBg2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clientLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: C.muted,
    letterSpacing: 0.8,
  },
  clientName: {
    fontSize: 13,
    fontWeight: 700,
    color: C.text,
    marginTop: 2,
  },
  clientMeta: {
    fontSize: 8,
    color: C.muted,
    textAlign: "right",
  },

  /* Site vitrine section */
  siteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  siteDesc: {
    fontSize: 8.5,
    color: C.muted,
    maxWidth: 280,
    lineHeight: 1.4,
  },
  priceBox: {
    backgroundColor: C.violetBg,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.violet,
    alignItems: "center",
  },
  priceMain: {
    fontSize: 20,
    fontWeight: 700,
    color: C.violet,
  },
  priceSub: {
    fontSize: 7,
    color: C.muted,
    marginTop: 2,
  },
  maintenanceRow: {
    backgroundColor: C.bg,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  maintenanceLabel: {
    fontSize: 8,
    color: C.text,
  },
  maintenanceDetail: {
    fontSize: 7,
    color: C.light,
    marginTop: 1,
  },
  maintenancePrice: {
    fontSize: 14,
    fontWeight: 700,
    color: C.violet,
  },
  maintenancePeriod: {
    fontSize: 7,
    color: C.muted,
  },

  /* Ads table columns */
  colTier: { width: 52, fontWeight: 700 },
  colBudget: { width: 52, textAlign: "center" },
  colDesc: { flex: 1 },

  /* ROI table columns */
  colRoiTier: { width: 52, fontWeight: 700 },
  colLeads: { width: 50, textAlign: "center" },
  colSigned: { width: 46, textAlign: "center" },
  colRevenue: { width: 56, textAlign: "right" },

  /* ── Ranking projection cards ── */
  projRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  projCard: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    borderWidth: 0.5,
  },
  projTier: {
    fontSize: 8,
    fontWeight: 700,
    color: C.violet,
    marginBottom: 6,
  },
  projRankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  projOldRank: {
    fontSize: 10,
    color: C.light,
  },
  projArrow: {
    fontSize: 10,
    color: C.violet,
  },
  projNewRank: {
    fontSize: 18,
    fontWeight: 700,
  },
  projTotal: {
    fontSize: 8,
    color: C.muted,
  },
  projScore: {
    fontSize: 7,
    color: C.muted,
    marginTop: 2,
  },
  projGain: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.green,
    marginTop: 2,
  },

  /* ── Recap table columns ── */
  colFormule: { width: 54, fontWeight: 700 },
  colCreation: { width: 36, textAlign: "center" },
  colMensuel: { width: 42, textAlign: "center" },
  colRangEst: { width: 40, textAlign: "center" },
  colCaEst: { width: 52, textAlign: "right" },

  /* ── Conditions ── */
  condBlock: {
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.violet,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  condTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: C.text,
    marginBottom: 5,
  },
  condItem: {
    fontSize: 7.5,
    color: C.muted,
    marginBottom: 3,
    lineHeight: 1.3,
  },

  /* ── Signature ── */
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  sigBlock: {
    width: 200,
  },
  sigLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: C.text,
    marginBottom: 3,
  },
  sigName: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 18,
  },
  sigLine: {
    borderBottomWidth: 0.8,
    borderBottomColor: C.text,
    width: 160,
    marginBottom: 4,
  },
  sigCaption: {
    fontSize: 7,
    color: C.light,
  },
});

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function ReportPDF({ data }: { data: ReportData }) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const tiers = report.ads_tiers ?? estimateAdsTiers(report.metier);
  const leadsData = estimateLeadsPerTier(report.metier);
  const dateStr = fmtDate(report.created_at);
  const devNum = devisNumber();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const validStr = fmtDate(validUntil.toISOString());

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

  const SITE_BONUS = 20;
  const adsBonus: Record<string, number> = { eco: 5, performance: 10, top1: 15 };

  const midTierBudget = tiers[1]?.budget ?? report.ads_budget_est;
  const salesArgs = generateSalesArgs(prospectName, prospectScore, report.competitors, midTierBudget);

  const footerP1 = `Rapport concurrentiel — ${prospectName} — ${report.metier} — ${report.ville}`;
  const footerP2 = `${devNum} — ${prospectName} — Valable jusqu'au ${validStr}`;

  return (
    <Document title={`Devis ${prospectName}`} author="NMF Agence">

      {/* ═══════════════════════════════════════════
          PAGE 1 — Analyse concurrentielle
          ═══════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAccent} />
          <Text style={s.headerTitle}>Analyse Concurrentielle</Text>
          <Text style={s.headerSub}>{prospectName}</Text>
          <Text style={s.headerMeta}>{report.metier} · {report.ville} · {dateStr}</Text>
        </View>
        <View style={s.headerLine} />

        <View style={s.content}>
          {/* 3 Metric Cards */}
          <View style={s.cardsRow}>
            <View style={s.card}>
              <Text style={s.cardLabel}>CLASSEMENT</Text>
              <Text style={[s.cardValue, { color: scoreColor(prospectScore) }]}>
                #{prospectRank}
              </Text>
              <Text style={s.cardSub}>/ {totalCompetitors} concurrents</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>SCORE GBP</Text>
              <Text style={[s.cardValue, { color: scoreColor(prospectScore) }]}>
                {prospectScore}
              </Text>
              <Text style={s.cardSub}>/ 100 points</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>CONCURRENTS</Text>
              <Text style={[s.cardValue, { color: C.violet }]}>
                {totalCompetitors}
              </Text>
              <Text style={s.cardSub}>analysés</Text>
            </View>
          </View>

          {/* Section: Classement local */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>Classement local</Text>

          {/* Table Header */}
          <View style={s.tableHead}>
            <Text style={[s.tableHeadCell, s.colRank]}>#</Text>
            <Text style={[s.tableHeadCell, s.colName]}>Entreprise</Text>
            <Text style={[s.tableHeadCell, s.colRating]}>Note</Text>
            <Text style={[s.tableHeadCell, s.colReviews]}>Avis</Text>
            <Text style={[s.tableHeadCell, s.colSite]}>Site</Text>
            <Text style={[s.tableHeadCell, s.colScore]}>Score</Text>
          </View>

          {/* Table Rows */}
          {merged.map((c, i) => {
            const isProspect = c.name.toLowerCase() === prospectName.toLowerCase();
            const rowStyle = isProspect
              ? s.tableRowHighlight
              : i % 2 === 0
                ? s.tableRow
                : s.tableRowAlt;
            return (
              <View key={i} style={rowStyle} wrap={false}>
                <Text style={[s.tableCell, s.colRank, isProspect ? { fontWeight: 700 } : {}]}>
                  {i + 1}
                </Text>
                <Text style={[s.tableCell, s.colName, isProspect ? { fontWeight: 700, color: C.violet } : {}]}>
                  {c.name}{isProspect ? "  ← VOUS" : ""}
                </Text>
                <Text style={[s.tableCell, s.colRating]}>
                  {c.rating != null ? `${c.rating}/5` : "—"}
                </Text>
                <Text style={[s.tableCell, s.colReviews]}>
                  {c.reviews != null ? `${c.reviews}` : "0"}
                </Text>
                <Text style={[s.tableCell, s.colSite, { color: c.website ? C.green : C.rose }]}>
                  {c.website ? "✓" : "✗"}
                </Text>
                <Text style={[s.tableCell, s.colScore, { fontWeight: 700, color: scoreColor(c.gbp_score) }]}>
                  {c.gbp_score}
                </Text>
              </View>
            );
          })}

          {/* Sales arguments */}
          {salesArgs.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <View style={s.sectionBar} />
              <Text style={s.sectionTitle}>Points clés</Text>
              {salesArgs.map((arg, i) => (
                <View key={i} style={s.argRow}>
                  <Text style={s.argBullet}>▸</Text>
                  <Text style={s.argText}>{arg}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerP1}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}`
          } />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════
          PAGE 2 — Devis commercial
          ═══════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.devisHeader}>
          <View style={s.headerAccent} />
          <Text style={s.devisTitle}>DEVIS</Text>
          <Text style={s.devisNum}>{devNum}</Text>
          <Text style={s.devisMeta}>Date : {fmtDate()} · Validité : {validStr}</Text>
        </View>
        <View style={s.headerLine} />

        <View style={s.content}>
          {/* Client box */}
          <View style={s.clientBox}>
            <View>
              <Text style={s.clientLabel}>CLIENT</Text>
              <Text style={s.clientName}>{prospectName}</Text>
            </View>
            <View>
              <Text style={s.clientMeta}>{report.ville}</Text>
              <Text style={s.clientMeta}>Classement : #{prospectRank}/{totalCompetitors}</Text>
              <Text style={s.clientMeta}>Score : {prospectScore}/100</Text>
            </View>
          </View>

          {/* 1. Site vitrine */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>1. Site vitrine professionnel</Text>
          <View style={s.siteRow}>
            <Text style={s.siteDesc}>
              Design responsive, SEO local, formulaire de contact, intégration Google Maps et fiche GBP.
            </Text>
            <View style={s.priceBox}>
              <Text style={s.priceMain}>299€</Text>
              <Text style={s.priceSub}>création unique</Text>
            </View>
          </View>
          <View style={s.maintenanceRow}>
            <View>
              <Text style={s.maintenanceLabel}>Maintenance & hébergement inclus</Text>
              <Text style={s.maintenanceDetail}>
                Mises à jour, hébergement, support, SSL, nom de domaine
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
              <Text style={s.maintenancePrice}>29€</Text>
              <Text style={s.maintenancePeriod}>/mois</Text>
            </View>
          </View>

          {/* 2. Forfaits Google Ads */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>2. Forfaits Google Ads</Text>

          {tiers.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View style={s.tableHead}>
                <Text style={[s.tableHeadCell, s.colTier]}>Forfait</Text>
                <Text style={[s.tableHeadCell, s.colBudget]}>Budget/mois</Text>
                <Text style={[s.tableHeadCell, s.colDesc]}>Objectif</Text>
              </View>
              {tiers.map((t, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                  <Text style={[s.tableCell, s.colTier]}>{t.label}</Text>
                  <Text style={[s.tableCell, s.colBudget, { fontWeight: 700, color: C.violet }]}>
                    {t.budget}€
                  </Text>
                  <Text style={[s.tableCell, s.colDesc]}>{t.desc}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 3. ROI estimation */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>3. Retour sur investissement estimé</Text>

          <View style={{ marginBottom: 4 }}>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, s.colRoiTier]}>Forfait</Text>
              <Text style={[s.tableHeadCell, s.colLeads]}>Demandes/mois</Text>
              <Text style={[s.tableHeadCell, s.colSigned]}>Devis signés</Text>
              <Text style={[s.tableHeadCell, s.colRevenue]}>CA estimé/mois</Text>
            </View>
            {leadsData.map((ld, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text style={[s.tableCell, s.colRoiTier]}>{ld.label}</Text>
                <Text style={[s.tableCell, s.colLeads]}>{ld.leads}</Text>
                <Text style={[s.tableCell, s.colSigned]}>{ld.signedDevis}</Text>
                <Text style={[s.tableCell, s.colRevenue, { fontWeight: 700, color: C.green }]}>
                  {fmt(ld.revenueMensuel)}€
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 6.5, color: C.light, marginBottom: 12 }}>
            Estimations basées sur le taux de conversion du secteur "{report.metier}" et un panier moyen de {leadsData[0]?.panier ?? 500}€ HT.
          </Text>

          {/* 4. Nouveau classement estimé */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>4. Votre nouveau classement estimé</Text>
          <Text style={{ fontSize: 8, color: C.muted, marginBottom: 8 }}>
            Un site web ajoute +20 points à votre score GBP. Les Google Ads boostent votre visibilité.
          </Text>

          <View style={s.projRow}>
            {tiers.map((tier, i) => {
              const bonus = adsBonus[tier.key] ?? 10;
              const est = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, bonus);
              const isTop3 = est.newRank <= 3;
              const gain = prospectRank - est.newRank;
              return (
                <View
                  key={i}
                  style={[
                    s.projCard,
                    {
                      backgroundColor: isTop3 ? C.greenBg : C.violetBg,
                      borderColor: isTop3 ? C.green : C.violetBg2,
                    },
                  ]}
                  wrap={false}
                >
                  <Text style={s.projTier}>Site + {tier.label}</Text>
                  <View style={s.projRankRow}>
                    <Text style={s.projOldRank}>#{prospectRank}</Text>
                    <Text style={s.projArrow}>→</Text>
                    <Text style={[s.projNewRank, { color: isTop3 ? C.green : C.violet }]}>
                      #{est.newRank}
                    </Text>
                    <Text style={s.projTotal}>/{est.total}</Text>
                  </View>
                  <Text style={s.projScore}>
                    Score: {prospectScore} → {est.newScore}/100
                  </Text>
                  {gain > 0 && (
                    <Text style={s.projGain}>
                      ▲ {gain} place{gain > 1 ? "s" : ""} gagnée{gain > 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* 5. Récapitulatif */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>5. Récapitulatif tarifaire</Text>

          <View style={{ marginBottom: 6 }}>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, s.colFormule]}>Formule</Text>
              <Text style={[s.tableHeadCell, s.colCreation]}>Création</Text>
              <Text style={[s.tableHeadCell, s.colMensuel]}>Total/mois</Text>
              <Text style={[s.tableHeadCell, s.colRangEst]}>Rang est.</Text>
              <Text style={[s.tableHeadCell, s.colCaEst]}>CA est./mois</Text>
            </View>
            {tiers.map((tier, i) => {
              const ld = leadsData.find((l) => l.key === tier.key);
              const bonus = adsBonus[tier.key] ?? 10;
              const est = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, bonus);
              return (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                  <Text style={[s.tableCell, s.colFormule]}>Site + {tier.label}</Text>
                  <Text style={[s.tableCell, s.colCreation]}>299€</Text>
                  <Text style={[s.tableCell, s.colMensuel, { fontWeight: 700, color: C.violet }]}>
                    {29 + tier.budget}€/mois
                  </Text>
                  <Text style={[s.tableCell, s.colRangEst, { fontWeight: 700, color: C.green }]}>
                    #{est.newRank}/{est.total}
                  </Text>
                  <Text style={[s.tableCell, s.colCaEst, { fontWeight: 700, color: C.green }]}>
                    {fmt(ld?.revenueMensuel ?? 0)}€
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Conditions */}
          <View style={s.condBlock}>
            <Text style={s.condTitle}>Conditions</Text>
            <Text style={s.condItem}>
              ◆ Devis {devNum} valable 30 jours — Paiement site : 50% à la commande, 50% à la livraison
            </Text>
            <Text style={s.condItem}>
              ◆ Délai de réalisation site vitrine : 2 à 3 semaines
            </Text>
            <Text style={s.condItem}>
              ◆ Google Ads : engagement minimum 3 mois, résiliable ensuite avec préavis 30 jours
            </Text>
            <Text style={s.condItem}>
              ◆ Maintenance mensuelle sans engagement, résiliable à tout moment
            </Text>
          </View>

          {/* Signature */}
          <View style={s.sigRow}>
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>Le prestataire</Text>
              <Text style={s.sigName}> </Text>
              <View style={s.sigLine} />
              <Text style={s.sigCaption}>Date et signature</Text>
            </View>
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>Le client</Text>
              <Text style={s.sigName}>{prospectName}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigCaption}>Lu et approuvé — Date et signature</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerP2}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
}
