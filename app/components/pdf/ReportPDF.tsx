import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CompetitorResult } from "../../lib/types";
import { estimateAdsTiers, estimateLeadsPerTier } from "../../lib/competitor-config";
import type { ReportData, DemoQr } from "../../lib/generateReport";

export type { ReportData };

/* ── Helvetica (built-in) ── */
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica", fontWeight: 400 },
    { src: "Helvetica-Bold", fontWeight: 700 },
  ],
});

/* ── Design tokens — 1 accent (violet), vert = gains, rose = douleur ── */
const C = {
  ink: "#0c0b1d",
  inkSoft: "#171532",
  violet: "#7c3aed",
  fuchsia: "#c026d3",
  violetMuted: "#a78bfa",
  violetBg: "#f5f3ff",
  green: "#10b981",
  greenDark: "#047857",
  greenBg: "#ecfdf5",
  amber: "#f59e0b",
  rose: "#f43f5e",
  roseBg: "#fff1f2",
  text: "#1e1e2e",
  muted: "#6b7280",
  light: "#9ca3af",
  border: "#e5e7eb",
  white: "#ffffff",
  bg: "#fafafe",
};

const PAGE_W = 595; // A4 pt

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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

const SCENARIO_LABELS: Record<string, string> = {
  eco: "Prudent",
  performance: "Équilibré",
  top1: "Ambitieux",
};

/* ── Décor de bandeau sombre : dégradé + cercles discrets ── */
function HeroBackdrop({ height }: { height: number }) {
  return (
    <Svg width={PAGE_W} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.ink} />
          <Stop offset="0.65" stopColor={C.inkSoft} />
          <Stop offset="1" stopColor="#241a45" />
        </LinearGradient>
        <LinearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={C.violet} />
          <Stop offset="1" stopColor={C.fuchsia} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={PAGE_W} height={height} fill="url(#heroGrad)" />
      <Circle cx={520} cy={18} r={110} stroke={C.violet} strokeWidth={1} opacity={0.35} fill="none" />
      <Circle cx={520} cy={18} r={70} stroke={C.fuchsia} strokeWidth={1} opacity={0.25} fill="none" />
      <Circle cx={36} cy={height - 6} r={90} stroke={C.violet} strokeWidth={1} opacity={0.18} fill="none" />
      <Rect x={0} y={height - 4} width={PAGE_W} height={4} fill="url(#accentGrad)" />
    </Svg>
  );
}

