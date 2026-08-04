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
 * Onglerie — direction « Studio pop ».
 *
 * L'onglerie se vend sur Instagram, à des clientes qui choisissent d'abord une
 * FORME et une COULEUR, le prix ensuite. La page reprend cette logique : gros
 * arrondis, dégradé rose/violet, blocs façon stickers — le vocabulaire visuel
 * du feed, pas celui d'un institut feutré.
 *
 * Signature : le sélecteur de pose (forme + couleur). Il transforme la maquette
 * en essayage : on ne lit pas une carte de prestations, on compose la sienne,
 * et le créneau se réserve dans la foulée.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FFF4F8",
  panel: "#FFFFFF",
  ink: "#1E0F1A",
  inkSoft: "rgba(30,15,26,0.6)",
  veil: "rgba(30,15,26,0.09)",
};

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Outfit', system-ui, sans-serif";

const SHAPES = [
  { key: "amande", label: "Amande", d: "M12 46 L12 22 Q12 4 24 4 Q36 4 36 22 L36 46 Z" },
  { key: "carre", label: "Carré", d: "M12 46 L12 12 Q12 6 18 6 L30 6 Q36 6 36 12 L36 46 Z" },
  { key: "ballerine", label: "Ballerine", d: "M12 46 L14 20 Q14 6 24 6 Q34 6 34 20 L36 46 Z" },
  { key: "ovale", label: "Ovale", d: "M12 46 L12 24 Q12 6 24 6 Q36 6 36 24 L36 46 Z" },
];

const COLORS = ["#E8467C", "#A855F7", "#F0A6C0", "#C2185B", "#6D28D9", "#F7D6E0", "#2E1F2B", "#E4B7A0"];

