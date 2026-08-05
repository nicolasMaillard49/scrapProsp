import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Électricien — direction « Le tableau ».
 *
 * Un électricien ne vend pas des prises : il vend le fait que la maison ne
 * brûle pas et que l'assurance paiera. Son argument est une norme, la
 * NF C 15-100, et six points de contrôle que personne ne connaît. La page les
 * montre — c'est plus convaincant que n'importe quelle photo de chantier.
 *
 * D'où la DA : noir atelier, jaune de sécurité, tout en monospace et en grille,
 * comme un rapport de contrôle. Le hero porte un schéma de tableau dessiné en
 * SVG plutôt qu'une photo : un tableau propre et repéré, c'est exactement le
 * produit fini qu'on vend, et aucune banque d'images ne le montre correctement.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#0B0B0C",
  panel: "#151517",
  panelSoft: "#1D1D20",
  ink: "#F4F4F2",
  inkSoft: "rgba(244,244,242,0.58)",
  line: "rgba(244,244,242,0.14)",
  ok: "#5BD98A",
  ko: "#FF6B4A",
};

const DISPLAY = "'IBM Plex Mono', ui-monospace, monospace";
const BODY = "'IBM Plex Sans', system-ui, sans-serif";

/** Schéma d'un tableau divisionnaire : rangées de disjoncteurs sur rail DIN. */
function TableauSchema({ accent }: { accent: string }) {
  const rows = [0, 1, 2];
  const cols = Array.from({ length: 9 }, (_, i) => i);
  // Deux modules signalés : ce sont eux que le diagnostic vient chercher.
  const flagged = new Set(["1-3", "2-6"]);
  return (
    <svg viewBox="0 0 420 300" width="100%" role="img" aria-label="Schéma d'un tableau électrique">
      <rect x="6" y="6" width="408" height="288" rx="10" fill="none" stroke={C.line} strokeWidth="2" />
      <rect x="6" y="6" width="408" height="34" rx="10" fill={C.panelSoft} />
      <text x="22" y="28" fill={C.inkSoft} fontFamily={DISPLAY} fontSize="12" letterSpacing="2">
        TABLEAU · NF C 15-100
      </text>
      <circle cx="392" cy="23" r="5" fill={accent} />
      {rows.map((r) => {
        const y = 66 + r * 78;
        return (
          <g key={r}>
            <rect x="24" y={y - 10} width="372" height="58" rx="4" fill={C.panelSoft} />
            <line x1="24" y1={y + 24} x2="396" y2={y + 24} stroke={C.line} strokeWidth="1" />
            {cols.map((c) => {
              const x = 34 + c * 40;
              const key = `${r}-${c}`;
              const bad = flagged.has(key);
              return (
                <g key={c}>
                  <rect x={x} y={y - 2} width="30" height="42" rx="3" fill={C.bg} stroke={bad ? C.ko : C.line} strokeWidth={bad ? 2 : 1} />
                  <rect x={x + 8} y={y + 4} width="14" height="12" rx="2" fill={bad ? C.ko : accent} opacity={bad ? 1 : 0.85} />
                  <line x1={x + 6} y1={y + 26} x2={x + 24} y2={y + 26} stroke={C.line} strokeWidth="1.5" />
                  <line x1={x + 6} y1={y + 32} x2={x + 18} y2={y + 32} stroke={C.line} strokeWidth="1.5" />
                </g>
              );
            })}
          </g>
        );
      })}
      <text x="24" y="286" fill={C.ko} fontFamily={DISPLAY} fontSize="11" letterSpacing="1">
        2 anomalies relevées
      </text>
    </svg>
  );
}

