import type { TemplateProps } from "../data";
import { metierLabel } from "../data";
import { kitForMetier } from "../nicheKits";
import {
  DemoBanner,
  NmfCredit,
  OfferBlock,
  SHARED_CSS,
  Stars,
  seedOf,
  type OfferTheme,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Restaurant — direction « Salle du soir ».
 *
 * Un restaurant ne se réserve pas comme un salon : on ne choisit pas un
 * praticien mais un SERVICE, un nombre de COUVERTS et une heure. Le module de
 * réservation reprend donc ces trois entrées, dans cet ordre.
 *
 * Fond chaud sombre, didone et pointillés de carte : la page emprunte à l'objet
 * que le client connaît déjà — le menu posé sur la table — plutôt qu'au site
 * web générique de restaurant.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#17130F",
  panel: "#211A14",
  ink: "#F3EADC",
  inkSoft: "rgba(243,234,220,0.6)",
  line: "rgba(243,234,220,0.16)",
};

const DISPLAY = "'Bodoni Moda', Didot, Georgia, serif";
const BODY = "'Jost', system-ui, sans-serif";

const COVERS = [2, 3, 4, 6];
const SERVICES = ["Déjeuner", "Dîner"];
const TIMES = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

export default function RestaurantTemplate({
  name,
  metier,
  ville,
  phone,
  rating,
  reviews,
  address,
  nmfCredit = false,
}: TemplateProps & { nmfCredit?: boolean }) {
  const kit = kitForMetier(metier);
  const accent = kit.accent;
  const label = metierLabel(metier || "Restaurant");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 4.7;
  const reviewCount = reviews ?? 214;
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);
  const takenTime = seed % TIMES.length;
  const cats = [...new Set(kit.services.map((s) => s.cat))];

  const theme: OfferTheme = {
    bg: C.panel,
    panel: C.bg,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.bg,
    radius: 4,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.22em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.22em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 400,
    fontSize: 52,
    lineHeight: 1.05,
    margin: 0,
  };

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Jost:wght@300;400;500&display=swap');
        ${SHARED_CSS}
        .re-shot img { transition: transform .8s cubic-bezier(.2,.7,.3,1); }
        .re-shot:hover img { transform: scale(1.05); }
        .re-chip { transition: background .2s ease, color .2s ease, border-color .2s ease; }
        .re-chip:not(.is-off):hover { background: ${accent}; border-color: ${accent}; color: ${C.bg}; }
        .re-link { color: ${accent}; text-decoration: none; }
        .re-link:hover { text-decoration: underline; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .re-hero-card { position: static !important; width: auto !important; margin-top: 24px !important; }
          .re-h1 { font-size: 56px !important; }
          .re-two { grid-template-columns: 1fr !important; }
          .re-menu { grid-template-columns: 1fr !important; }
          .re-shots { grid-template-columns: 1fr 1fr !important; }
          .re-nav { display: none !important; }
          .re-pad { padding: 60px 20px !important; }
          .re-h2 { font-size: 36px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(23,19,15,0.92)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.line}` }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 24px",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 25, letterSpacing: "0.02em" }}>{name}</span>
          <nav className="re-nav" style={{ display: "flex", gap: 30, ...meta }}>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              La carte
            </a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              La salle
            </a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Avis
            </a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Accès
            </a>
          </nav>
          <a
            href="#reserver"
            style={{
              border: `1px solid ${accent}`,
              color: accent,
              padding: "11px 22px",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Réserver
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: "relative" }}>
        <div style={{ position: "relative", height: 620, overflow: "hidden" }}>
          <img
            src={kit.hero}
            alt={`${label} à ${cityLabel}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5) saturate(0.9)" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to bottom, rgba(23,19,15,0.35), ${C.bg})`,
            }}
            aria-hidden
          />
        </div>
        <div
          className="re-pad"
          style={{ position: "relative", maxWidth: 1240, margin: "-320px auto 0", padding: "0 24px 96px" }}
        >
          <div style={{ maxWidth: 620 }}>
            <div style={{ ...meta, color: accent, marginBottom: 20 }}>
              {label} · {cityLabel}
            </div>
            <h1 className="re-h1" style={{ ...h2, fontSize: 82, lineHeight: 0.98 }}>
              {name}
            </h1>
            <p style={{ marginTop: 24, fontSize: 19, lineHeight: 1.75, color: "rgba(243,234,220,0.82)" }}>
              Une carte courte, des produits du marché, et une salle où l&apos;on prend le temps. Votre table
              vous attend.
            </p>
            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <a
                href="#reserver"
                style={{
                  background: accent,
                  color: C.bg,
                  padding: "16px 32px",
                  fontSize: 12,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {kit.labels.cta}
              </a>
              <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Stars value={avg} color={accent} size={13} /> {avg}/5 · {reviewCount} avis
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Réserver une table ── */}
      <section id="reserver" className="re-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div className="re-two" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 16 }}>Réservation en ligne</div>
            <h2 className="re-h2" style={h2}>
              Votre table,
              <br />
              <span style={{ fontStyle: "italic" }}>en trois clics.</span>
            </h2>
            <p style={{ marginTop: 22, color: C.inkSoft, fontSize: 17, lineHeight: 1.75, maxWidth: 380 }}>
              Plus besoin d&apos;appeler pendant le coup de feu : la salle se réserve depuis le téléphone, et
              vous recevez la confirmation tout de suite.
            </p>
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.line}`, padding: 34 }}>
            <div style={{ ...meta, marginBottom: 14 }}>Couverts</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
              {COVERS.map((n, i) => (
                <span
                  key={n}
                  className="re-chip"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "14px 0",
                    border: `1px solid ${i === 1 ? accent : C.line}`,
                    background: i === 1 ? accent : "transparent",
                    color: i === 1 ? C.bg : C.ink,
                    fontFamily: DISPLAY,
                    fontSize: 22,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </span>
              ))}
            </div>

            <div style={{ ...meta, marginBottom: 14 }}>Service</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
              {SERVICES.map((s, i) => (
                <span
                  key={s}
                  className="re-chip"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "13px 0",
                    border: `1px solid ${i === 1 ? accent : C.line}`,
                    background: i === 1 ? accent : "transparent",
                    color: i === 1 ? C.bg : C.ink,
                    fontSize: 13,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>

            <div style={{ ...meta, marginBottom: 14 }}>Heure</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {TIMES.map((t, i) => {
                const off = i === takenTime;
                return (
                  <span
                    key={t}
                    className={`re-chip${off ? " is-off" : ""}`}
                    style={{
                      textAlign: "center",
                      padding: "13px 0",
                      border: `1px solid ${C.line}`,
                      fontFamily: DISPLAY,
                      fontSize: 18,
                      color: off ? "rgba(243,234,220,0.25)" : C.ink,
                      textDecoration: off ? "line-through" : "none",
                      cursor: off ? "default" : "pointer",
                    }}
                  >
                    {t}
                  </span>
                );
              })}
            </div>

            <a
              href={`tel:${tel}`}
              style={{
                display: "block",
                marginTop: 24,
                textAlign: "center",
                background: accent,
                color: C.bg,
                padding: "16px 0",
                fontSize: 12,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Confirmer la table
            </a>
          </div>
        </div>
      </section>

      {/* ── La carte ── */}
      <section id="prestations" className="re-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 className="re-h2" style={h2}>
              {kit.labels.catalogue} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 15, marginTop: 14 }}>
              {kit.labels.catalogueNote}
            </p>
          </div>

          <div className="re-menu" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 64px" }}>
            {cats.map((cat) => (
              <div key={cat} style={{ breakInside: "avoid", marginBottom: 40 }}>
                <div style={{ ...meta, color: accent, marginBottom: 18, textAlign: "center" }}>{cat}</div>
                {kit.services
                  .filter((s) => s.cat === cat)
                  .map((s) => (
                    <div key={s.name} style={{ marginBottom: 22 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: DISPLAY, fontSize: 22 }}>{s.name}</span>
                        <span style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, transform: "translateY(-4px)", minWidth: 16 }} aria-hidden />
                        <span style={{ fontFamily: DISPLAY, fontSize: 22, color: accent }}>{s.price} €</span>
                      </div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6, fontStyle: "italic" }}>
                        {s.desc}
                      </p>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── La salle ── */}
      <section id="galerie" className="re-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div className="re-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center", marginBottom: 56 }}>
            <figure className="re-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "4/3" }}>
              <img src={kit.about} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
            <div>
              <div style={{ ...meta, color: accent, marginBottom: 16 }}>La maison</div>
              <h2 className="re-h2" style={{ ...h2, marginBottom: 22 }}>
                {kit.labels.gallery} <span style={{ fontStyle: "italic" }}>{kit.labels.gallerySub}</span>
              </h2>
              <p style={{ fontSize: 18, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{about}</p>
            </div>
          </div>
          <div className="re-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {kit.gallery.map((src, i) => (
              <figure key={src} className="re-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "1" }}>
                <img src={src} alt={`Assiette ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="re-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 className="re-h2" style={h2}>
              Ce qu&apos;on en <span style={{ fontStyle: "italic", color: accent }}>dit</span>.
            </h2>
            <div style={{ ...meta, marginTop: 14, display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Stars value={avg} color={accent} size={14} /> {avg}/5 · {reviewCount} avis
            </div>
          </div>
          <div className="re-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, border: `1px solid ${C.line}`, padding: 32, display: "flex", flexDirection: "column", gap: 18 }}>
                <Stars value={t.rating} color={accent} size={13} />
                <p style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: 20, lineHeight: 1.55, margin: 0, flex: 1 }}>
                  « {t.comment} »
                </p>
                <footer style={{ ...meta, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: accent }}>{t.author}</span>
                  <span>{t.date}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accès ── */}
      <section id="contact" className="re-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div className="re-two" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          <div>
            <h2 className="re-h2" style={h2}>
              Nous <span style={{ fontStyle: "italic", color: accent }}>trouver</span>.
            </h2>
            <div style={{ marginTop: 28, fontSize: 18, lineHeight: 1.9, color: C.inkSoft }}>
              {address || "Centre-ville"}
              <br />
              {cityLabel}, France
              <br />
              <a className="re-link" href={`tel:${tel}`}>
                {phone || "—"}
              </a>
            </div>
          </div>
          <div>
            <div style={{ ...meta, marginBottom: 12 }}>Services</div>
            {[
              ["Lundi", "Fermé"],
              ["Mardi — jeudi", "12:00 – 14:00 · 19:00 – 22:00"],
              ["Vendredi — samedi", "12:00 – 14:30 · 19:00 – 23:00"],
              ["Dimanche", "12:00 – 15:00"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "16px 0", borderBottom: `1px solid ${C.line}`, fontSize: 15 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 19 }}>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(243,234,220,0.3)" : C.inkSoft, textAlign: "right" }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={label} ville={cityLabel} />}

      <footer style={{ background: C.bg, color: C.inkSoft, padding: "36px 24px", borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>
            © {year} {name}
          </span>
          <span>
            {cityLabel}, France{phone ? ` · ${phone}` : ""}
          </span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