/* ── Barre de score (jauge horizontale) ── */
function ScoreBar({ value, color, width = 90, height = 5 }: { value: number; color: string; width?: number; height?: number }) {
  return (
    <View style={{ width, height, backgroundColor: "#ececf4", borderRadius: height / 2 }}>
      <View style={{ width: Math.max(3, (Math.min(value, 100) / 100) * width), height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */
const s = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", fontSize: 9, color: C.text, backgroundColor: C.white },

  hero: { position: "relative", paddingTop: 34, paddingBottom: 26, paddingHorizontal: 40 },
  kicker: { fontSize: 8, fontWeight: 700, color: C.violetMuted, letterSpacing: 2.4, marginBottom: 10 },
  heroTitle: { fontSize: 30, fontWeight: 700, color: C.white, letterSpacing: -0.4, lineHeight: 1.05 },
  heroSub: { fontSize: 11, color: "#c9c5ec", marginTop: 8, lineHeight: 1.5, maxWidth: 420 },
  heroMeta: { fontSize: 7.5, color: "#7d7aa8", marginTop: 12, letterSpacing: 0.8 },

  content: { paddingHorizontal: 40, paddingTop: 20 },

  sectionKicker: { fontSize: 7, fontWeight: 700, color: C.violet, letterSpacing: 2, marginBottom: 3 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10, letterSpacing: -0.2 },

  /* Stat cards */
  cardsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  card: { flex: 1, backgroundColor: C.bg, borderRadius: 8, padding: 13, borderWidth: 1, borderColor: C.border },
  cardLabel: { fontSize: 6.5, fontWeight: 700, color: C.muted, letterSpacing: 1.4, marginBottom: 5 },
  cardValue: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5 },
  cardSub: { fontSize: 7.5, color: C.muted, marginTop: 3, lineHeight: 1.35 },

  /* Constat (douleur) */
  pain: { backgroundColor: C.roseBg, borderLeftWidth: 3, borderLeftColor: C.rose, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  painText: { fontSize: 9.5, color: "#9f1239", lineHeight: 1.5, fontWeight: 700 },

  /* Table */
  tableHead: { flexDirection: "row", alignItems: "center", backgroundColor: C.ink, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 2 },
  tableHeadCell: { fontSize: 7, fontWeight: 700, color: "#b9b5e0", letterSpacing: 0.8 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5.5, paddingHorizontal: 8, borderBottomWidth: 0.4, borderBottomColor: C.border },
  tableRowYou: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 8, backgroundColor: C.violetBg, borderRadius: 5, borderWidth: 1, borderColor: C.violet },
  tableCell: { fontSize: 8.5, color: C.text },

  colRank: { width: 22, textAlign: "center" },
  colName: { flex: 1, paddingRight: 6 },
  colRating: { width: 34, textAlign: "center" },
  colReviews: { width: 30, textAlign: "center" },
  colSite: { width: 26, textAlign: "center" },
  colScoreNum: { width: 24, textAlign: "right", paddingRight: 4 },
  colScoreBar: { width: 64 },

  youTag: { fontSize: 6.5, fontWeight: 700, color: C.white, backgroundColor: C.violet, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1.5, marginLeft: 5 },

  /* Footer */
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.ink, paddingVertical: 7, paddingHorizontal: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: "#7d7aa8", letterSpacing: 0.6 },

  /* ══ Page 2 ══ */
  baRow: { flexDirection: "row", alignItems: "stretch", gap: 12, marginBottom: 18 },
  baCard: { flex: 1, borderRadius: 10, padding: 16, borderWidth: 1 },
  baLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 2, marginBottom: 8 },
  baRank: { fontSize: 38, fontWeight: 700, lineHeight: 1, letterSpacing: -1 },
  baTotal: { fontSize: 8.5, color: C.muted, marginTop: 4 },
  baCaption: { fontSize: 8, marginTop: 10, lineHeight: 1.5 },
  baArrowBox: { justifyContent: "center", alignItems: "center", width: 24 },
  baArrow: { fontSize: 20, color: C.violet, fontWeight: 700 },

  /* Scénarios */
  scRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 0.4, borderBottomColor: C.border },
  scRowStar: { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 10, backgroundColor: C.greenBg, borderRadius: 6, borderWidth: 1, borderColor: C.green },
  colScenario: { width: 78 },
  colMid: { width: 92, textAlign: "center" },
  colCa: { flex: 1, textAlign: "right" },
  scName: { fontSize: 9, fontWeight: 700, color: C.text },
  scMid: { fontSize: 9, color: C.text },
  scCa: { fontSize: 11, fontWeight: 700, color: C.green },
  scCaStar: { fontSize: 13, fontWeight: 700, color: C.greenDark },
  scNote: { fontSize: 6.5, color: C.light, marginTop: 5, marginBottom: 14 },

  /* Bloc démo (pièce maîtresse) */
  demoBox: { position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  demoInner: { flexDirection: "row", alignItems: "center", padding: 18 },
  demoTextBlock: { flex: 1, paddingRight: 16 },
  demoKicker: { fontSize: 7, fontWeight: 700, color: C.violetMuted, letterSpacing: 2.2, marginBottom: 6 },
  demoTitle: { fontSize: 19, fontWeight: 700, color: C.white, marginBottom: 7, letterSpacing: -0.3 },
  demoBody: { fontSize: 8.5, color: "#c9c5ec", lineHeight: 1.55 },
  demoUrl: { fontSize: 8.5, fontWeight: 700, color: C.white, marginTop: 9 },
  demoQrBox: { backgroundColor: C.white, borderRadius: 9, padding: 7 },
  demoQr: { width: 92, height: 92 },
  demoQrCaption: { fontSize: 7, fontWeight: 700, color: C.violetMuted, textAlign: "center", marginTop: 5, letterSpacing: 1 },

  /* Étapes */
  stepsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  stepCard: { flex: 1 },
  stepNumRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  stepNumBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 8.5, fontWeight: 700, color: C.white },
  stepTitle: { fontSize: 8.5, fontWeight: 700, color: C.ink },
  stepBody: { fontSize: 7.5, color: C.muted, lineHeight: 1.45, paddingLeft: 21 },

  /* CTA final */
  cta: { position: "relative", borderRadius: 10, overflow: "hidden" },
  ctaInner: { paddingVertical: 16, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ctaTitle: { fontSize: 13, fontWeight: 700, color: C.white, letterSpacing: -0.2 },
  ctaSub: { fontSize: 8, color: "#e9d5ff", marginTop: 3 },
  ctaPhone: { fontSize: 17, fontWeight: 700, color: C.white, letterSpacing: 0.5 },
});