export default function OnglerieTemplate({
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
  const violet = "#A855F7";
  const label = metierLabel(metier || "Onglerie");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 4.9;
  const reviewCount = reviews ?? 112;
  const slots = daySlots(seed, 10, 18, 45);
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);
  const pickedShape = seed % SHAPES.length;
  const pickedColor = (seed >> 4) % COLORS.length;
  const gradient = `linear-gradient(120deg, ${accent}, ${violet})`;

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: "#fff",
    radius: 28,
    border: "none",
    shadow: "0 20px 44px -30px rgba(30,15,26,0.5)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.14em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.inkSoft,
  };

  const card: React.CSSProperties = {
    background: C.panel,
    borderRadius: 28,
    boxShadow: "0 20px 44px -30px rgba(30,15,26,0.5)",
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 700,
    fontSize: 52,
    lineHeight: 1.02,
    letterSpacing: "-0.03em",
    margin: 0,
  };

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Outfit:wght@300..700&display=swap');
        ${SHARED_CSS}
        .on-shot img { transition: transform .5s ease; }
        .on-shot:hover img { transform: scale(1.06) rotate(-1deg); }
        .on-chip { transition: transform .2s ease, box-shadow .2s ease; }
        .on-chip:hover { transform: translateY(-2px); }
        .on-slot { transition: background .2s ease, color .2s ease; }
        .on-slot:not(.is-taken):hover { background: ${gradient}; color: #fff; }
        @keyframes on-marquee { to { transform: translateX(-50%); } }
        .on-marquee { animation: on-marquee 22s linear infinite; }
        a:focus-visible, button:focus-visible { outline: 3px solid ${violet}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .on-hero { grid-template-columns: 1fr !important; }
          .on-h1 { font-size: 60px !important; }
          .on-two { grid-template-columns: 1fr !important; }
          .on-cards { grid-template-columns: 1fr !important; }
          .on-shots { grid-template-columns: 1fr 1fr !important; }
          .on-nav { display: none !important; }
          .on-pad { padding: 60px 20px !important; }
          .on-h2 { font-size: 38px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,244,248,0.9)", backdropFilter: "blur(12px)" }}>
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
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>{name}</span>
          <nav className="on-nav" style={{ display: "flex", gap: 28, ...meta }}>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Tarifs
            </a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Réalisations
            </a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Avis
            </a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Contact
            </a>
          </nav>
          <a
            href="#composer"
            style={{
              background: gradient,
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="on-pad" style={{ position: "relative", padding: "60px 24px 80px", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: gradient,
            opacity: 0.16,
            filter: "blur(20px)",
          }}
          aria-hidden
        />
        <div
          className="on-hero"
          style={{ position: "relative", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 52, alignItems: "center" }}
        >
          <div>
            <span
              style={{
                display: "inline-block",
                background: gradient,
                color: "#fff",
                padding: "7px 16px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 22,
              }}
            >
              {label} · {cityLabel}
            </span>
            <h1 className="on-h1" style={{ ...h2, fontSize: 84, lineHeight: 0.96 }}>
              Des ongles
              <br />
              <span
                style={{
                  background: gradient,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                qu&apos;on remarque.
              </span>
            </h1>
            <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 440 }}>
              Pose nette, tenue longue et des couleurs qu&apos;on ne voit pas partout. Composez la vôtre, on
              s&apos;occupe du reste.
            </p>
            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <a
                href="#composer"
                style={{
                  background: C.ink,
                  color: "#fff",
                  padding: "17px 34px",
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Composer ma pose
              </a>
              <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Stars value={avg} color={accent} size={13} /> {avg}/5 · {reviewCount} avis
              </span>
            </div>
          </div>
          <figure className="on-shot" style={{ margin: 0, borderRadius: 40, overflow: "hidden", aspectRatio: "1" }}>
            <img src={kit.hero} alt={`${label} à ${cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div style={{ background: C.ink, color: "#fff", padding: "12px 0", overflow: "hidden" }}>
        <div className="on-marquee" style={{ display: "flex", gap: 34, width: "max-content", ...meta, color: "rgba(255,255,255,0.8)" }}>
          {[0, 1].map((n) => (
            <span key={n} style={{ display: "inline-flex", gap: 34 }}>
              {kit.ticker.map((t) => (
                <span key={t} style={{ display: "inline-flex", gap: 34 }}>
                  {t} <span style={{ color: accent }}>✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── Le composeur — signature ── */}
      <section id="composer" className="on-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div style={{ ...meta, marginBottom: 12 }}>Étape 1 — votre pose</div>
            <h2 className="on-h2" style={h2}>
              Forme, couleur, créneau.
            </h2>
          </div>

          <div className="on-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ ...card, padding: "34px 32px" }}>
              <div style={{ ...meta, marginBottom: 20 }}>La forme</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {SHAPES.map((s, i) => (
                  <div
                    key={s.key}
                    className="on-chip"
                    style={{
                      flex: "1 1 90px",
                      textAlign: "center",
                      padding: "16px 8px 12px",
                      borderRadius: 20,
                      cursor: "pointer",
                      background: i === pickedShape ? gradient : C.bg,
                      color: i === pickedShape ? "#fff" : C.ink,
                    }}
                  >
                    <svg width={40} height={50} viewBox="0 0 48 50" aria-hidden>
                      <path d={s.d} fill={i === pickedShape ? "#fff" : COLORS[pickedColor]} opacity={i === pickedShape ? 0.95 : 0.85} />
                    </svg>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...meta, margin: "28px 0 16px" }}>La couleur</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COLORS.map((col, i) => (
                  <span
                    key={col}
                    className="on-chip"
                    title={`Teinte ${i + 1}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: col,
                      cursor: "pointer",
                      display: "inline-block",
                      boxShadow: i === pickedColor ? `0 0 0 3px ${C.panel}, 0 0 0 5px ${C.ink}` : "none",
                    }}
                  />
                ))}
              </div>

              {/* Récap : ce que la cliente vient de composer, avec la durée à
                  bloquer. C'est le pont vers l'étape 2 — sans lui, la carte de
                  gauche s'arrête dans le vide. */}
              <div
                style={{
                  marginTop: 28,
                  paddingTop: 20,
                  borderTop: `1px solid ${C.veil}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ ...meta, fontSize: 10, marginBottom: 4 }}>Votre pose</div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
                    {SHAPES[pickedShape].label}
                    <span style={{ color: C.inkSoft, fontWeight: 400 }}> · semi-permanent</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...meta, fontSize: 10, marginBottom: 4 }}>À bloquer</div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20 }}>60 min</div>
                </div>
              </div>
            </div>

            <div style={{ ...card, padding: "34px 32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <span style={{ ...meta, margin: 0 }}>Étape 2 — le créneau</span>
                <span style={{ ...meta, color: accent }}>{slots.filter((s) => !s.taken).length} libres</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {slots.map((s) => (
                  <span
                    key={s.time}
                    className={`on-slot${s.taken ? " is-taken" : ""}`}
                    style={{
                      textAlign: "center",
                      padding: "14px 0",
                      borderRadius: 999,
                      fontSize: 15,
                      fontWeight: 600,
                      background: s.taken ? C.bg : "transparent",
                      border: `2px solid ${s.taken ? "transparent" : C.veil}`,
                      color: s.taken ? "rgba(30,15,26,0.25)" : C.ink,
                      textDecoration: s.taken ? "line-through" : "none",
                      cursor: s.taken ? "default" : "pointer",
                    }}
                  >
                    {s.time}
                  </span>
                ))}
              </div>
              <a
                href={`tel:${tel}`}
                style={{
                  display: "block",
                  marginTop: 22,
                  textAlign: "center",
                  background: gradient,
                  color: "#fff",
                  padding: "16px 0",
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Je réserve ce créneau
              </a>
              <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 13, marginTop: 16, marginBottom: 0, textAlign: "center", lineHeight: 1.6 }}>
                Confirmation immédiate · rappel SMS · annulation gratuite 24 h avant
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="prestations" className="on-pad" style={{ padding: "40px 24px 96px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 40 }}>
            <h2 className="on-h2" style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 15, marginTop: 12 }}>
              {kit.labels.catalogueNote}
            </p>
          </div>
          <div className="on-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.services.map((s, i) => (
              <article key={s.name} className="on-chip" style={{ ...card, padding: "28px 26px", position: "relative", overflow: "hidden" }}>
                <span
                  style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: COLORS[i % COLORS.length],
                    opacity: 0.85,
                  }}
                  aria-hidden
                />
                <div style={{ ...meta, color: accent, marginBottom: 10 }}>{s.cat}</div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
                  {s.name}
                </h3>
                <p style={{ margin: "0 0 22px", color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>{s.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: `1px solid ${C.veil}`, paddingTop: 16 }}>
                  {s.duration != null && <span style={meta}>{s.duration} min</span>}
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 28 }}>{s.price} €</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Réalisations ── */}
      <section id="galerie" className="on-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 className="on-h2" style={{ ...h2, marginBottom: 36 }}>
            {kit.labels.gallery} <span style={{ color: violet }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="on-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.gallery.map((src, i) => (
              <figure key={src} className="on-shot" style={{ margin: 0, borderRadius: 28, overflow: "hidden", aspectRatio: i % 4 === 0 ? "4/5" : "1" }}>
                <img src={src} alt={`Pose ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
          <div className="on-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 64, alignItems: "center" }}>
            <p style={{ fontSize: 19, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{about}</p>
            <figure className="on-shot" style={{ margin: 0, borderRadius: 32, overflow: "hidden", aspectRatio: "16/10" }}>
              <img src={kit.about} alt={name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="on-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 className="on-h2" style={{ ...h2, marginBottom: 36 }}>
            Elles reviennent <span style={{ color: accent }}>toutes</span>.
          </h2>
          <div className="on-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ ...card, margin: 0, padding: 30, display: "flex", flexDirection: "column", gap: 16 }}>
                <Stars value={t.rating} color={accent} size={14} />
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, flex: 1 }}>« {t.comment} »</p>
                <footer style={{ ...meta, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: violet }}>{t.author}</span>
                  <span>{t.date}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="on-pad" style={{ padding: "0 24px 96px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", ...card, padding: "48px 44px", background: gradient, color: "#fff" }}>
          <div className="on-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div>
              <h2 className="on-h2" style={{ ...h2, color: "#fff" }}>
                On vous attend.
              </h2>
              <div style={{ marginTop: 24, fontSize: 18, lineHeight: 1.9 }}>
                {address || "Centre-ville"}
                <br />
                {cityLabel}, France
                <br />
                <a href={`tel:${tel}`} style={{ color: "#fff", fontWeight: 700 }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
            <div>
              <div style={{ ...meta, color: "rgba(255,255,255,0.75)", marginBottom: 12 }}>Horaires</div>
              {[
                ["Lundi", "Fermé"],
                ["Mardi — samedi", "10:00 – 19:00"],
                ["Dimanche", "Fermé"],
              ].map(([d, h]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.25)", fontSize: 16 }}>
                  <span>{d}</span>
                  <span style={{ opacity: h === "Fermé" ? 0.6 : 1 }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={label} ville={cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(255,255,255,0.55)", padding: "36px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(255,255,255,0.55)" }}>
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
