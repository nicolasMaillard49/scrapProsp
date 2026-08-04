import type { TemplateProps } from "../data";
import { metierLabel } from "../data";
import { kitForMetier } from "../nicheKits";
import {
  DemoBanner,
  NmfCredit,
  OfferBlock,
  SHARED_CSS,
  Stars,
  daySlots,
  seedOf,
  type OfferTheme,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Barbier — direction « Atelier ».
 *
 * Un barbier n'est pas un coiffeur avec une barbe : la clientèle est masculine,
 * décide vite, et juge sur la netteté. D'où le noir/laiton, la condensée en
 * capitales, les angles vifs (rayon 2px) et le tableau de prix à pointillés
 * comme sur l'ardoise d'une boutique.
 *
 * Signature : le « prochain fauteuil libre » — l'info qu'un homme cherche
 * réellement avant de pousser la porte, servie avant toute autre chose.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#131211",
  panel: "#1D1B18",
  ink: "#EDE6D8",
  inkSoft: "rgba(237,230,216,0.58)",
  line: "rgba(237,230,216,0.14)",
};

const DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const BODY = "'Barlow', system-ui, sans-serif";

export default function BarbierTemplate({
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
  const label = metierLabel(metier || "Barbier");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 4.9;
  const reviewCount = reviews ?? 128;
  const slots = daySlots(seed, 9, 19, 30).filter((_, i) => i % 2 === 0);
  const nextFree = slots.find((s) => !s.taken)?.time ?? "10:00";
  const waiting = 1 + (seed % 3);
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);

  const theme: OfferTheme = {
    bg: C.panel,
    panel: C.bg,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.bg,
    radius: 2,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.2em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "-0.01em",
    fontSize: 56,
    lineHeight: 0.95,
    margin: 0,
  };

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=Barlow:wght@400;500;600&display=swap');
        ${SHARED_CSS}
        .bb-pole { background-image: repeating-linear-gradient(115deg, ${accent} 0 14px, transparent 14px 28px, ${C.ink} 28px 42px, transparent 42px 56px); background-size: 200% 100%; animation: bb-slide 3.5s linear infinite; }
        @keyframes bb-slide { to { background-position: -200% 0; } }
        .bb-shot img { filter: grayscale(1) contrast(1.08); transition: filter .4s ease, transform .6s ease; }
        .bb-shot:hover img { filter: grayscale(0) contrast(1); transform: scale(1.05); }
        .bb-slot { transition: background .16s ease, color .16s ease; }
        .bb-slot:not(.is-taken):hover { background: ${accent}; color: ${C.bg}; }
        .bb-link { color: ${accent}; text-decoration: none; }
        .bb-link:hover { text-decoration: underline; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .bb-hero-grid { grid-template-columns: 1fr !important; }
          .bb-h1 { font-size: 66px !important; }
          .bb-two { grid-template-columns: 1fr !important; }
          .bb-shots { grid-template-columns: 1fr 1fr !important; }
          .bb-nav { display: none !important; }
          .bb-pad { padding: 64px 20px !important; }
          .bb-h2 { font-size: 38px !important; }
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
          background: "rgba(19,18,17,0.92)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 24px",
            height: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: 22,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {name}
          </span>
          <nav className="bb-nav" style={{ display: "flex", gap: 28, ...meta }}>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Tarifs
            </a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Galerie
            </a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Avis
            </a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Contact
            </a>
          </nav>
          <a
            href="#reserver"
            style={{
              background: accent,
              color: C.bg,
              padding: "11px 20px",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Réserver
          </a>
        </div>
      </header>

      {/* ── Hero plein cadre ── */}
      <section style={{ position: "relative", borderBottom: `1px solid ${C.line}` }}>
        <img
          src={kit.hero}
          alt={`${label} à ${cityLabel}`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.85) brightness(0.42)" }}
        />
        <div
          className="bb-pad"
          style={{ position: "relative", maxWidth: 1240, margin: "0 auto", padding: "120px 24px 96px" }}
        >
          <div style={{ ...meta, color: accent, marginBottom: 20 }}>
            {label} — {cityLabel}
          </div>
          <h1
            className="bb-h1"
            style={{
              fontFamily: DISPLAY,
              fontSize: 104,
              lineHeight: 0.88,
              fontWeight: 600,
              textTransform: "uppercase",
              margin: 0,
              maxWidth: "12ch",
              letterSpacing: "-0.015em",
            }}
          >
            {name}
          </h1>
          <p style={{ marginTop: 26, fontSize: 19, lineHeight: 1.6, color: "rgba(237,230,216,0.82)", maxWidth: 480 }}>
            Coupe nette, barbe travaillée, serviette chaude. Le fauteuil est à vous le temps qu&apos;il faut.
          </p>

          {/* Signature : le prochain fauteuil libre */}
          <div
            className="bb-hero-grid"
            style={{ marginTop: 44, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 220px))", gap: 2 }}
          >
            <div style={{ background: accent, color: C.bg, padding: "20px 22px" }}>
              <div style={{ ...meta, color: "rgba(19,18,17,0.65)" }}>Prochain fauteuil</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>{nextFree}</div>
            </div>
            <div style={{ background: C.panel, padding: "20px 22px", border: `1px solid ${C.line}` }}>
              <div style={meta}>En attente</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>
                {waiting} <span style={{ fontSize: 16, color: C.inkSoft }}>pers.</span>
              </div>
            </div>
            <div style={{ background: C.panel, padding: "20px 22px", border: `1px solid ${C.line}` }}>
              <div style={meta}>Note Google</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>
                {avg}
                <span style={{ fontSize: 16, color: C.inkSoft }}>/5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bb-pole" style={{ height: 10 }} aria-hidden />

      {/* ── Tarifs : le tableau ── */}
      <section id="prestations" className="bb-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 48 }}>
            <h2 className="bb-h2" style={h2}>
              {kit.labels.catalogue}
              <br />
              <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
            <p style={{ ...meta, maxWidth: 300, lineHeight: 1.7, textTransform: "none", letterSpacing: 0, fontSize: 14 }}>
              {kit.labels.catalogueNote}
            </p>
          </div>

          <div className="bb-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 56px" }}>
            {kit.services.map((s) => (
              <div key={s.name} style={{ padding: "22px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 24,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px dotted ${C.line}`,
                      transform: "translateY(-4px)",
                      minWidth: 20,
                    }}
                    aria-hidden
                  />
                  {s.duration != null && <span style={{ ...meta, whiteSpace: "nowrap" }}>{s.duration}′</span>}
                  <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, color: accent, whiteSpace: "nowrap" }}>
                    {s.price} €
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Réserver ── */}
      <section id="reserver" className="bb-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div
          className="bb-two"
          style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 56, alignItems: "center" }}
        >
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 16 }}>Sans attente</div>
            <h2 className="bb-h2" style={h2}>
              Bloquez
              <br />
              votre fauteuil.
            </h2>
            <p style={{ marginTop: 22, color: C.inkSoft, fontSize: 17, lineHeight: 1.7, maxWidth: 400 }}>
              Choisissez l&apos;heure, c&apos;est réservé. Pas de fil d&apos;attente, pas d&apos;appel pendant que vous
              travaillez.
            </p>
            <a
              href={`tel:${tel}`}
              style={{
                display: "inline-block",
                marginTop: 28,
                background: accent,
                color: C.bg,
                padding: "15px 30px",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                textDecoration: "none",
              }}
            >
              {kit.labels.cta}
            </a>
          </div>
          <div style={{ border: `1px solid ${C.line}`, background: C.bg, padding: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 22, textTransform: "uppercase", fontWeight: 500 }}>
                Aujourd&apos;hui
              </span>
              <span style={{ ...meta, color: accent }}>{slots.filter((s) => !s.taken).length} libres</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
              {slots.map((s) => (
                <span
                  key={s.time}
                  className={`bb-slot${s.taken ? " is-taken" : ""}`}
                  style={{
                    textAlign: "center",
                    padding: "14px 0",
                    fontFamily: DISPLAY,
                    fontSize: 17,
                    fontWeight: 500,
                    background: s.taken ? "transparent" : C.panel,
                    color: s.taken ? "rgba(237,230,216,0.22)" : C.ink,
                    border: `1px solid ${C.line}`,
                    textDecoration: s.taken ? "line-through" : "none",
                    cursor: s.taken ? "default" : "pointer",
                  }}
                >
                  {s.time}
                </span>
              ))}
            </div>
            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 13, marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
              Rappel SMS 2 h avant. Annulation libre jusqu&apos;à la veille.
            </p>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="bb-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <h2 className="bb-h2" style={{ ...h2, marginBottom: 40 }}>
            {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="bb-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {kit.gallery.map((src, i) => (
              <figure key={src} className="bb-shot" style={{ margin: 0, aspectRatio: "1", overflow: "hidden", background: C.panel }}>
                <img
                  src={src}
                  alt={`Coupe ${i + 1} — ${name}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── À propos + avis ── */}
      <section id="avis" className="bb-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div className="bb-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, marginBottom: 64 }}>
            <div>
              <div style={{ ...meta, color: accent, marginBottom: 16 }}>La boutique</div>
              <p style={{ fontSize: 20, lineHeight: 1.7, margin: 0, color: "rgba(237,230,216,0.86)" }}>{about}</p>
            </div>
            <figure className="bb-shot" style={{ margin: 0, aspectRatio: "16/10", overflow: "hidden" }}>
              <img src={kit.about} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
            <Stars value={avg} color={accent} size={18} />
            <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 500 }}>{avg}/5</span>
            <span style={meta}>{reviewCount} avis Google</span>
          </div>
          <div className="bb-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {kit.testimonials.map((t) => (
              <blockquote
                key={t.author}
                style={{ margin: 0, background: C.bg, border: `1px solid ${C.line}`, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}
              >
                <Stars value={t.rating} color={accent} size={13} />
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, flex: 1, color: "rgba(237,230,216,0.88)" }}>
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

      {/* ── Contact ── */}
      <section id="contact" className="bb-pad" style={{ padding: "88px 24px" }}>
        <div className="bb-two" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div>
            <h2 className="bb-h2" style={h2}>
              Où nous
              <br />
              <span style={{ color: accent }}>trouver.</span>
            </h2>
            <div style={{ marginTop: 32, fontSize: 18, lineHeight: 1.8 }}>
              {address || "Centre-ville"}
              <br />
              {cityLabel}, France
              <br />
              <a className="bb-link" href={`tel:${tel}`}>
                {phone || "—"}
              </a>
            </div>
          </div>
          <div style={{ border: `1px solid ${C.line}` }}>
            {[
              ["Lundi", "Fermé"],
              ["Mardi — vendredi", "09:00 – 19:00"],
              ["Samedi", "08:30 – 18:00"],
              ["Dimanche", "Fermé"],
            ].map(([d, h]) => (
              <div
                key={d}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "18px 24px",
                  borderBottom: `1px solid ${C.line}`,
                  fontFamily: DISPLAY,
                  fontSize: 17,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(237,230,216,0.3)" : accent }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bb-pole" style={{ height: 10 }} aria-hidden />

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