/* ═══════════════════════ COMPONENT ═══════════════════════ */
export function ReportPDF({ data, demo }: { data: ReportData; demo?: DemoQr | null }) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const tiers = report.ads_tiers ?? estimateAdsTiers(report.metier);
  const leadsData = estimateLeadsPerTier(report.metier);
  const nmfPhone = process.env.NEXT_PUBLIC_NMF_PHONE ?? "";

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
  const withSite = report.competitors.filter((c) => c.website).length;

  const SITE_BONUS = 20;
  const adsBonus: Record<string, number> = { eco: 5, performance: 10, top1: 15 };
  const best = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, adsBonus.top1 ?? 15);

  // Tableau resserré : top 8 + la ligne du prospect si elle est plus bas.
  const youIdx = merged.findIndex((c) => c.name.toLowerCase() === prospectName.toLowerCase());
  const tableRows = merged.slice(0, 8);
  const youBeyond = youIdx >= 8 ? merged[youIdx] : null;

  const bestScenario = leadsData[leadsData.length - 1];

  return (
    <Document title={`Projet ${prospectName}`} author="NMF Agence">

      {/* ════════ PAGE 1 — Le constat ════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.hero}>
          <HeroBackdrop height={172} />
          <Text style={s.kicker}>ANALYSE CONFIDENTIELLE · {report.ville.toUpperCase()}</Text>
          <Text style={s.heroTitle}>{prospectName}</Text>
          <Text style={s.heroSub}>
            Ce que voient vraiment vos futurs clients quand ils cherchent un {report.metier} à {report.ville} — et ce que vous pourriez leur montrer.
          </Text>
          <Text style={s.heroMeta}>{cap(report.metier)} · {report.ville} · {fmtDate(report.created_at)} · préparé par NMF Agence</Text>
        </View>

        <View style={s.content}>
          {/* 3 stats */}
          <View style={s.cardsRow}>
            <View style={s.card}>
              <Text style={s.cardLabel}>VOTRE POSITION</Text>
              <Text style={[s.cardValue, { color: scoreColor(prospectScore) }]}>#{prospectRank}</Text>
              <Text style={s.cardSub}>sur {totalCompetitors} {report.metier}s visibles dans votre zone</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>VOTRE SCORE DE VISIBILITÉ</Text>
              <Text style={[s.cardValue, { color: scoreColor(prospectScore) }]}>{prospectScore}<Text style={{ fontSize: 11, color: C.light }}> /100</Text></Text>
              <View style={{ marginTop: 6 }}>
                <ScoreBar value={prospectScore} color={scoreColor(prospectScore)} width={120} />
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>LA CONCURRENCE</Text>
              <Text style={[s.cardValue, { color: C.violet }]}>{withSite}<Text style={{ fontSize: 11, color: C.light }}> /{report.competitors.length}</Text></Text>
              <Text style={s.cardSub}>concurrents ont déjà un site web qui capte vos clients</Text>
            </View>
          </View>

          {/* Constat douleur */}
          <View style={s.pain}>
            <Text style={s.painText}>
              Chaque jour, des habitants de {report.ville} cherchent un {report.metier} sur Google.
              Aujourd&apos;hui, c&apos;est quelqu&apos;un d&apos;autre qu&apos;ils appellent.
            </Text>
          </View>

          {/* Classement */}
          <Text style={s.sectionKicker}>VOTRE MARCHÉ, EN UN COUP D&apos;ŒIL</Text>
          <Text style={s.sectionTitle}>Le classement local</Text>

          <View style={s.tableHead}>
            <Text style={[s.tableHeadCell, s.colRank]}>#</Text>
            <Text style={[s.tableHeadCell, s.colName]}>ENTREPRISE</Text>
            <Text style={[s.tableHeadCell, s.colRating]}>NOTE</Text>
            <Text style={[s.tableHeadCell, s.colReviews]}>AVIS</Text>
            <Text style={[s.tableHeadCell, s.colSite]}>SITE</Text>
            <Text style={[s.tableHeadCell, s.colScoreNum]}> </Text>
            <Text style={[s.tableHeadCell, s.colScoreBar]}>SCORE</Text>
          </View>

          {tableRows.map((c, i) => {
            const isYou = c.name.toLowerCase() === prospectName.toLowerCase();
            return (
              <View key={i} style={isYou ? s.tableRowYou : s.tableRow} wrap={false}>
                <Text style={[s.tableCell, s.colRank, isYou ? { fontWeight: 700, color: C.violet } : {}]}>{i + 1}</Text>
                <View style={[s.colName, { flexDirection: "row", alignItems: "center" }]}>
                  <Text style={[s.tableCell, isYou ? { fontWeight: 700, color: C.violet } : {}]} >{c.name}</Text>
                  {isYou && <Text style={s.youTag}>VOUS</Text>}
                </View>
                <Text style={[s.tableCell, s.colRating]}>{c.rating != null ? `${c.rating}` : "—"}</Text>
                <Text style={[s.tableCell, s.colReviews]}>{c.reviews ?? 0}</Text>
                <Text style={[s.tableCell, s.colSite, { color: c.website ? C.green : C.rose, fontWeight: 700 }]}>{c.website ? "✓" : "✗"}</Text>
                <Text style={[s.tableCell, s.colScoreNum, { fontWeight: 700, color: scoreColor(c.gbp_score) }]}>{c.gbp_score}</Text>
                <View style={s.colScoreBar}>
                  <ScoreBar value={c.gbp_score} color={scoreColor(c.gbp_score)} width={60} height={4.5} />
                </View>
              </View>
            );
          })}
          {youBeyond && (
            <View style={[s.tableRowYou, { marginTop: 3 }]} wrap={false}>
              <Text style={[s.tableCell, s.colRank, { fontWeight: 700, color: C.violet }]}>{youIdx + 1}</Text>
              <View style={[s.colName, { flexDirection: "row", alignItems: "center" }]}>
                <Text style={[s.tableCell, { fontWeight: 700, color: C.violet }]}>{youBeyond.name}</Text>
                <Text style={s.youTag}>VOUS</Text>
              </View>
              <Text style={[s.tableCell, s.colRating]}>{youBeyond.rating ?? "—"}</Text>
              <Text style={[s.tableCell, s.colReviews]}>{youBeyond.reviews ?? 0}</Text>
              <Text style={[s.tableCell, s.colSite, { color: youBeyond.website ? C.green : C.rose, fontWeight: 700 }]}>{youBeyond.website ? "✓" : "✗"}</Text>
              <Text style={[s.tableCell, s.colScoreNum, { fontWeight: 700, color: scoreColor(youBeyond.gbp_score) }]}>{youBeyond.gbp_score}</Text>
              <View style={s.colScoreBar}>
                <ScoreBar value={youBeyond.gbp_score} color={scoreColor(youBeyond.gbp_score)} width={60} height={4.5} />
              </View>
            </View>
          )}

          {/* Transition vers la page 2 */}
          <View style={{ marginTop: 18, alignItems: "center" }}>
            <Text style={{ fontSize: 9, color: C.muted }}>
              La bonne nouvelle ? Tout ça se change. <Text style={{ fontWeight: 700, color: C.violet }}>Tournez la page →</Text>
            </Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>ANALYSE — {prospectName.toUpperCase()} — {report.ville.toUpperCase()}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ════════ PAGE 2 — Le rêve ════════ */}
      <Page size="A4" style={s.page}>
        <View style={[s.hero, { paddingTop: 28, paddingBottom: 20 }]}>
          <HeroBackdrop height={118} />
          <Text style={s.kicker}>VOTRE PROJET · {report.ville.toUpperCase()}</Text>
          <Text style={[s.heroTitle, { fontSize: 24 }]}>Imaginez dans 30 jours.</Text>
          <Text style={[s.heroSub, { marginTop: 5 }]}>
            Quelqu&apos;un tape « {report.metier} {report.ville} » — et c&apos;est vous qu&apos;il trouve.
          </Text>
        </View>

        <View style={s.content}>
          {/* Avant / Après */}
          <View style={s.baRow}>
            <View style={[s.baCard, { backgroundColor: C.bg, borderColor: C.border }]}>
              <Text style={[s.baLabel, { color: C.muted }]}>AUJOURD&apos;HUI</Text>
              <Text style={[s.baRank, { color: scoreColor(prospectScore) }]}>#{prospectRank}</Text>
              <Text style={s.baTotal}>sur {totalCompetitors} · score {prospectScore}/100</Text>
              <Text style={[s.baCaption, { color: C.muted }]}>
                On vous trouve si on vous connaît déjà. Les nouveaux clients, eux, appellent vos concurrents.
              </Text>
            </View>
            <View style={s.baArrowBox}><Text style={s.baArrow}>→</Text></View>
            <View style={[s.baCard, { backgroundColor: C.greenBg, borderColor: C.green }]}>
              <Text style={[s.baLabel, { color: C.greenDark }]}>DEMAIN</Text>
              <Text style={[s.baRank, { color: C.green }]}>#{best.newRank}</Text>
              <Text style={s.baTotal}>score {prospectScore} → {best.newScore}/100</Text>
              <Text style={[s.baCaption, { color: C.greenDark, fontWeight: 700 }]}>
                Site professionnel + visibilité Google : vous devenez le réflexe local.
              </Text>
            </View>
          </View>

          {/* Gains */}
          <Text style={s.sectionKicker}>CE QUE ÇA CHANGE, CONCRÈTEMENT</Text>
          <Text style={s.sectionTitle}>Trois trajectoires possibles</Text>

          <View style={s.tableHead}>
            <Text style={[s.tableHeadCell, s.colScenario]}>SCÉNARIO</Text>
            <Text style={[s.tableHeadCell, s.colMid]}>DEMANDES / MOIS</Text>
            <Text style={[s.tableHeadCell, s.colMid]}>CHANTIERS SIGNÉS</Text>
            <Text style={[s.tableHeadCell, s.colCa]}>CHIFFRE D&apos;AFFAIRES POTENTIEL</Text>
          </View>
          {leadsData.map((ld, i) => {
            const star = i === leadsData.length - 1;
            return (
              <View key={i} style={star ? s.scRowStar : s.scRow} wrap={false}>
                <Text style={[s.scName, s.colScenario, star ? { color: C.greenDark } : {}]}>
                  {SCENARIO_LABELS[ld.key] ?? ld.label}{star ? " ★" : ""}
                </Text>
                <Text style={[s.scMid, s.colMid]}>{ld.leads}</Text>
                <Text style={[s.scMid, s.colMid]}>{ld.signedDevis}</Text>
                <Text style={[star ? s.scCaStar : s.scCa, s.colCa]}>+{fmt(ld.revenueMensuel)} € / mois</Text>
              </View>
            );
          })}
          <Text style={s.scNote}>
            Estimations prudentes : taux de conversion du secteur « {report.metier} », panier moyen {fmt(bestScenario?.panier ?? 500)} € HT par chantier.
            Un seul chantier suffit généralement à rentabiliser l&apos;ensemble.
          </Text>

          {/* Pièce maîtresse : la démo + QR */}
          {demo && (
            <View style={s.demoBox} wrap={false}>
              <Svg width={PAGE_W - 80} height={132} style={{ position: "absolute", top: 0, left: 0 }}>
                <Defs>
                  <LinearGradient id="demoGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={C.ink} />
                    <Stop offset="1" stopColor="#2a1a52" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={PAGE_W - 80} height={132} fill="url(#demoGrad)" />
                <Circle cx={PAGE_W - 200} cy={66} r={86} stroke={C.violet} strokeWidth={1} opacity={0.3} fill="none" />
              </Svg>
              <View style={s.demoInner}>
                <View style={s.demoTextBlock}>
                  <Text style={s.demoKicker}>CE N&apos;EST PAS UNE PROMESSE</Text>
                  <Text style={s.demoTitle}>Votre site existe déjà.</Text>
                  <Text style={s.demoBody}>
                    Nous l&apos;avons créé pour {prospectName} : vos avis Google, vos services, votre téléphone.
                    Scannez — il est en ligne, et tout est personnalisable à votre demande.
                  </Text>
                  <Text style={s.demoUrl}>{demo.url.replace(/^https?:\/\//, "")}</Text>
                </View>
                <View>
                  <View style={s.demoQrBox}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={demo.qr} style={s.demoQr} />
                  </View>
                  <Text style={s.demoQrCaption}>SCANNEZ-MOI</Text>
                </View>
              </View>
            </View>
          )}

          {/* Étapes */}
          <View style={s.stepsRow}>
            {[
              { n: "1", t: "Regardez votre site", b: "Scannez le code : il est déjà en ligne, à vos couleurs." },
              { n: "2", t: "On le personnalise", b: "Textes, photos, couleurs — dites-nous, on s'occupe de tout." },
              { n: "3", t: "Les clients arrivent", b: `${report.ville} découvre le ${report.metier} qu'il fallait appeler.` },
            ].map((st) => (
              <View key={st.n} style={s.stepCard}>
                <View style={s.stepNumRow}>
                  <View style={s.stepNumBadge}><Text style={s.stepNumText}>{st.n}</Text></View>
                  <Text style={s.stepTitle}>{st.t}</Text>
                </View>
                <Text style={s.stepBody}>{st.b}</Text>
              </View>
            ))}
          </View>

          {/* CTA unique */}
          <View style={s.cta} wrap={false}>
            <Svg width={PAGE_W - 80} height={58} style={{ position: "absolute", top: 0, left: 0 }}>
              <Defs>
                <LinearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={C.violet} />
                  <Stop offset="1" stopColor={C.fuchsia} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={PAGE_W - 80} height={58} fill="url(#ctaGrad)" />
            </Svg>
            <View style={s.ctaInner}>
              <View>
                <Text style={s.ctaTitle}>Votre place en haut de Google est encore libre.</Text>
                <Text style={s.ctaSub}>NMF Agence · www.nmf-agence.com · sans engagement</Text>
              </View>
              <Text style={s.ctaPhone}>{nmfPhone || "nmf-agence.com"}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>PROJET — {prospectName.toUpperCase()} — {fmtDate().toUpperCase()}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
