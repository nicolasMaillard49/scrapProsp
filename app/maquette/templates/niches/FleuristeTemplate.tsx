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
  type OfferTheme,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Fleuriste — direction « Saisons ».
 *
 * Seule niche de la série SANS module de réservation : on ne réserve pas un
 * créneau chez un fleuriste, on passe, on appelle, on commande. La maquette est
 * donc une VITRINE — et l'offre affichée en bas suit (300 € et non 500 €).
 *
 * Signature : le calendrier de floraison. C'est le savoir que le fleuriste a et
 * que le client n'a pas ; l'afficher prouve le métier mieux qu'une photo de
 * bouquet de plus, et donne une raison de revenir sur le site chaque mois.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#EDF0E9",
  panel: "#FAFBF8",
  ink: "#1F2A1C",
  inkSoft: "rgba(31,42,28,0.6)",
  line: "rgba(31,42,28,0.16)",
  rose: "#C58A94",
};

const DISPLAY = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Jost', system-ui, sans-serif";

const SEASONS = [
  { m: "Janv.", f: "Renoncule" },
  { m: "Févr.", f: "Mimosa" },
  { m: "Mars", f: "Tulipe" },
  { m: "Avril", f: "Lilas" },
  { m: "Mai", f: "Pivoine" },
  { m: "Juin", f: "Rose de jardin" },
  { m: "Juil.", f: "Tournesol" },
  { m: "Août", f: "Dahlia" },
  { m: "Sept.", f: "Cosmos" },
  { m: "Oct.", f: "Chrysanthème" },
  { m: "Nov.", f: "Amaryllis" },
  { m: "Déc.", f: "Hellébore" },
];