export default function ConformiteTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "conformite", "electricien");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const conformes = m.checks.filter((c) => c.ok).length;

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.bg,
    radius: 4,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: DISPLAY,
    metaSpacing: "0.18em",
  };

  // Le numéro se répète en trois endroits : ce thème le garde cohérent.
  const callTheme = {
    display: DISPLAY,
    meta: BODY,
    accent,
    onAccent: C.bg,
    metaSpacing: "0.18em",
    line: C.line,
    ink: C.ink,
    inkSoft: C.inkSoft,
    radius: 4,
  };

  const portraitTheme = {
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.14em",
    ink: C.ink,
    inkSoft: C.inkSoft,
    line: C.line,
    accent,
    panel: C.panel,
    radius: 4,
  };

  const meta: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 500,
    fontSize: 40,
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip", paddingBottom: 62 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        ${ARTISAN_CSS}
        .cn-check { transition: border-color .15s ease, background .15s ease; }
        .cn-check:hover { border-color: ${accent}; background: ${C.panelSoft}; }
        .cn-shot img { transition: transform .6s cubic-bezier(.2,.7,.3,1); filter: grayscale(0.25); }
        .cn-shot:hover img { transform: scale(1.04); filter: none; }
        .cn-cta { transition: filter .15s ease; }
        .cn-cta:hover { filter: brightness(1.1); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .cn-h1 { font-size: 46px !important; }
          .cn-hero { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(11,11,12,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="ar-pad"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19, letterSpacing: "-0.02em" }}>{name}</span>
          <nav className="ar-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#diagnostic" style={{ color: C.inkSoft, textDecoration: "none" }}>Diagnostic</a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Prestations</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Chantiers</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="cn-cta"
            href={`tel:${v.tel}`}
            style={{
              background: accent,
              color: C.bg,
              padding: "12px 20px",
              borderRadius: 4,
              fontFamily: DISPLAY,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ar-pad" style={{ padding: "72px 24px 80px" }}>
        <div
          className="cn-hero"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: 60,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Stars value={v.avg} color={accent} size={12} /> {v.avg}/5
              </span>
            </div>

            <h1
              className="cn-h1"
              style={{
                fontFamily: DISPLAY,
                fontWeight: 500,
                fontSize: 62,
                lineHeight: 1.02,
                letterSpacing: "-0.045em",
                margin: 0,
              }}
            >
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 480 }}>
              {kit.promise.sub}
            </p>

            <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
              <a
                className="cn-cta"
                href="#diagnostic"
                style={{
                  background: accent,
                  color: C.bg,
                  padding: "17px 30px",
                  borderRadius: 4,
                  fontFamily: DISPLAY,
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: "none",
                }}
              >
                Voir les 6 points
              </a>
              <HeroCall phone={phone} tel={v.tel} theme={callTheme} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 3, padding: "7px 11px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22 }}>
            <TableauSchema accent={accent} />
          </div>
        </div>
      </section>

      {/* ── Le module : les six points ── */}
      <section id="diagnostic" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
            <div style={{ maxWidth: 620 }}>
              <div style={{ ...meta, color: accent, marginBottom: 12 }}>Diagnostic {m.norme}</div>
              <h2 style={h2}>
                Six points décident
                <br />
                de la sécurité d&apos;un logement.
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 52, lineHeight: 1, color: accent }}>
                {conformes}/{m.checks.length}
              </div>
              <div style={meta}>sur cet exemple</div>
            </div>
          </div>

          <div className="ar-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {m.checks.map((c, i) => (
              <div
                key={c.point}
                className="cn-check"
                style={{
                  background: C.bg,
                  border: `1px solid ${C.line}`,
                  borderRadius: 6,
                  padding: "22px 24px",
                  display: "flex",
                  gap: 18,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: "0 0 auto",
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    display: "grid",
                    placeItems: "center",
                    background: c.ok ? "rgba(91,217,138,0.12)" : "rgba(255,107,74,0.12)",
                    color: c.ok ? C.ok : C.ko,
                    fontFamily: DISPLAY,
                    fontSize: 17,
                  }}
                >
                  {c.ok ? "✓" : "✕"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ ...meta, color: C.inkSoft }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 17, color: C.ink }}>{c.point}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6, color: C.inkSoft }}>{c.why}</p>
                  <div style={{ ...meta, marginTop: 12, color: c.ok ? C.ok : C.ko }}>
                    {c.ok ? "Conforme" : "À reprendre"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ margin: "28px 0 0", fontSize: 15, lineHeight: 1.7, color: C.inkSoft, maxWidth: 720 }}>
            Un logement d&apos;avant 1991 coche rarement les six. Le diagnostic est écrit, remis le jour même,
            et déduit du devis s&apos;il donne lieu à travaux.
          </p>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: C.bg, padding: "34px 24px" }}>
        <div
          className="ar-three ar-pad"
          style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}
        >
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, letterSpacing: "-0.03em" }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Prestations ── */}
      <section id="prestations" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 44, maxWidth: 620 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 32 }}>
              <div style={{ ...meta, color: accent, marginBottom: 12 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div
                    key={s.name}
                    style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "19px 0", borderTop: `1px solid ${C.line}` }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 19 }}>{s.name}</div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                    </div>
                    <span
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: 21,
                        whiteSpace: "nowrap",
                        color: s.price === 0 ? C.ok : C.ink,
                      }}
                    >
                      {artisanPrice(s.price, s.from, s.unit)}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── L'artisan ── */}
      <section className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div
          className="ar-two"
          style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}
        >
          <AboutVisual
            about={kit.about}
            portrait={kit.portrait}
            alt={`${v.label} à ${v.cityLabel}`}
            name={name}
            role={v.label}
            theme={portraitTheme}
          />
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;atelier</div>
            <h2 style={{ ...h2, marginBottom: 22 }}>
              Un tableau qui se lit
              <br />
              <span style={{ color: accent }}>sans mode d&apos;emploi.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 36, marginTop: 32, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 32, color: accent }}>{v.avg}/5</div>
                <div style={meta}>{v.reviewCount} avis clients</div>
              </div>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 32, color: accent }}>{m.norme}</div>
                <div style={meta}>norme appliquée</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 32 }}>
            {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {kit.gallery.map((src, i) => (
              <figure
                key={`${src}-${i}`}
                className="cn-shot"
                style={{ margin: 0, borderRadius: 6, overflow: "hidden", aspectRatio: "4/3", background: C.panel }}
              >
                <img src={src} alt={`Installation ${i + 1} — ${name}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
            <h2 style={h2}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {kit.testimonials.map((t) => (
              <blockquote
                key={t.author}
                style={{ margin: 0, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Stars value={t.rating} color={accent} size={14} />
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, flex: 1 }}>« {t.comment} »</p>
                <footer style={{ ...meta, display: "flex", justifyContent: "space-between" }}>
                  <span>{t.author}</span>
                  <span>{t.date}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 26 }}>
              Zone d&apos;<span style={{ color: accent }}>intervention</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
              {kit.zone.map((z) => (
                <span key={z} style={{ border: `1px solid ${C.line}`, borderRadius: 3, padding: "9px 14px", fontSize: 15 }}>
                  {z}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Atelier</div>
                <div style={{ fontSize: 17 }}>
                  {address || "Centre-ville"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 24, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "08:00 – 18:00"],
              ["Samedi", "09:00 – 12:00"],
              ["Dimanche", "Fermé"],
              ["Urgences", "7j/7 sur appel"],
            ].map(([d, h]) => (
              <div
                key={d}
                style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 0", borderTop: `1px solid ${C.line}`, fontSize: 15 }}
              >
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: accent, color: C.bg, padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 22px" }}>
          Faites contrôler votre tableau.
        </h2>
        <a
          className="cn-cta"
          href={`tel:${v.tel}`}
          style={{
            display: "inline-block",
            background: C.bg,
            color: accent,
            padding: "18px 38px",
            borderRadius: 4,
            fontFamily: DISPLAY,
            fontWeight: 600,
            fontSize: 20,
            textDecoration: "none",
          }}
        >
          {phone || kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "32px 24px" }}>
        <div className="ar-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={"Diagnostic écrit remis le jour même"} />
    </div>
  );
}
