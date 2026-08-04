import type { TemplateProps } from "../data";
import { metierLabel } from "../data";
import { kitForMetier } from "../nicheKits";
import {
  DemoBanner,
  NmfCredit,
  OfferBlock,
  SHARED_CSS,
  Stars,
  priceLabel,
  seedOf,
  type OfferTheme,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Tatoueur — direction « Flash ».
 *
 * Un tatoueur ne vend pas un créneau de 30 minutes : il vend un PROJET, qui
 * commence par une consultation et se paie à l'acompte. Le module de
 * réservation prend donc la forme d'une demande de projet — zone, taille,
 * style — parce que c'est exactement ce qu'il doit savoir avant de répondre.
 *
 * Noir, os et rouge sang, grotesque très grasse et planche de flash numérotée :
 * le studio a son propre code visuel, il n'a pas besoin d'être adouci.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#0B0B0C",
  panel: "#151517",
  ink: "#E8E4DA",
  inkSoft: "rgba(232,228,218,0.55)",
  line: "rgba(232,228,218,0.15)",
};

const DISPLAY = "'Archivo Black', Impact, sans-serif";
const BODY = "'Space Grotesk', monospace";

const ZONES = ["Avant-bras", "Épaule", "Dos", "Jambe", "Côtes", "Main"];
const SIZES = ["< 10 cm", "10–20 cm", "> 20 cm"];
const STYLES = ["Fine line", "Traditionnel", "Blackwork", "Réalisme", "Lettrage"];

