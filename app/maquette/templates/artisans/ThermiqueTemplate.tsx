import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Chauffagiste — direction « La chaudière ».
 *
 * Un chauffagiste vend deux choses opposées : une urgence (plus d'eau chaude)
 * et un investissement à dix mille euros (la pompe à chaleur). La seconde ne se
 * décide jamais sur une photo — elle se décide sur une facture annuelle avant
 * et après, et sur le montant des aides. La page met donc les deux chiffres
 * face à face, en barres, avant tout le reste.
 *
 * D'où la DA : bleu nuit qui se réchauffe vers l'orange en descendant la page,
 * grotesque géométrique, chiffres énormes. Le froid en haut, la flamme en bas.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#0B1220",
  panel: "#131D2E",
  panelSoft: "#1A2739",
  ink: "#F1F5FA",
  inkSoft: "rgba(241,245,250,0.6)",
  line: "rgba(241,245,250,0.13)",
  cold: "#5B8DBE",
};

const DISPLAY = "'Space Grotesk', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

export default function ThermiqueTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "thermique", "chauffagiste");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const saved = m.before - m.after;
  const pct = Math.round((saved / m.before) * 100);
  const afterWidth = Math.round((m.after / m.before) * 100);

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: "#fff",
    radius: 10,
    border: `1px solid ${C.line}`,
    shadow: "none",
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
    radius: 10,
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
    radius: 12,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 700,
    fontSize: 44,
    lineHeight: 1.04,
    letterSpacing: "-0.03em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip", paddingBottom: 62 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        ${ARTISAN_CSS}
        .th-shot img { transition: transform .6s cubic-bezier(.2,.7,.3,1); }
        .th-shot:hover img { transform: scale(1.05); }
        .th-aide { transition: border-color .15s ease, background .15s ease; }
        .th-aide:hover { border-color: ${accent}; background: ${C.panelSoft}; }
        .th-cta { transition: filter .15s ease; }
        .th-cta:hover { filter: brightness(1.1); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .th-h1 { font-size: 50px !important; }
          .th-hero { grid-template-columns: 1fr !important; }
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
          background: "rgba(11,18,32,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="ar-pad"
          style={{ maxWidth: 1220, margin: "0 auto", padding: "0 24px", height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 21, letterSpacing: "-0.03em" }}>{name}</span>
          <nav className="ar-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#economies" style={{ color: C.inkSoft, textDecoration: "none" }}>Économies</a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Prestations</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Installations</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="th-cta"
            href={`tel:${v.tel}`}
            style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero + comparateur de facture ── */}
      <section className="ar-pad" style={{ padding: "70px 24px 80px" }}>
        <div className="th-hero" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
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

            <h1 className="th-h1" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 64, lineHeight: 1.02, letterSpacing: "-0.04em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 470 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
              <a
                className="th-cta"
                href="#economies"
                style={{ background: accent, color: "#fff", padding: "17px 30px", borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: "none" }}
              >
                Voir les économies
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

          {/* Le module : la facture avant / après */}
          <div id="economies" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 32 }}>
            <div style={{ ...meta, color: accent, marginBottom: 6 }}>Facture annuelle de chauffage</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, marginBottom: 28, letterSpacing: "-0.02em" }}>
              Avant, puis après.
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...meta, marginBottom: 8 }}>
                <span>Chaudière fioul ou gaz ancienne</span>
                <span style={{ color: C.ink }}>{m.before.toLocaleString("fr-FR")} €</span>
              </div>
              <div style={{ height: 26, borderRadius: 6, background: C.cold, width: "100%" }} />
            </div>

            <div style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...meta, marginBottom: 8 }}>
                <span>Pompe à chaleur air/eau</span>
                <span style={{ color: accent }}>{m.after.toLocaleString("fr-FR")} €</span>
              </div>
              <div style={{ height: 26, borderRadius: 6, background: accent, width: `${afterWidth}%` }} />
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingTop: 22, borderTop: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 52, lineHeight: 1, color: accent, letterSpacing: "-0.04em" }}>
                −{pct}%
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: C.inkSoft }}>
                soit {saved.toLocaleString("fr-FR")} € par an, hors aides à l&apos;installation.
              </span>
            </div>

            <div style={{ ...meta, marginTop: 26, marginBottom: 12 }}>Aides déduites du devis</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {m.aides.map((a) => (
                <div
                  key={a.name}
                  className="th-aide"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: "13px 16px",
                    fontSize: 15,
                  }}
                >
                  <span>{a.name}</span>
                  <span style={{ color: accent, fontWeight: 600 }}>{a.amount}</span>
                </div>
              ))}
            </div>

            <p style={{ margin: "20px 0 0", fontSize: 13, lineHeight: 1.6, color: C.inkSoft }}>
              Estimation pour une maison de 100 m² à {v.cityLabel}. Le chiffre exact sort du bilan thermique.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "36px 24px" }}>
        <div className="ar-three ar-pad" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 38, lineHeight: 1, letterSpacing: "-0.03em" }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── L'entretien, l'autre moitié du métier ── */}
      <section className="ar-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>Obligation annuelle</div>
            <h2 style={{ ...h2, marginBottom: 20 }}>
              L&apos;entretien qui garde
              <br />
              <span style={{ color: accent }}>la garantie valable.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{m.entretienNote}</p>
          </div>
          <AboutVisual
            about={kit.about}
            portrait={kit.portrait}
            alt={`${v.label} à ${v.cityLabel}`}
            name={name}
            role={v.label}
            theme={portraitTheme}
          />
        </div>
      </section>

      {/* ── Prestations ── */}
      <section id="prestations" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
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
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "19px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, letterSpacing: "-0.01em" }}>{s.name}</div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, whiteSpace: "nowrap", color: s.price === 0 ? accent : C.ink }}>
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
        <div className="ar-two" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
          <figure className="th-shot" style={{ margin: 0, borderRadius: 14, overflow: "hidden", aspectRatio: "4/3" }}>
            <img src={kit.hero} alt={`${v.label} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;entreprise</div>
            <h2 style={{ ...h2, marginBottom: 20 }}>
              Les chiffres avant
              <br />
              <span style={{ color: accent }}>la signature.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 36, marginTop: 32, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, color: accent }}>{v.avg}/5</div>
                <div style={meta}>{v.reviewCount} avis clients</div>
              </div>
              <div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, color: accent }}>−{pct}%</div>
                <div style={meta}>sur la facture annuelle</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 32 }}>
            {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {kit.gallery.map((src, i) => (
              <figure key={`${src}-${i}`} className="th-shot" style={{ margin: 0, borderRadius: 12, overflow: "hidden", aspectRatio: "4/3", background: C.panel }}>
                <img src={src} alt={`Installation ${i + 1} — ${name}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
            <h2 style={h2}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, background: C.panelSoft, border: `1px solid ${C.line}`, borderRadius: 12, padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
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
        <div className="ar-two" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
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
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "08:00 – 18:30"],
              ["Samedi", "09:00 – 12:00"],
              ["Dimanche", "Fermé"],
              ["Dépannage sous contrat", "7j/7"],
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
      <section style={{ background: `linear-gradient(160deg, ${C.bg}, ${accent})`, color: "#fff", padding: "84px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 48, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 22px" }}>
          Un bilan thermique gratuit.
        </h2>
        <a
          className="th-cta"
          href={`tel:${v.tel}`}
          style={{ display: "inline-block", background: "#fff", color: accent, padding: "18px 38px", borderRadius: 8, fontWeight: 700, fontSize: 20, textDecoration: "none" }}
        >
          {phone || kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "32px 24px" }}>
        <div className="ar-pad" style={{ maxWidth: 1220, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={"Bilan thermique gratuit"} />
    </div>
  );
}
