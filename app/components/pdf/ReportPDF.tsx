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
  Path,
  Defs,
  LinearGradient,
  Stop,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { estimateLeadsPerTier } from "../../lib/competitor-config";
import type { CompetitorResult } from "../../lib/types";
import type { ReportData, DemoQr } from "../../lib/generateReport";
import { pdfThemeFor, type PdfTheme, type PdfAssets } from "./pdf-theme";

export type { ReportData };

/* ── Helvetica (built-in) ── */
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica", fontWeight: 400 },
    { src: "Helvetica-Bold", fontWeight: 700 },
  ],
});

/* ── Tokens neutres (page claire) ── */
const N = {
  ink: "#0f172a",
  text: "#1e293b",
  muted: "#64748b",
  light: "#94a3b8",
  border: "#e2e8f0",
  white: "#ffffff",
  pageBg: "#f7f9fc",
  green: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
};

const PAGE_W = 595; // A4 pt

function scoreColor(score: number): string {
  if (score >= 70) return N.green;
  if (score >= 40) return N.amber;
  return N.rose;
}

function fmt(n: number): string {
  // Helvetica (WinAnsi) n'a pas l'espace fine insécable U+202F des nombres fr-FR.
  return new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");
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

/* ═══════════════════════ ICÔNES (tracés lucide, 24×24) ═══════════════════════ */
const ICONS: Record<string, { d: string[]; c?: [number, number, number][] }> = {
  trophy: {
    d: [
      "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
      "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
      "M4 22h16",
      "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
      "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
      "M18 2H6v7a6 6 0 0 0 12 0V2Z",
    ],
  },
  eye: { d: ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"], c: [[12, 12, 3]] },
  users: {
    d: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
    c: [[9, 7, 4]],
  },
  pin: { d: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"], c: [[12, 10, 3]] },
  doc: { d: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v5h6", "M9 13h6", "M9 17h6"] },
};

function Icon({ name, color, size = 12 }: { name: keyof typeof ICONS; color: string; size?: number }) {
  const ic = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ic.d.map((p, i) => (
        <Path key={i} d={p} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {(ic.c ?? []).map(([cx, cy, r], i) => (
        <Circle key={`c${i}`} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={2} fill="none" />
      ))}
    </Svg>
  );
}

/* Icône signature du métier (goutte, feuille, éclair) */
const THEME_ICONS: Record<string, string[]> = {
  drop: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"],
  leaf: [
    "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z",
    "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12",
  ],
  zap: [
    "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  ],
};

function ThemeIcon({ icon, color, size = 22 }: { icon: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(THEME_ICONS[icon] ?? []).map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

function Star({ color, size = 11 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color} />
    </Svg>
  );
}

/* ── Barre de score (jauge horizontale) ── */
function ScoreBar({ value, color, track, width = 90, height = 4.5 }: { value: number; color: string; track: string; width?: number; height?: number }) {
  return (
    <View style={{ width, height, backgroundColor: track, borderRadius: height / 2 }}>
      <View style={{ width: Math.max(3, (Math.min(value, 100) / 100) * width), height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/* ── Décor de secours page 1 quand le métier n'a pas de photo ── */
function HeroDecor({ t }: { t: PdfTheme }) {
  return (
    <Svg width={PAGE_W} height={260} style={{ position: "absolute", top: 0, left: 0 }}>
      <Circle cx={520} cy={40} r={120} stroke={t.accent} strokeWidth={1} opacity={0.35} fill="none" />
      <Circle cx={520} cy={40} r={78} stroke={t.accentMuted} strokeWidth={1} opacity={0.25} fill="none" />
      <Circle cx={560} cy={210} r={60} stroke={t.accent} strokeWidth={1} opacity={0.18} fill="none" />
    </Svg>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */
function makeStyles(t: PdfTheme) {
  return StyleSheet.create({
    /* ══ Page 1 — sombre ══ */
    darkPage: { fontFamily: "Helvetica", fontSize: 9, color: N.white, backgroundColor: t.ink, paddingTop: 44, paddingHorizontal: 40 },
    kicker: { fontSize: 8, fontWeight: 700, color: t.accentMuted, letterSpacing: 2.4, marginBottom: 12 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    heroTitle: { fontSize: 31, fontWeight: 700, color: N.white, letterSpacing: -0.4, lineHeight: 1.05 },
    heroSub: { fontSize: 11, color: t.accentSoft, marginTop: 10, lineHeight: 1.55, maxWidth: 310 },
    heroMeta: { fontSize: 7.5, color: t.mutedOnDark, marginTop: 13, letterSpacing: 0.8 },

    /* Cartes stats sombres */
    cardsRow: { flexDirection: "row", gap: 11, marginTop: 28, marginBottom: 22 },
    card: { flex: 1, backgroundColor: t.card, borderRadius: 9, paddingVertical: 16, paddingHorizontal: 10, borderWidth: 1, borderColor: t.cardBorder, alignItems: "center" },
    cardLabel: { fontSize: 6.5, fontWeight: 700, color: t.accentMuted, letterSpacing: 1.3, marginBottom: 8, textAlign: "center" },
    cardValue: { fontSize: 25, fontWeight: 700, color: N.white, letterSpacing: -0.5, marginTop: 7 },
    cardUnit: { fontSize: 11, color: t.mutedOnDark },
    cardSub: { fontSize: 7, color: t.accentSoft, marginTop: 4, lineHeight: 1.4, textAlign: "center", opacity: 0.85 },

    /* Constat (douleur) */
    pain: { marginBottom: 22 },
    painLine1: { fontSize: 11, color: t.accentSoft, lineHeight: 1.55 },
    painLine2: { fontSize: 11, color: N.white, fontWeight: 700, lineHeight: 1.55 },

    /* Tableau sombre */
    sectionKickerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 },
    sectionKickerDark: { fontSize: 7.5, fontWeight: 700, color: t.accentMuted, letterSpacing: 1.8 },
    tableHead: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: t.cardBorder },
    tableHeadCell: { fontSize: 6.5, fontWeight: 700, color: t.mutedOnDark, letterSpacing: 0.9 },
    tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 9, borderBottomWidth: 0.4, borderBottomColor: t.cardBorder },
    tableRowYou: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 9, backgroundColor: t.youRow ?? t.accent, borderRadius: 6 },
    tableCell: { fontSize: 9, color: t.accentSoft },
    tableCellYou: { fontSize: 9, color: N.white, fontWeight: 700 },

    colRank: { width: 22, textAlign: "center" },
    colName: { flex: 1, paddingRight: 6 },
    colRating: { width: 36, textAlign: "center" },
    colReviews: { width: 32, textAlign: "center" },
    colSite: { width: 28, textAlign: "center" },
    colScoreNum: { width: 26, textAlign: "right", paddingRight: 5 },
    colScoreBar: { width: 60 },

    youTag: { fontSize: 6.5, fontWeight: 700, color: t.accent, backgroundColor: N.white, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1.5, marginLeft: 5 },

    transitionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 136 },
    transitionText: { fontSize: 10, color: t.accentSoft },
    transitionLink: { fontSize: 10, fontWeight: 700, color: N.white },

    footerDark: { position: "absolute", bottom: 11, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
    footerDarkText: { fontSize: 6.5, color: t.mutedOnDark, letterSpacing: 0.6 },

    /* ══ Page 2 — claire ══ */
    lightPage: { fontFamily: "Helvetica", fontSize: 9, color: N.text, backgroundColor: N.pageBg, paddingTop: 38, paddingHorizontal: 40, paddingBottom: 88 },
    kickerLight: { fontSize: 8, fontWeight: 700, color: t.accent, letterSpacing: 2.4, marginBottom: 10 },
    title2: { fontSize: 25, fontWeight: 700, color: N.ink, letterSpacing: -0.4 },
    sub2: { fontSize: 10.5, color: N.muted, marginTop: 7, lineHeight: 1.5, maxWidth: 330 },

    bodyRow: { flexDirection: "row", gap: 14, marginTop: 20 },
    leftCol: { flex: 1 },

    /* Avant / Après */
    baRow: { flexDirection: "row", alignItems: "stretch", gap: 10, marginBottom: 18 },
    baCard: { flex: 1, borderRadius: 10, padding: 14 },
    baToday: { backgroundColor: N.white, borderWidth: 1, borderColor: N.border },
    baTomorrow: { position: "relative", overflow: "hidden" },
    baLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 2, marginBottom: 7 },
    baRank: { fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: -1 },
    baTotal: { fontSize: 8, marginTop: 4 },
    baCaption: { fontSize: 7.5, marginTop: 8, lineHeight: 1.5 },
    baArrowBox: { justifyContent: "center", alignItems: "center", width: 30 },
    baArrowCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: t.ink, alignItems: "center", justifyContent: "center" },

    /* Trajectoires (grille 3 colonnes) */
    sectionKickerLightRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
    sectionKickerLight: { fontSize: 7.5, fontWeight: 700, color: N.ink, letterSpacing: 1.6 },
    sectionSubLight: { fontSize: 8.5, color: t.accent, marginBottom: 9 },
    grid: { flexDirection: "row", borderWidth: 1, borderColor: N.border, borderRadius: 9, overflow: "hidden", backgroundColor: N.white },
    gridCol: { flex: 1, borderRightWidth: 1, borderRightColor: N.border },
    gridColLast: { flex: 1 },
    gridHead: { paddingVertical: 8, alignItems: "center", borderBottomWidth: 1, borderBottomColor: N.border, backgroundColor: t.accentBg },
    gridHeadText: { fontSize: 7.5, fontWeight: 700, color: t.accent, letterSpacing: 1.4 },
    gridCell: { paddingVertical: 9, alignItems: "center", borderBottomWidth: 1, borderBottomColor: N.border },
    gridCellLast: { paddingVertical: 10, alignItems: "center" },
    gridValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    gridValue: { fontSize: 13, fontWeight: 700, color: N.ink },
    gridLabel: { fontSize: 6.5, color: N.muted, marginTop: 2 },
    gridEuro: { fontSize: 10, fontWeight: 700, color: t.accentDark },
    scNote: { fontSize: 6.5, color: N.light, marginTop: 7, lineHeight: 1.5 },

    /* Carte démo verticale (pièce maîtresse) */
    demoCard: { width: 150, backgroundColor: t.ink, borderRadius: 11, padding: 13 },
    demoKicker: { fontSize: 6.5, fontWeight: 700, color: t.accentMuted, letterSpacing: 1.6, lineHeight: 1.5 },
    demoTitle: { fontSize: 11.5, fontWeight: 700, color: N.white, marginTop: 6, letterSpacing: -0.2 },
    demoBody: { fontSize: 7, color: t.accentSoft, lineHeight: 1.55, marginTop: 6 },
    demoQrBox: { backgroundColor: N.white, borderRadius: 8, padding: 6, alignSelf: "center", marginTop: 11 },
    demoQr: { width: 100, height: 100 },
    demoUrl: { fontSize: 6.5, fontWeight: 700, color: t.accentSoft, textAlign: "center", marginTop: 8, lineHeight: 1.5 },

    /* Étapes */
    stepsRow: { flexDirection: "row", gap: 12, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: N.border },
    stepCard: { flex: 1 },
    stepNumRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
    stepNumBadge: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: t.ink, alignItems: "center", justifyContent: "center" },
    stepNumText: { fontSize: 8, fontWeight: 700, color: N.white },
    stepTitle: { fontSize: 8.5, fontWeight: 700, color: N.ink },
    stepBody: { fontSize: 7.5, color: N.muted, lineHeight: 1.45, paddingLeft: 20 },

    /* Bandeau final */
    band: { position: "absolute", bottom: 0, left: 0, right: 0, height: 66 },
    bandInner: { height: 66, flexDirection: "row", alignItems: "center", paddingHorizontal: 30 },
    bandIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentDark, alignItems: "center", justifyContent: "center", marginRight: 12 },
    bandTitle: { fontSize: 11.5, fontWeight: 700, color: N.white, letterSpacing: -0.2 },
    bandSub: { fontSize: 7.5, color: t.accentSoft, marginTop: 3 },
    bandRight: { fontSize: 12, fontWeight: 700, color: N.white, letterSpacing: 0.3 },
    pageNum2: { position: "absolute", bottom: 72, right: 40, fontSize: 6.5, color: N.light },
  });
}

/* ═══════════════════════ COMPONENT ═══════════════════════ */
export function ReportPDF({ data, demo, assets }: { data: ReportData; demo?: DemoQr | null; assets?: PdfAssets | null }) {
  const { report, prospectName, prospectScore, prospectRank } = data;
  const t = pdfThemeFor(report.metier);
  const s = makeStyles(t);
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
  const best = estimateNewRank(prospectScore, merged, prospectName, SITE_BONUS, 15);

  // Tableau resserré : top 8 + la ligne du prospect si elle est plus bas.
  const youIdx = merged.findIndex((c) => c.name.toLowerCase() === prospectName.toLowerCase());
  const tableRows = merged.slice(0, 8);
  const youBeyond = youIdx >= 8 ? merged[youIdx] : null;

  const bestScenario = leadsData[leadsData.length - 1];

  const heroW = 250;
  const heroH = 227;

  const renderRow = (c: CompetitorResult, rank: number) => {
    const isYou = c.name.toLowerCase() === prospectName.toLowerCase();
    const cell = isYou ? s.tableCellYou : s.tableCell;
    return (
      <View key={`${rank}-${c.name}`} style={isYou ? s.tableRowYou : s.tableRow} wrap={false}>
        <Text style={[cell, s.colRank]}>{rank}</Text>
        <View style={[s.colName, { flexDirection: "row", alignItems: "center" }]}>
          <Text style={cell}>{c.name}</Text>
          {isYou && <Text style={s.youTag}>VOUS</Text>}
        </View>
        <Text style={[cell, s.colRating]}>{c.rating != null ? `${c.rating}` : "—"}</Text>
        <Text style={[cell, s.colReviews]}>{c.reviews ?? 0}</Text>
        <Text style={[cell, s.colSite, isYou ? {} : { color: c.website ? t.accentSoft : t.mutedOnDark }]}>{c.website ? "✓" : "—"}</Text>
        <Text style={[cell, s.colScoreNum]}>{c.gbp_score}</Text>
        <View style={s.colScoreBar}>
          <ScoreBar value={c.gbp_score} color={isYou ? N.white : scoreColor(c.gbp_score)} track={isYou ? t.accentDark : t.cardBorder} width={60} height={4} />
        </View>
      </View>
    );
  };

  return (
    <Document title={`Projet ${prospectName}`} author="NMF Agence">

      {/* ════════ PAGE 1 — Le constat (page sombre) ════════ */}
      {/* wrap={false} : pages maquettées en hauteur fixe. Sans ça, la vague absolue
          en bottom:0 touche la limite de page et le moteur de pagination boucle à l'infini
          (gel du navigateur au clic sur « PDF »). */}
      <Page size="A4" style={s.darkPage} wrap={false}>
        {/* Photo héro fondue dans le fond, ou décor géométrique */}
        {assets?.hero ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={assets.hero} style={{ position: "absolute", top: 0, left: PAGE_W - heroW, width: heroW, height: heroH }} />
            <Svg width={heroW} height={heroH} style={{ position: "absolute", top: 0, left: PAGE_W - heroW }}>
              <Defs>
                <LinearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={t.ink} stopOpacity={1} />
                  <Stop offset="0.55" stopColor={t.ink} stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.55" stopColor={t.ink} stopOpacity={0} />
                  <Stop offset="1" stopColor={t.ink} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={heroW} height={heroH} fill="url(#fadeL)" />
              <Rect x={0} y={0} width={heroW} height={heroH} fill="url(#fadeB)" />
            </Svg>
          </>
        ) : (
          <HeroDecor t={t} />
        )}

        {/* Vague d'eau en bas de page */}
        {assets?.wave && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={assets.wave} style={{ position: "absolute", bottom: 0, left: 0, width: PAGE_W, height: 120 }} />
        )}

        <Text style={s.kicker}>ANALYSE CONFIDENTIELLE · {report.ville.toUpperCase()}</Text>
        <View style={s.titleRow}>
          <Text style={s.heroTitle}>{prospectName}</Text>
          {t.icon && <ThemeIcon icon={t.icon} color={t.accentSoft} size={24} />}
        </View>
        <Text style={s.heroSub}>
          Ce que voient vraiment vos futurs clients quand ils cherchent un {report.metier} à {report.ville} — et ce que vous pourriez leur montrer.
        </Text>
        <Text style={s.heroMeta}>{cap(report.metier)} · {report.ville} · {fmtDate(report.created_at)} · préparé par NMF Agence</Text>

        {/* 3 stats */}
        <View style={s.cardsRow}>
          <View style={s.card}>
            <Text style={s.cardLabel}>VOTRE POSITION</Text>
            <Icon name="trophy" color={N.amber} size={15} />
            <Text style={s.cardValue}>#{prospectRank}</Text>
            <Text style={s.cardSub}>sur {totalCompetitors} {report.metier}s visibles dans votre zone</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>VOTRE SCORE DE VISIBILITÉ</Text>
            <Icon name="eye" color={t.accentMuted} size={15} />
            <Text style={s.cardValue}>{prospectScore}<Text style={s.cardUnit}> /100</Text></Text>
            <View style={{ marginTop: 5 }}>
              <ScoreBar value={prospectScore} color={scoreColor(prospectScore)} track={t.cardBorder} width={100} />
            </View>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>LA CONCURRENCE</Text>
            <Icon name="users" color={t.accentMuted} size={15} />
            <Text style={s.cardValue}>{withSite}<Text style={s.cardUnit}> /{report.competitors.length}</Text></Text>
            <Text style={s.cardSub}>concurrents ont déjà un site web qui capte vos clients</Text>
          </View>
        </View>

        {/* Constat douleur */}
        <View style={s.pain}>
          <Text style={s.painLine1}>Chaque jour, des habitants de {report.ville} cherchent un {report.metier} sur Google.</Text>
          <Text style={s.painLine2}>Aujourd&apos;hui, c&apos;est quelqu&apos;un d&apos;autre qu&apos;ils appellent.</Text>
        </View>

        {/* Classement */}
        <View style={s.sectionKickerRow}>
          <Icon name="users" color={t.accentMuted} size={10} />
          <Text style={s.sectionKickerDark}>VOTRE MARCHÉ, EN UN COUP D&apos;ŒIL</Text>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.tableHeadCell, s.colRank]}>#</Text>
          <Text style={[s.tableHeadCell, s.colName]}>ENTREPRISE</Text>
          <Text style={[s.tableHeadCell, s.colRating]}>NOTE</Text>
          <Text style={[s.tableHeadCell, s.colReviews]}>AVIS</Text>
          <Text style={[s.tableHeadCell, s.colSite]}>SITE</Text>
          <Text style={[s.tableHeadCell, s.colScoreNum]}> </Text>
          <Text style={[s.tableHeadCell, s.colScoreBar]}>SCORE</Text>
        </View>

        {tableRows.map((c, i) => renderRow(c, i + 1))}
        {youBeyond && <View style={{ marginTop: 3 }}>{renderRow(youBeyond, youIdx + 1)}</View>}

        {/* Transition vers la page 2 — calée juste au-dessus de la vague */}
        <View style={{ flexGrow: 1 }} />
        <View style={s.transitionRow}>
          <Star color={N.amber} size={11} />
          <Text style={s.transitionText}>
            La bonne nouvelle ? Tout ça se change. <Text style={s.transitionLink}>Tournez la page ›</Text>
          </Text>
        </View>

        <View style={s.footerDark} fixed>
          <Text style={s.footerDarkText}>ANALYSE — {prospectName.toUpperCase()} — {report.ville.toUpperCase()}</Text>
          <Text style={s.footerDarkText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ════════ PAGE 2 — Le rêve (page claire) ════════ */}
      <Page size="A4" style={s.lightPage} wrap={false}>
        {/* Photo ronde qui déborde du coin supérieur droit */}
        {assets?.side && (
          <>
            <Svg width={220} height={220} style={{ position: "absolute", top: -40, left: PAGE_W - 200 }}>
              <Circle cx={104} cy={104} r={100} stroke={t.accentMuted} strokeWidth={1} opacity={0.5} fill="none" />
            </Svg>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={assets.side} style={{ position: "absolute", top: -32, left: PAGE_W - 168, width: 184, height: 184 }} />
          </>
        )}

        <Text style={s.kickerLight}>VOTRE PROJET · {report.ville.toUpperCase()}</Text>
        <Text style={s.title2}>Imaginez dans 30 jours.</Text>
        <Text style={s.sub2}>
          Quelqu&apos;un tape « {report.metier} {report.ville} » — et c&apos;est vous qu&apos;il trouve.
        </Text>

        <View style={s.bodyRow}>
          <View style={s.leftCol}>
            {/* Avant / Après */}
            <View style={s.baRow}>
              <View style={[s.baCard, s.baToday]}>
                <Text style={[s.baLabel, { color: N.muted }]}>AUJOURD&apos;HUI</Text>
                <Text style={[s.baRank, { color: N.ink }]}>#{prospectRank}</Text>
                <Text style={[s.baTotal, { color: N.muted }]}>sur {totalCompetitors} · score {prospectScore}/100</Text>
                <Text style={[s.baCaption, { color: N.muted }]}>
                  On vous trouve si on vous connaît déjà. Les nouveaux clients, eux, appellent vos concurrents.
                </Text>
              </View>
              <View style={s.baArrowBox}>
                <View style={s.baArrowCircle}>
                  <Svg width={13} height={13} viewBox="0 0 24 24">
                    <Path d="M5 12h14" stroke={N.white} strokeWidth={2.5} strokeLinecap="round" fill="none" />
                    <Path d="m13 5 7 7-7 7" stroke={N.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </View>
              </View>
              <View style={[s.baCard, s.baTomorrow]}>
                <Svg width={200} height={130} style={{ position: "absolute", top: 0, left: 0 }}>
                  <Defs>
                    <LinearGradient id="tomGrad" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={t.accent} />
                      <Stop offset="1" stopColor={t.accentDark} />
                    </LinearGradient>
                  </Defs>
                  <Rect x={0} y={0} width={200} height={130} fill="url(#tomGrad)" />
                </Svg>
                <Text style={[s.baLabel, { color: t.accentSoft }]}>DEMAIN</Text>
                <Text style={[s.baRank, { color: N.white }]}>#{best.newRank}</Text>
                <Text style={[s.baTotal, { color: t.accentSoft }]}>score {prospectScore} → {best.newScore}/100</Text>
                <Text style={[s.baCaption, { color: N.white }]}>
                  Site professionnel + visibilité Google : vous devenez le réflexe local.
                </Text>
              </View>
            </View>

            {/* Trajectoires */}
            <View style={s.sectionKickerLightRow}>
              <Icon name="users" color={t.accent} size={10} />
              <Text style={s.sectionKickerLight}>CE QUE ÇA CHANGE, CONCRÈTEMENT</Text>
            </View>
            <Text style={s.sectionSubLight}>Trois trajectoires possibles</Text>

            <View style={s.grid}>
              {leadsData.map((ld, i) => {
                const last = i === leadsData.length - 1;
                return (
                  <View key={ld.key} style={last ? s.gridColLast : s.gridCol}>
                    <View style={s.gridHead}>
                      <Text style={s.gridHeadText}>{(SCENARIO_LABELS[ld.key] ?? ld.label).toUpperCase()}</Text>
                    </View>
                    <View style={s.gridCell}>
                      <View style={s.gridValueRow}>
                        <Icon name="pin" color={t.accent} size={11} />
                        <Text style={s.gridValue}>{ld.leads}</Text>
                      </View>
                      <Text style={s.gridLabel}>demandes / mois</Text>
                    </View>
                    <View style={s.gridCell}>
                      <View style={s.gridValueRow}>
                        <Icon name="doc" color={t.accent} size={11} />
                        <Text style={s.gridValue}>{ld.signedDevis}</Text>
                      </View>
                      <Text style={s.gridLabel}>{ld.signedDevis > 1 ? "chantiers signés" : "chantier signé"}</Text>
                    </View>
                    <View style={s.gridCellLast}>
                      <Text style={s.gridEuro}>+{fmt(ld.revenueMensuel)} € / mois</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={s.scNote}>
              Estimations prudentes : taux de conversion du secteur « {report.metier} », panier moyen {fmt(bestScenario?.panier ?? 500)} € HT par chantier.
              Un seul chantier suffit généralement à rentabiliser l&apos;ensemble.
            </Text>
          </View>

          {/* Pièce maîtresse : la démo + QR */}
          {demo && (
            <View style={s.demoCard} wrap={false}>
              <Text style={s.demoKicker}>CE N&apos;EST PAS UNE PROMESSE</Text>
              <Text style={s.demoTitle}>Votre site existe déjà.</Text>
              <Text style={s.demoBody}>
                Nous l&apos;avons créé pour {prospectName} : vos avis Google, vos services, votre téléphone.
                Scannez — il est en ligne, et tout est personnalisable à votre demande.
              </Text>
              <View style={s.demoQrBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={demo.qr} style={s.demoQr} />
              </View>
              <Text style={s.demoUrl}>{demo.url.replace(/^https?:\/\//, "")}</Text>
            </View>
          )}
        </View>

        {/* Étapes — calées juste au-dessus du bandeau */}
        <View style={{ flexGrow: 1 }} />
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

        {/* Bandeau final */}
        <View style={s.band} fixed>
          <Svg width={PAGE_W} height={66} style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="bandGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={t.accentDark} />
                <Stop offset="1" stopColor={t.accent} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={PAGE_W} height={66} fill="url(#bandGrad)" />
          </Svg>
          <View style={s.bandInner}>
            {t.icon && (
              <View style={s.bandIcon}>
                <ThemeIcon icon={t.icon} color={N.white} size={15} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.bandTitle}>Votre place en haut de Google est encore libre.</Text>
              <Text style={s.bandSub}>NMF Agence · www.nmf-agence.com · sans engagement</Text>
            </View>
            <Text style={s.bandRight}>{nmfPhone || "nmf-agence.com"}</Text>
          </View>
        </View>
        <Text style={s.pageNum2} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