export default function TatoueurTemplate({
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
  const label = metierLabel(metier || "Tatoueur");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 5;
  const reviewCount = reviews ?? 89;
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);
  const pickZone = seed % ZONES.length;
  const pickSize = (seed >> 3) % SIZES.length;
  const pickStyle = (seed >> 6) % STYLES.length;
  const pad = (n: number) => String(n).padStart(2, "0");

  const theme: OfferTheme = {
    bg: C.panel,
    panel: C.bg,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.ink,
    radius: 0,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.18em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontSize: 52,
    lineHeight: 0.92,
    letterSpacing: "-0.02em",
    textTransform: "uppercase",
    margin: 0,
  };

  const chip = (on: boolean): React.CSSProperties => ({
    padding: "11px 18px",
    border: `1px solid ${on ? accent : C.line}`,
    background: on ? accent : "transparent",
    color: on ? C.ink : C.inkSoft,
    fontSize: 13,
    letterSpacing: "0.04em",
    cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&display=swap');
        ${SHARED_CSS}
        .ta-shot img { filter: grayscale(1) contrast(1.15); transition: filter .45s ease, transform .7s ease; }
        .ta-shot:hover img { filter: grayscale(0) contrast(1.05); transform: scale(1.04); }
        .ta-chip { transition: background .16s ease, color .16s ease, border-color .16s ease; }
        .ta-chip:hover { border-color: ${accent}; color: ${C.ink}; }
        .ta-link { color: ${accent}; text-decoration: none; }
        .ta-link:hover { text-decoration: underline; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ta-hero { grid-template-columns: 1fr !important; }
          .ta-h1 { font-size: 60px !important; }
          .ta-two { grid-template-columns: 1fr !important; }
          .ta-shots { grid-template-columns: 1fr 1fr !important; }
          .ta-nav { display: none !important; }
          .ta-pad { padding: 60px 20px !important; }
          .ta-h2 { font-size: 34px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(11,11,12,0.93)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.line}` }}>
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
          <span style={{ fontFamily: DISPLAY, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
            {name}
          </span>
          <nav className="ta-nav" style={{ display: "flex", gap: 28, ...meta }}>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Book
            </a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Tarifs
            </a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Avis
            </a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Studio
            </a>
          </nav>
          <a
            href="#projet"
            style={{
              background: accent,
              color: C.ink,
              padding: "11px 20px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Mon projet
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ta-pad" style={{ padding: "80px 24px 0" }}>
        <div className="ta-hero" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "end" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 22 }}>
              {label} — {cityLabel}
            </div>
            <h1 className="ta-h1" style={{ ...h2, fontSize: 96 }}>
              L&apos;encre
              <br />
              ne se
              <br />
              <span style={{ color: accent }}>reprend pas.</span>
            </h1>
            <p style={{ marginTop: 28, fontSize: 17, lineHeight: 1.75, color: C.inkSoft, maxWidth: 420 }}>
              Chaque projet commence par un dessin, jamais par une aiguille. Consultation gratuite, devis
              ferme, studio déclaré.
            </p>
            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <a
                href="#projet"
                style={{
                  background: accent,
                  color: C.ink,
                  padding: "17px 32px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
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
          <figure className="ta-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "4/5" }}>
            <img src={kit.hero} alt={`${label} à ${cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Bandeau ── */}
      <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, marginTop: 72 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 24px", display: "flex", flexWrap: "wrap", gap: 30, justifyContent: "space-between", ...meta }}>
          {kit.ticker.map((t) => (
            <span key={t}>
              <span style={{ color: accent, marginRight: 8 }}>/</span>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Demande de projet — signature ── */}
      <section id="projet" className="ta-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div className="ta-two" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 56 }}>
          <div>
            <h2 className="ta-h2" style={h2}>
              Votre
              <br />
              projet.
            </h2>
            <p style={{ marginTop: 22, color: C.inkSoft, fontSize: 16, lineHeight: 1.75, maxWidth: 340 }}>
              Trois réponses suffisent pour que je chiffre. Je reviens vers vous sous 48 h avec une
              proposition de dessin et une date.
            </p>
            <div style={{ marginTop: 32, borderTop: `1px solid ${C.line}`, paddingTop: 20 }}>
              <div style={{ ...meta, marginBottom: 6 }}>Acompte à la réservation</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 34, color: accent }}>50 €</div>
              <div style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
                déduit du montant final, il bloque la date.
              </div>
            </div>
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.line}`, padding: 34 }}>
            <div style={{ ...meta, marginBottom: 14 }}>01 — La zone</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {ZONES.map((z, i) => (
                <span key={z} className="ta-chip" style={chip(i === pickZone)}>
                  {z}
                </span>
              ))}
            </div>

            <div style={{ ...meta, marginBottom: 14 }}>02 — La taille</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {SIZES.map((s, i) => (
                <span key={s} className="ta-chip" style={chip(i === pickSize)}>
                  {s}
                </span>
              ))}
            </div>

            <div style={{ ...meta, marginBottom: 14 }}>03 — Le style</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 30 }}>
              {STYLES.map((s, i) => (
                <span key={s} className="ta-chip" style={chip(i === pickStyle)}>
                  {s}
                </span>
              ))}
            </div>

            <a
              href={`tel:${tel}`}
              style={{
                display: "block",
                textAlign: "center",
                background: accent,
                color: C.ink,
                padding: "16px 0",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Envoyer ma demande
            </a>
            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 12.5, marginTop: 14, marginBottom: 0, textAlign: "center", lineHeight: 1.6 }}>
              Réponse sous 48 h · consultation offerte · aucun engagement
            </p>
          </div>
        </div>
      </section>

      {/* ── Le book ── */}
      <section id="galerie" className="ta-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 36 }}>
            <h2 className="ta-h2" style={h2}>
              {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
            </h2>
            <span style={meta}>{kit.gallery.length} pièces récentes</span>
          </div>
          <div className="ta-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.line }}>
            {kit.gallery.map((src, i) => (
              <figure key={src} className="ta-shot" style={{ margin: 0, position: "relative", aspectRatio: "1", overflow: "hidden", background: C.bg }}>
                <img src={src} alt={`Pièce ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    top: 10,
                    ...meta,
                    color: C.ink,
                    background: "rgba(11,11,12,0.75)",
                    padding: "3px 8px",
                  }}
                >
                  {pad(i + 1)}
                </span>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="prestations" className="ta-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 44 }}>
            <h2 className="ta-h2" style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 14, maxWidth: 320, lineHeight: 1.7 }}>
              {kit.labels.catalogueNote}
            </p>
          </div>
          <div>
            {kit.services.map((s, i) => (
              <div
                key={s.name}
                className="ta-two"
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr auto auto",
                  gap: 24,
                  alignItems: "baseline",
                  padding: "24px 0",
                  borderTop: `1px solid ${C.line}`,
                }}
              >
                <span style={{ ...meta, color: accent }}>{pad(i + 1)}</span>
                <div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 24, textTransform: "uppercase" }}>{s.name}</div>
                  <p style={{ margin: "6px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
                {s.duration != null && <span style={{ ...meta, whiteSpace: "nowrap" }}>{s.duration} min</span>}
                <span style={{ fontFamily: DISPLAY, fontSize: 24, color: accent, whiteSpace: "nowrap" }}>
                  {priceLabel(s.price, s.from)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Studio + avis ── */}
      <section id="avis" className="ta-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div className="ta-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, marginBottom: 64, alignItems: "center" }}>
            <figure className="ta-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "16/11" }}>
              <img src={kit.about} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
            <div>
              <div style={{ ...meta, color: accent, marginBottom: 16 }}>Le studio</div>
              <p style={{ fontSize: 18, lineHeight: 1.8, margin: 0, color: "rgba(232,228,218,0.85)" }}>{about}</p>
            </div>
          </div>

          <div className="ta-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.line }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, background: C.bg, padding: 30, display: "flex", flexDirection: "column", gap: 16 }}>
                <Stars value={t.rating} color={accent} size={13} />
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, flex: 1, color: "rgba(232,228,218,0.88)" }}>
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

      {/* ── Studio / contact ── */}
      <section id="contact" className="ta-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div className="ta-two" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          <div>
            <h2 className="ta-h2" style={h2}>
              Le
              <br />
              <span style={{ color: accent }}>studio.</span>
            </h2>
            <div style={{ marginTop: 30, fontSize: 17, lineHeight: 1.9, color: C.inkSoft }}>
              {address || "Centre-ville"}
              <br />
              {cityLabel}, France
              <br />
              <a className="ta-link" href={`tel:${tel}`}>
                {phone || "—"}
              </a>
            </div>
          </div>
          <div>
            <div style={{ ...meta, marginBottom: 10 }}>Sur rendez-vous</div>
            {[
              ["Mardi — samedi", "11:00 – 19:00"],
              ["Dimanche — lundi", "Fermé"],
              ["Consultation", "sur créneau dédié"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "18px 0", borderBottom: `1px solid ${C.line}`, fontSize: 15 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 17, textTransform: "uppercase" }}>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(232,228,218,0.3)" : accent }}>{h}</span>
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
