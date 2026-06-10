import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CompetitorResult } from "../../lib/types";
import { estimateAdsTiers, estimateLeadsPerTier } from "../../lib/competitor-config";
import { generateSalesArgs } from "../../lib/gbp";
import type { ReportData, DemoQr } from "../../lib/generateReport";

export type { ReportData };

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
  greenDark: "#047857",
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

/** Libellés "rêve" des 3 scénarios (remplacent les forfaits chiffrés). */
const SCENARIO_LABELS: Record<string, string> = {
  eco: "Prudent",
  performance: "Équilibré",
  top1: "Ambitieux",
};

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

  /* ══ PAGE 2 — Projection (zéro prix : on vend la destination) ══ */

  /* Avant / Après */
  baRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 18,
  },
  baCard: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
  },
  baLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  baRank: {
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 1,
  },
  baTotal: {
    fontSize: 9,
    color: C.muted,
    marginTop: 2,
  },
  baCaption: {
    fontSize: 7.5,
    marginTop: 8,
    lineHeight: 1.4,
  },
  baArrowBox: {
    justifyContent: "center",
    alignItems: "center",
    width: 26,
  },
  baArrow: {
    fontSize: 18,
    color: C.violet,
    fontWeight: 700,
  },

  /* Scénarios (gains, pas de budgets) */
  colScenario: { width: 64, fontWeight: 700 },
  colLeads: { width: 64, textAlign: "center" },
  colSigned: { width: 64, textAlign: "center" },
  colRevenue: { flex: 1, textAlign: "right" },

  /* Projection cards */
  projRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
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

  /* "Votre site est déjà prêt" + QR */
  demoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.ink,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  demoTextBlock: {
    flex: 1,
    paddingRight: 14,
  },
  demoKicker: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.violetMuted,
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.white,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  demoBody: {
    fontSize: 8.5,
    color: "#b9b9d6",
    lineHeight: 1.5,
  },
  demoUrl: {
    fontSize: 8,
    color: C.violetMuted,
    marginTop: 7,
  },
  demoQrBox: {
    backgroundColor: C.white,
    borderRadius: 8,
    padding: 6,
  },
  demoQr: {
    width: 84,
    height: 84,
  },
  demoQrCaption: {
    fontSize: 6.5,
    color: C.muted,
    textAlign: "center",
    marginTop: 3,
  },

  /* Étapes */
  stepsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  stepCard: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 6,
    padding: 10,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  stepNum: {
    fontSize: 16,
    fontWeight: 700,
    color: C.violet,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: C.text,
    marginBottom: 3,
  },
  stepBody: {
    fontSize: 7.5,
    color: C.muted,
    lineHeight: 1.4,
  },

  /* CTA final */
  ctaBox: {
    backgroundColor: C.violetBg,
    borderWidth: 1,
    borderColor: C.violet,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ctaText: {
    fontSize: 10,
    fontWeight: 700,
    color: C.text,
  },
  ctaSub: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 2,
  },
  ctaPhone: {
    fontSize: 14,
    fontWeight: 700,
    color: C.violet,
  },
});

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function ReportPDF({ data, demo }: { data: ReportData; demo?: DemoQr | null }) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const tiers = report.ads_tiers ?? estimateAdsTiers(report.metier);
  const leadsData = estimateLeadsPerTier(report.metier);
  const dateStr = fmtDate(report.created_at);
  const nmfPhone = process.env.NEXT_PUBLIC_NMF_PHONE ?? "";

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

  // Pas de budget passé : l'argument « budget Ads moyen X€/mois » est un prix, il dégage.
  const salesArgs = generateSalesArgs(prospectName, prospectScore, report.competitors, null);

  // Meilleur scénario pour le « Demain » de l'avant/après.
  const best = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, adsBonus.top1 ?? 15);

  const footerP1 = `Analyse — ${prospectName} — ${report.metier} — ${report.ville}`;
  const footerP2 = `Projet — ${prospectName} — ${report.ville} — ${fmtDate()}`;

  return (
    <Document title={`Projet ${prospectName}`} author="NMF Agence">

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
          PAGE 2 — Votre projet (la destination, pas la facture)
          ═══════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAccent} />
          <Text style={s.headerTitle}>Votre Projet</Text>
          <Text style={s.headerSub}>{prospectName} — bientôt le réflexe local</Text>
          <Text style={s.headerMeta}>{report.metier} · {report.ville} · {fmtDate()}</Text>
        </View>
        <View style={s.headerLine} />

        <View style={s.content}>
          {/* Avant / Après */}
          <View style={s.baRow}>
            <View style={[s.baCard, { backgroundColor: C.bg, borderColor: C.border }]}>
              <Text style={[s.baLabel, { color: C.muted }]}>AUJOURD&apos;HUI</Text>
              <Text style={[s.baRank, { color: scoreColor(prospectScore) }]}>#{prospectRank}</Text>
              <Text style={s.baTotal}>sur {totalCompetitors} dans votre zone</Text>
              <Text style={[s.baCaption, { color: C.muted }]}>
                Les clients qui cherchent un {report.metier} à {report.ville} trouvent vos concurrents avant vous.
              </Text>
            </View>
            <View style={s.baArrowBox}>
              <Text style={s.baArrow}>→</Text>
            </View>
            <View style={[s.baCard, { backgroundColor: C.greenBg, borderColor: C.green }]}>
              <Text style={[s.baLabel, { color: C.greenDark }]}>DEMAIN</Text>
              <Text style={[s.baRank, { color: C.green }]}>#{best.newRank}</Text>
              <Text style={s.baTotal}>score {prospectScore} → {best.newScore}/100</Text>
              <Text style={[s.baCaption, { color: C.greenDark }]}>
                Site professionnel + visibilité Google : c&apos;est vous qu&apos;on trouve, c&apos;est vous qu&apos;on appelle.
              </Text>
            </View>
          </View>

          {/* Ce que ça change */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>Ce que ça change, concrètement</Text>

          <View style={{ marginBottom: 4 }}>
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, s.colScenario]}>Scénario</Text>
              <Text style={[s.tableHeadCell, s.colLeads]}>Demandes/mois</Text>
              <Text style={[s.tableHeadCell, s.colSigned]}>Chantiers signés</Text>
              <Text style={[s.tableHeadCell, s.colRevenue]}>Chiffre d&apos;affaires potentiel</Text>
            </View>
            {leadsData.map((ld, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text style={[s.tableCell, s.colScenario]}>{SCENARIO_LABELS[ld.key] ?? ld.label}</Text>
                <Text style={[s.tableCell, s.colLeads]}>{ld.leads}</Text>
                <Text style={[s.tableCell, s.colSigned]}>{ld.signedDevis}</Text>
                <Text style={[s.tableCell, s.colRevenue, { fontWeight: 700, color: C.green }]}>
                  +{fmt(ld.revenueMensuel)}€ / mois
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 6.5, color: C.light, marginBottom: 14 }}>
            Estimations basées sur le taux de conversion du secteur « {report.metier} » et un panier moyen de {leadsData[0]?.panier ?? 500}€ HT par chantier.
          </Text>

          {/* Classement projeté */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>Votre classement projeté</Text>

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
                  <Text style={s.projTier}>Scénario {SCENARIO_LABELS[tier.key] ?? tier.label}</Text>
                  <View style={s.projRankRow}>
                    <Text style={s.projOldRank}>#{prospectRank}</Text>
                    <Text style={s.projArrow}>→</Text>
                    <Text style={[s.projNewRank, { color: isTop3 ? C.green : C.violet }]}>
                      #{est.newRank}
                    </Text>
                    <Text style={s.projTotal}>/{est.total}</Text>
                  </View>
                  <Text style={s.projScore}>
                    Score : {prospectScore} → {est.newScore}/100
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

          {/* Votre site est déjà prêt — QR vers la démo live */}
          {demo && (
            <View style={s.demoBox} wrap={false}>
              <View style={s.demoTextBlock}>
                <Text style={s.demoKicker}>CE N&apos;EST PAS UNE PROMESSE</Text>
                <Text style={s.demoTitle}>Votre site existe déjà.</Text>
                <Text style={s.demoBody}>
                  Nous avons pris la liberté de créer le site de {prospectName} : vos avis Google,
                  vos services, votre téléphone. Scannez le code et regardez-le — il est en ligne,
                  entièrement personnalisable à votre demande (textes, photos, couleurs).
                </Text>
                <Text style={s.demoUrl}>{demo.url.replace(/^https?:\/\//, "")}</Text>
              </View>
              <View>
                <View style={s.demoQrBox}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={demo.qr} style={s.demoQr} />
                </View>
                <Text style={[s.demoQrCaption, { color: "#b9b9d6" }]}>Scannez-moi</Text>
              </View>
            </View>
          )}

          {/* La suite, simplement */}
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>La suite, simplement</Text>
          <View style={s.stepsRow}>
            <View style={s.stepCard}>
              <Text style={s.stepNum}>1</Text>
              <Text style={s.stepTitle}>Regardez votre site</Text>
              <Text style={s.stepBody}>Scannez le code ci-dessus : il est déjà en ligne, à vos couleurs.</Text>
            </View>
            <View style={s.stepCard}>
              <Text style={s.stepNum}>2</Text>
              <Text style={s.stepTitle}>On le personnalise ensemble</Text>
              <Text style={s.stepBody}>Textes, photos, couleurs : dites-nous ce qu&apos;on change, on s&apos;occupe de tout.</Text>
            </View>
            <View style={s.stepCard}>
              <Text style={s.stepNum}>3</Text>
              <Text style={s.stepTitle}>Vos clients vous trouvent</Text>
              <Text style={s.stepBody}>Mise en ligne officielle — et {report.ville} découvre le {report.metier} qu&apos;il fallait appeler.</Text>
            </View>
          </View>

          {/* CTA */}
          <View style={s.ctaBox} wrap={false}>
            <View>
              <Text style={s.ctaText}>On en parle ?</Text>
              <Text style={s.ctaSub}>NMF Agence · www.nmf-agence.com · sans engagement</Text>
            </View>
            {nmfPhone ? <Text style={s.ctaPhone}>{nmfPhone}</Text> : <Text style={s.ctaPhone}>nmf-agence.com</Text>}
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
