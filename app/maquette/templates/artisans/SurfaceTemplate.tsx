import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Carreleur & peintre — direction « La surface ».
 *
 * Ces deux métiers se vendent au mètre carré, et c'est exactement la question
 * que le client se pose sans oser la poser : « ça coûte combien, chez moi ? ».
 * Le module du hero y répond en clair — une pièce type, une surface, un ordre
 * de grandeur — puis renvoie au devis ferme. Un artisan qui affiche un prix au
 * m² se démarque immédiatement de ceux qui répondent « ça dépend ».
 *
 * D'où la DA : blanc de chantier, grille stricte, chiffres en gras et un
 * nuancier de finitions. Ce qu'on regarde ici, c'est une surface et un prix.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FAFAF8",
  panel: "#FFFFFF",
  ink: "#14171A",
  inkSoft: "rgba(20,23,26,0.6)",
  line: "rgba(20,23,26,0.13)",
};

const DISPLAY = "'Manrope', system-ui, sans-serif";
const BODY = "'Manrope', system-ui, sans-serif";

export default function SurfaceTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "surface", "carreleur");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: "#fff",
    radius: 12,
    border: `1px solid ${C.line}`,
    shadow: "0 20px 44px -34px rgba(20,23,26,0.45)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.14em",
  };

  // Le numéro se répète en trois endroits : ce thème le garde cohérent.
  const callTheme = {
    display: DISPLAY,
    meta: BODY,
    accent,
    onAccent: "#fff",
    metaSpacing: "0.14em",
    line: C.line,
    ink: C.ink,
    inkSoft: C.inkSoft,
    radius: 999,
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
    radius: 999,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 800,
    fontSize: 44,
    lineHeight: 1.05,
    letterSpacing: "-0.035em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip", paddingBottom: 62 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        ${ARTISAN_CSS}
        .sf-shot img { transition: transform .6s cubic-bezier(.2,.7,.3,1); }
        .sf-shot:hover img { transform: scale(1.05); }
        .sf-piece { transition: border-color .15s ease, transform .15s ease; }
        .sf-piece:hover { border-color: ${accent}; transform: translateY(-3px); }
        .sf-fin { transition: transform .18s ease; }
        .sf-fin:hover { transform: translateY(-3px); }
        .sf-cta { transition: filter .15s ease; }
        .sf-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .sf-h1 { font-size: 52px !important; }
          .sf-hero { grid-template-columns: 1fr !important; }
          .sf-pieces { grid-template-columns: 1fr 1fr !important; }
          .sf-fins { grid-template-columns: 1fr 1fr !important; }
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
          background: "rgba(250,250,248,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="ar-pad"
          style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-0.03em" }}>{name}</span>
          <nav className="ar-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#estimation" style={{ color: C.inkSoft, textDecoration: "none" }}>Estimation</a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Prestations</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Chantiers</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="sf-cta"
            href={`tel:${v.tel}`}
            style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero + estimateur ── */}
      <section className="ar-pad" style={{ padding: "72px 24px 80px" }}>
        <div className="sf-hero" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 22, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
              <span style={{ width: 22, height: 1, background: C.line }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Stars value={v.avg} color={accent} size={12} /> {v.avg}/5
              </span>
            </div>

            <h1 className="sf-h1" style={{ fontWeight: 800, fontSize: 66, lineHeight: 1, letterSpacing: "-0.045em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 450 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
              <a
                className="sf-cta"
                href="#estimation"
                style={{ background: C.ink, color: C.panel, padding: "17px 30px", borderRadius: 999, fontWeight: 700, fontSize: 16, textDecoration: "none" }}
              >
                Estimer ma pièce
              </a>
              <HeroCall phone={phone} tel={v.tel} theme={callTheme} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          {/* Le module : le prix par pièce type */}
          <div id="estimation" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 30, boxShadow: theme.shadow }}>
            <div style={{ ...meta, color: accent, marginBottom: 6 }}>Ordre de grandeur</div>
            <div style={{ fontWeight: 800, fontSize: 25, letterSpacing: "-0.03em", marginBottom: 22 }}>Combien pour votre pièce ?</div>

            <div className="sf-pieces" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {m.pieces.map((piece) => (
                <a
                  key={piece.label}
                  href={`tel:${v.tel}`}
                  className="sf-piece"
                  style={{
                    display: "block",
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    padding: "18px 18px 20px",
                    textDecoration: "none",
                    color: C.ink,
                  }}
                >
                  <div style={{ ...meta, marginBottom: 10 }}>{piece.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 27, letterSpacing: "-0.03em", color: accent }}>
                    {(piece.m2 * m.pricePerM2).toLocaleString("fr-FR")} €
                  </div>
                  <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>
                    ≈ {piece.m2} m² × {m.pricePerM2} €
                  </div>
                </a>
              ))}
            </div>

            <p style={{ margin: "22px 0 0", fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}>
              Ordres de grandeur pour de la pose seule, hors préparation du support et hors fournitures.
              Le devis ferme est établi après métré sur place — gratuitement.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: C.ink, color: C.panel, padding: "36px 24px" }}>
        <div className="ar-three ar-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 34, lineHeight: 1, letterSpacing: "-0.04em", color: accent }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.86 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Les finitions ── */}
      <section className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 40 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Le choix qui change tout</div>
            <h2 style={h2}>Les finitions, et ce qu&apos;elles impliquent.</h2>
          </div>
          <div className="sf-fins" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(m.finitions.length, 5)}, 1fr)`, gap: 16 }}>
            {m.finitions.map((f) => (
              <div key={f.name} className="sf-fin" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ height: 88, background: f.color }} aria-hidden />
                <div style={{ padding: "16px 18px 20px" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{f.name}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}>{f.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prestations ── */}
      <section id="prestations" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 42, maxWidth: 620 }}>
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
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "19px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em" }}>{s.name}</div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 22, whiteSpace: "nowrap", letterSpacing: "-0.03em", color: s.price === 0 ? accent : C.ink }}>
                      {artisanPrice(s.price, s.from, s.unit)}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── L'artisan ── */}
      <section className="ar-pad" style={{ padding: "88px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <AboutVisual
            about={kit.about}
            portrait={kit.portrait}
            alt={`${v.label} à ${v.cityLabel}`}
            name={name}
            role={v.label}
            theme={portraitTheme}
          />
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;artisan</div>
            <h2 style={{ ...h2, marginBottom: 20 }}>
              Le support d&apos;abord,
              <br />
              <span style={{ color: accent }}>le reste ensuite.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.78, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 36, marginTop: 32, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 32, color: accent, letterSpacing: "-0.04em" }}>{v.avg}/5</div>
                <div style={meta}>{v.reviewCount} avis clients</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 32, color: accent, letterSpacing: "-0.04em" }}>
                  {m.pricePerM2} €/m²
                </div>
                <div style={meta}>tarif de départ</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 32 }}>
            {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {kit.gallery.map((src, i) => (
              <figure key={`${src}-${i}`} className="sf-shot" style={{ margin: 0, borderRadius: 12, overflow: "hidden", aspectRatio: "4/3", background: C.bg }}>
                <img src={src} alt={`Chantier ${i + 1} — ${name}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
            <h2 style={h2}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
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
      <section id="contact" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 26 }}>
              Zone d&apos;<span style={{ color: accent }}>intervention</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
              {kit.zone.map((z) => (
                <span key={z} style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: "9px 15px", fontSize: 15 }}>
                  {z}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>
                  {address || "Centre-ville"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontWeight: 800, fontSize: 26, color: accent, textDecoration: "none", letterSpacing: "-0.03em" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "08:00 – 18:00"],
              ["Samedi", "Sur rendez-vous"],
              ["Dimanche", "Fermé"],
              ["Métré à domicile", "Sur appel"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 0", borderTop: `1px solid ${C.line}`, fontSize: 15 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: accent, color: "#fff", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontWeight: 800, fontSize: 48, lineHeight: 1.05, letterSpacing: "-0.04em", margin: "0 0 22px" }}>
          Un métré gratuit, un prix ferme.
        </h2>
        <a
          className="sf-cta"
          href={`tel:${v.tel}`}
          style={{ display: "inline-block", background: "#fff", color: accent, padding: "18px 38px", borderRadius: 999, fontWeight: 800, fontSize: 19, textDecoration: "none" }}
        >
          {phone || kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(255,255,255,0.58)", padding: "32px 24px" }}>
        <div className="ar-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(255,255,255,0.58)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={"Métré gratuit à domicile"} />
    </div>
  );
}