export default function FleuristeTemplate({
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
  const label = metierLabel(metier || "Fleuriste");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const avg = rating ?? 4.9;
  const reviewCount = reviews ?? 68;
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);

  const theme: OfferTheme = {
    bg: C.panel,
    panel: C.bg,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: "#fff",
    radius: 3,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.2em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 300,
    fontSize: 58,
    lineHeight: 1.02,
    margin: 0,
    letterSpacing: "-0.01em",
  };

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
        ${SHARED_CSS}
        .fl-shot img { transition: transform .9s cubic-bezier(.2,.7,.3,1); }
        .fl-shot:hover img { transform: scale(1.04); }
        .fl-link { color: inherit; text-decoration: none; border-bottom: 1px solid ${accent}; padding-bottom: 2px; }
        .fl-link:hover { color: ${accent}; }
        .fl-rail { scrollbar-width: thin; }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .fl-hero { grid-template-columns: 1fr !important; gap: 32px !important; }
          .fl-h1 { font-size: 64px !important; }
          .fl-two { grid-template-columns: 1fr !important; }
          .fl-shots { grid-template-columns: 1fr 1fr !important; }
          .fl-offset { margin-top: 0 !important; }
          .fl-nav { display: none !important; }
          .fl-pad { padding: 60px 20px !important; }
          .fl-h2 { font-size: 40px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(237,240,233,0.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.line}` }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 27, fontWeight: 400 }}>{name}</span>
          <nav className="fl-nav" style={{ display: "flex", gap: 30, ...meta }}>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              L&apos;atelier
            </a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Compositions
            </a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Avis
            </a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>
              La boutique
            </a>
          </nav>
          <a
            href={`tel:${tel}`}
            style={{
              border: `1px solid ${accent}`,
              color: accent,
              padding: "11px 22px",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero décalé ── */}
      <section className="fl-pad" style={{ padding: "72px 24px 88px" }}>
        <div className="fl-hero" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          <div style={{ paddingTop: 40 }}>
            <div style={{ ...meta, marginBottom: 24 }}>
              {label} · {cityLabel}
            </div>
            <h1 className="fl-h1" style={{ ...h2, fontSize: 96, lineHeight: 0.94 }}>
              Ce qui pousse
              <br />
              <span style={{ fontStyle: "italic", color: accent }}>maintenant</span>.
            </h1>
            <p style={{ marginTop: 28, fontSize: 18, lineHeight: 1.8, color: C.inkSoft, maxWidth: 400 }}>
              Des fleurs choisies au marché le matin même, montées à la main devant vous. Pas de catalogue :
              la saison décide, on compose.
            </p>
            <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center" }}>
              <a
                href={`tel:${tel}`}
                style={{ background: C.ink, color: C.panel, padding: "16px 32px", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "none" }}
              >
                Commander par téléphone
              </a>
              <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Stars value={avg} color={accent} size={13} /> {avg}/5 · {reviewCount} avis
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <figure className="fl-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "3/4" }}>
              <img src={kit.hero} alt={`${label} à ${cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
            <figure className="fl-shot fl-offset" style={{ margin: 0, marginTop: 56, overflow: "hidden", aspectRatio: "3/4" }}>
              <img src={kit.about} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Le calendrier — signature ── */}
      <section style={{ background: C.ink, color: C.panel, padding: "56px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 24px" }}>
          <div style={{ ...meta, color: "rgba(250,251,248,0.55)", marginBottom: 6 }}>Le calendrier de l&apos;atelier</div>
          <h2 className="fl-h2" style={{ ...h2, fontSize: 40, color: C.panel }}>
            Chaque mois, sa <span style={{ fontStyle: "italic", color: C.rose }}>fleur</span>.
          </h2>
        </div>
        <div className="fl-rail" style={{ overflowX: "auto", padding: "0 24px" }}>
          <div style={{ display: "flex", gap: 0, maxWidth: 1200, margin: "0 auto", minWidth: "max-content" }}>
            {SEASONS.map((s, i) => {
              const on = i === month;
              return (
                <div
                  key={s.m}
                  style={{
                    minWidth: 118,
                    padding: "22px 18px 26px",
                    borderLeft: `1px solid ${i === 0 ? "transparent" : "rgba(250,251,248,0.18)"}`,
                    background: on ? C.rose : "transparent",
                    color: on ? C.ink : "inherit",
                  }}
                >
                  <div style={{ ...meta, color: on ? "rgba(31,42,28,0.6)" : "rgba(250,251,248,0.5)", fontSize: 10 }}>{s.m}</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 22, marginTop: 6, lineHeight: 1.2 }}>{s.f}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── L'atelier ── */}
      <section id="prestations" className="fl-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="fl-two" style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 56 }}>
            <div>
              <h2 className="fl-h2" style={h2}>
                {kit.labels.catalogue}
                <br />
                <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
              </h2>
              <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 15, lineHeight: 1.7, marginTop: 20, maxWidth: 300 }}>
                {kit.labels.catalogueNote}
              </p>
            </div>
            <div>
              {kit.services.map((s) => (
                <div key={s.name} style={{ padding: "24px 0", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 30, flex: 1, minWidth: 0 }}>{s.name}</span>
                    <span style={{ ...meta, color: accent }}>{s.cat}</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 26, whiteSpace: "nowrap" }}>
                      {priceLabel(s.price, s.from)}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", color: C.inkSoft, fontSize: 15.5, lineHeight: 1.65, maxWidth: 520 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Compositions ── */}
      <section id="galerie" className="fl-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 className="fl-h2" style={{ ...h2, marginBottom: 44 }}>
            {kit.labels.gallery} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="fl-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.gallery.map((src, i) => (
              <figure
                key={src}
                className="fl-shot"
                style={{
                  margin: 0,
                  overflow: "hidden",
                  aspectRatio: i % 3 === 1 ? "3/4" : "1",
                  marginTop: i % 3 === 1 ? 32 : 0,
                }}
              >
                <img src={src} alt={`Composition ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── La maison + avis ── */}
      <section id="avis" className="fl-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ maxWidth: 720, margin: "0 auto 64px", textAlign: "center" }}>
            <div style={{ ...meta, marginBottom: 18 }}>La maison</div>
            <p style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: 1.5, color: C.ink, margin: 0, fontWeight: 300 }}>
              {about}
            </p>
          </div>
          <div className="fl-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, borderTop: `1px solid ${C.line}`, paddingTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <Stars value={t.rating} color={accent} size={13} />
                <p style={{ fontFamily: DISPLAY, fontSize: 21, lineHeight: 1.5, margin: 0, flex: 1, fontStyle: "italic" }}>
                  « {t.comment} »
                </p>
                <footer style={{ ...meta, display: "flex", justifyContent: "space-between" }}>
                  <span>{t.author}</span>
                  <span>{t.date}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── La boutique ── */}
      <section id="contact" className="fl-pad" style={{ background: C.ink, color: C.panel, padding: "96px 24px" }}>
        <div className="fl-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          <div>
            <h2 className="fl-h2" style={{ ...h2, color: C.panel }}>
              Passez à la <span style={{ fontStyle: "italic", color: C.rose }}>boutique</span>.
            </h2>
            <div style={{ marginTop: 30, fontSize: 18, lineHeight: 1.9, color: "rgba(250,251,248,0.75)" }}>
              {address || "Centre-ville"}
              <br />
              {cityLabel}, France
              <br />
              <a className="fl-link" href={`tel:${tel}`} style={{ color: C.panel, borderColor: C.rose }}>
                {phone || "—"}
              </a>
            </div>
            <p style={{ marginTop: 28, color: "rgba(250,251,248,0.6)", fontSize: 15.5, lineHeight: 1.7, maxWidth: 380 }}>
              Commande par téléphone jusqu&apos;à 16 h pour une livraison le jour même sur {cityLabel} et ses
              environs.
            </p>
          </div>
          <div>
            <div style={{ ...meta, color: "rgba(250,251,248,0.5)", marginBottom: 10 }}>Ouverture</div>
            {[
              ["Mardi — vendredi", "09:00 – 19:00"],
              ["Samedi", "08:30 – 19:30"],
              ["Dimanche", "09:00 – 13:00"],
              ["Lundi", "Fermé"],
            ].map(([d, h]) => (
              <div
                key={d}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "17px 0",
                  borderBottom: "1px solid rgba(250,251,248,0.18)",
                  fontSize: 16,
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontSize: 21 }}>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(250,251,248,0.35)" : C.rose }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={label} ville={cityLabel} />}

      <footer style={{ background: C.bg, color: C.inkSoft, padding: "36px 24px", borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
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
