import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Menuisier — direction « L'établi ».
 *
 * Un menuisier perd les devis face au magasin de cuisines : le client compare
 * un prix à un prix sans voir ce qu'il achète. Ce qu'il achète, c'est du bois
 * massif contre du panneau — alors la page met la matière avant le meuble. Le
 * module du hero est un nuancier d'essences : le grain, le prix, la durée de
 * vie. On choisit un bois, pas une façade sur catalogue.
 *
 * D'où la DA : papier chaud, sérif à empattements épais (Fraunces), colonnes
 * généreuses. Le registre du bois travaillé, l'inverse exact de la fiche
 * produit d'une enseigne.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F4EDE3",
  panel: "#FBF7F1",
  ink: "#241B12",
  inkSoft: "rgba(36,27,18,0.62)",
  line: "rgba(36,27,18,0.15)",
};

const DISPLAY = "'Fraunces', Georgia, serif";
const BODY = "'Karla', system-ui, sans-serif";

export default function EtabliTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "etabli", "menuisier");
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
    radius: 4,
    border: `1px solid ${C.line}`,
    shadow: "0 20px 40px -34px rgba(36,27,18,0.6)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.16em",
  };

  // Le numéro se répète en trois endroits : ce thème le garde cohérent.
  const callTheme = {
    display: DISPLAY,
    meta: BODY,
    accent,
    onAccent: "#fff",
    metaSpacing: "0.16em",
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
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 500,
    fontSize: 46,
    lineHeight: 1.06,
    letterSpacing: "-0.02em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip", paddingBottom: 62 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Karla:wght@400;500;700&display=swap');
        ${ARTISAN_CSS}
        .et-shot img { transition: transform .7s cubic-bezier(.2,.7,.3,1); }
        .et-shot:hover img { transform: scale(1.05); }
        .et-essence { transition: transform .18s ease, box-shadow .18s ease; }
        .et-essence:hover { transform: translateY(-4px); box-shadow: 0 18px 34px -24px rgba(36,27,18,0.7); }
        .et-cta { transition: filter .15s ease; }
        .et-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .et-h1 { font-size: 56px !important; }
          .et-hero { grid-template-columns: 1fr !important; }
          .et-essences { grid-template-columns: 1fr 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
        <div
          className="ar-pad"
          style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 78, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 25, letterSpacing: "-0.02em" }}>{name}</span>
          <nav className="ar-nav" style={{ display: "flex", gap: 28, ...meta }}>
            <a href="#essences" style={{ color: C.inkSoft, textDecoration: "none" }}>Essences</a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Ouvrages</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Réalisations</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Atelier</a>
          </nav>
          <a
            className="et-cta"
            href={`tel:${v.tel}`}
            style={{ background: C.ink, color: C.panel, padding: "13px 22px", borderRadius: 3, fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ar-pad" style={{ padding: "72px 24px 76px" }}>
        <div className="et-hero" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 22, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
              <span style={{ width: 22, height: 1, background: C.line }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Stars value={v.avg} color={accent} size={12} /> {v.avg}/5
              </span>
            </div>

            <h1 className="et-h1" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 72, lineHeight: 1, letterSpacing: "-0.03em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ fontStyle: "italic", color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.75, color: C.inkSoft, maxWidth: 450 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap", alignItems: "center" }}>
              <a
                className="et-cta"
                href="#essences"
                style={{ background: accent, color: "#fff", padding: "17px 30px", borderRadius: 3, fontWeight: 700, fontSize: 16, textDecoration: "none" }}
              >
                Voir les essences
              </a>
              <HeroCall phone={phone} tel={v.tel} theme={callTheme} />
            </div>
          </div>

          <figure className="et-shot" style={{ margin: 0, overflow: "hidden", borderRadius: 4, aspectRatio: "4/5" }}>
            <img src={kit.hero} alt={`${v.label} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Le module : le nuancier d'essences ── */}
      <section id="essences" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 44 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>La matière</div>
            <h2 style={h2}>
              Cinq essences, cinq
              <span style={{ fontStyle: "italic", color: accent }}> caractères</span>.
            </h2>
          </div>

          <div className="et-essences" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {m.essences.map((e) => (
              <div key={e.name} className="et-essence" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: 96, background: e.color }} aria-hidden />
                <div style={{ padding: "18px 18px 22px" }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 23, marginBottom: 8 }}>{e.name}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}>{e.note}</p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ margin: "30px 0 0", fontSize: 16, lineHeight: 1.75, color: C.inkSoft, maxWidth: 760 }}>{m.delaiNote}</p>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: C.ink, color: C.panel, padding: "38px 24px" }}>
        <div className="ar-three ar-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 38, lineHeight: 1, color: accent }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.85 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ouvrages ── */}
      <section id="prestations" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 44, maxWidth: 620 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 34 }}>
              <div style={{ ...meta, color: accent, marginBottom: 12 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "20px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 25 }}>{s.name}</div>
                      <p style={{ margin: "6px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontSize: 26, whiteSpace: "nowrap", color: s.price === 0 ? accent : C.ink }}>
                      {artisanPrice(s.price, s.from, s.unit)}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── L'atelier ── */}
      <section className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
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
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;atelier</div>
            <h2 style={{ ...h2, marginBottom: 22 }}>
              Fait ici, pour
              <span style={{ fontStyle: "italic", color: accent }}> votre pièce</span>.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "9px 14px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 34 }}>
            {kit.labels.gallery} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.gallery.map((src, i) => (
              <figure key={`${src}-${i}`} className="et-shot" style={{ margin: 0, borderRadius: 4, overflow: "hidden", aspectRatio: i % 3 === 1 ? "3/4" : "1", background: C.panel }}>
                <img src={src} alt={`Réalisation ${i + 1} — ${name}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 38 }}>
            <h2 style={h2}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
                <Stars value={t.rating} color={accent} size={14} />
                <p style={{ fontFamily: DISPLAY, margin: 0, fontSize: 20, lineHeight: 1.5, flex: 1 }}>« {t.comment} »</p>
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
              L&apos;<span style={{ fontStyle: "italic", color: accent }}>atelier</span>
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
                  {address || "Zone artisanale"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 28, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Visite de l&apos;atelier</div>
            {[
              ["Lundi — jeudi", "08:00 – 18:00"],
              ["Vendredi", "08:00 – 16:00"],
              ["Samedi", "Sur rendez-vous"],
              ["Dimanche", "Fermé"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ position: "relative", color: "#fff", padding: "100px 24px", textAlign: "center", overflow: "hidden" }}>
        <img src={kit.about} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: C.ink, opacity: 0.84 }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 54, lineHeight: 1.05, margin: "0 0 26px" }}>
            Un plan, un devis, du bois.
          </h2>
          <a
            className="et-cta"
            href={`tel:${v.tel}`}
            style={{ display: "inline-block", background: accent, color: "#fff", padding: "18px 38px", borderRadius: 3, fontWeight: 700, fontSize: 18, textDecoration: "none" }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(251,247,241,0.6)", padding: "34px 24px" }}>
        <div className="ar-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(251,247,241,0.6)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={"Plan 3D et devis offerts"} />
    </div>
  );
}
