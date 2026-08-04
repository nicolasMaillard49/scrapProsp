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
 * Esthéticienne / institut — direction « Cabine ».
 *
 * Une esthéticienne ne vend pas une prestation rapide, elle vend une parenthèse.
 * Tout est donc l'inverse du barbier : sauge et blanc, angles très arrondis,
 * ombres à peine posées, beaucoup de vide, aucune bordure dure. La page respire
 * parce que c'est ce qu'on vient y chercher.
 *
 * Signature : le cadran de durée — chaque soin affiche visuellement le temps
 * qu'on s'accorde. C'est la vraie unité de valeur du métier, avant le prix.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F2F4EF",
  panel: "#FFFFFF",
  ink: "#2A332B",
  inkSoft: "rgba(42,51,43,0.58)",
  veil: "rgba(42,51,43,0.07)",
};

const DISPLAY = "'Marcellus', Georgia, serif";
const BODY = "'Karla', system-ui, sans-serif";

/** Cadran de durée : un arc rempli au prorata d'une séance longue (120 min). */
function Dial({ minutes, accent }: { minutes: number; accent: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(minutes / 120, 1) * circ;
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke={C.veil} strokeWidth={3} />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="34" textAnchor="middle" fontFamily={BODY} fontSize="13" fontWeight="600" fill={C.ink}>
        {minutes}
      </text>
      <text x="32" y="45" textAnchor="middle" fontFamily={BODY} fontSize="8" fill={C.inkSoft} letterSpacing="1">
        MIN
      </text>
    </svg>
  );
}

export default function InstitutTemplate({
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
  const accentDark = kit.accentDark;
  const label = metierLabel(metier || "Institut de beauté");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 4.9;
  const reviewCount = reviews ?? 74;
  const slots = daySlots(seed, 10, 18, 60);
  const nextFree = slots.find((s) => !s.taken)?.time ?? "14:30";
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent: accentDark,
    onAccent: "#fff",
    radius: 26,
    border: "none",
    shadow: "0 24px 50px -34px rgba(42,51,43,0.4)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.18em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: C.inkSoft,
  };

  const soft: React.CSSProperties = {
    background: C.panel,
    borderRadius: 26,
    boxShadow: "0 24px 50px -34px rgba(42,51,43,0.4)",
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 400,
    fontSize: 50,
    lineHeight: 1.08,
    letterSpacing: "-0.01em",
    margin: 0,
  };

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Marcellus&family=Karla:wght@400;500;600&display=swap');
        ${SHARED_CSS}
        .in-shot img { transition: transform .8s cubic-bezier(.2,.7,.3,1); }
        .in-shot:hover img { transform: scale(1.05); }
        .in-card { transition: transform .3s ease, box-shadow .3s ease; }
        .in-card:hover { transform: translateY(-3px); box-shadow: 0 30px 56px -34px rgba(42,51,43,0.5); }
        .in-slot { transition: background .2s ease, color .2s ease; }
        .in-slot:not(.is-taken):hover { background: ${accent}; color: #fff; }
        .in-link { color: ${accentDark}; text-decoration: none; }
        .in-link:hover { text-decoration: underline; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${accentDark}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .in-hero { grid-template-columns: 1fr !important; gap: 36px !important; }
          .in-h1 { font-size: 54px !important; }
          .in-two { grid-template-columns: 1fr !important; }
          .in-cards { grid-template-columns: 1fr !important; }
          .in-shots { grid-template-columns: 1fr 1fr !important; }
          .in-nav { display: none !important; }
          .in-pad { padding: 64px 20px !important; }
          .in-h2 { font-size: 36px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(242,244,239,0.9)", backdropFilter: "blur(12px)" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 24px",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 23, letterSpacing: "0.01em" }}>{name}</span>
          <nav className="in-nav" style={{ display: "flex", gap: 32, ...meta }}>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Soins
            </a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              L&apos;institut
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
              background: accentDark,
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="in-pad" style={{ padding: "56px 24px 96px" }}>
        <div
          className="in-hero"
          style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}
        >
          <div>
            <div style={{ ...meta, marginBottom: 22 }}>
              {label} · {cityLabel}
            </div>
            <h1 className="in-h1" style={{ ...h2, fontSize: 76, lineHeight: 1.02 }}>
              Une heure
              <br />
              rien qu&apos;à <span style={{ color: accentDark, fontStyle: "italic" }}>vous</span>.
            </h1>
            <p style={{ marginTop: 26, fontSize: 18, lineHeight: 1.8, color: C.inkSoft, maxWidth: 420 }}>
              Des soins pensés pour votre peau, dans une cabine calme où l&apos;on ne vous presse jamais.
              Réservez le moment qui vous arrange.
            </p>
            <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <a
                href="#reserver"
                style={{
                  background: accentDark,
                  color: "#fff",
                  padding: "17px 34px",
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Réserver un soin
              </a>
              <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Stars value={avg} color={accent} size={13} /> {avg}/5 · {reviewCount} avis
              </span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <figure className="in-shot" style={{ margin: 0, borderRadius: 200, overflow: "hidden", aspectRatio: "4/5" }}>
              <img src={kit.hero} alt={`${label} à ${cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
            <div
              style={{
                ...soft,
                position: "absolute",
                left: -8,
                bottom: 28,
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent }} />
              <div>
                <div style={{ ...meta, fontSize: 10 }}>Cabine libre</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 24 }}>aujourd&apos;hui, {nextFree}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Soins ── */}
      <section id="prestations" className="in-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <div style={{ ...meta, marginBottom: 14 }}>{kit.labels.catalogueNote}</div>
            <h2 className="in-h2" style={h2}>
              {kit.labels.catalogue} <span style={{ color: accentDark, fontStyle: "italic" }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          <div className="in-cards" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {kit.services.map((s) => (
              <article
                key={s.name}
                className="in-card"
                style={{ ...soft, padding: "28px 30px", display: "flex", alignItems: "center", gap: 24 }}
              >
                {s.duration != null && <Dial minutes={s.duration} accent={accent} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...meta, color: accentDark, fontSize: 10, marginBottom: 6 }}>{s.cat}</div>
                  <h3 style={{ fontFamily: DISPLAY, fontSize: 24, margin: "0 0 6px", fontWeight: 400 }}>{s.name}</h3>
                  <p style={{ margin: 0, color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
                <div style={{ fontFamily: DISPLAY, fontSize: 30, whiteSpace: "nowrap" }}>{s.price} €</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Réserver ── */}
      <section id="reserver" className="in-pad" style={{ padding: "40px 24px 96px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ ...soft, padding: "48px 44px", background: accent, color: "#fff", boxShadow: "none" }}>
            <div className="in-two" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 48, alignItems: "center" }}>
              <div>
                <div style={{ ...meta, color: "rgba(255,255,255,0.75)", marginBottom: 14 }}>Réservation en ligne</div>
                <h2 className="in-h2" style={{ ...h2, color: "#fff" }}>
                  Choisissez
                  <br />
                  votre moment.
                </h2>
                <p style={{ marginTop: 20, fontSize: 16.5, lineHeight: 1.75, color: "rgba(255,255,255,0.86)", maxWidth: 360 }}>
                  La cabine se réserve à toute heure, même quand l&apos;institut est fermé. Confirmation
                  immédiate et rappel la veille.
                </p>
              </div>
              <div style={{ background: C.panel, borderRadius: 22, padding: 28 }}>
                <div style={{ ...meta, marginBottom: 16 }}>Créneaux disponibles — aujourd&apos;hui</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {slots.map((s) => (
                    <span
                      key={s.time}
                      className={`in-slot${s.taken ? " is-taken" : ""}`}
                      style={{
                        textAlign: "center",
                        padding: "14px 0",
                        borderRadius: 999,
                        fontSize: 15,
                        fontWeight: 600,
                        background: s.taken ? C.bg : "transparent",
                        border: `1px solid ${s.taken ? "transparent" : C.veil}`,
                        color: s.taken ? "rgba(42,51,43,0.28)" : C.ink,
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
                    marginTop: 20,
                    textAlign: "center",
                    background: accentDark,
                    color: "#fff",
                    padding: "15px 0",
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Confirmer mon rendez-vous
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── L'institut ── */}
      <section id="galerie" className="in-pad" style={{ padding: "0 24px 96px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="in-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center", marginBottom: 64 }}>
            <div>
              <div style={{ ...meta, marginBottom: 16 }}>La maison</div>
              <h2 className="in-h2" style={{ ...h2, marginBottom: 22 }}>
                {kit.labels.gallery} <span style={{ color: accentDark, fontStyle: "italic" }}>{kit.labels.gallerySub}</span>
              </h2>
              <p style={{ fontSize: 18, lineHeight: 1.85, color: C.inkSoft, margin: 0 }}>{about}</p>
            </div>
            <figure className="in-shot" style={{ margin: 0, borderRadius: 26, overflow: "hidden", aspectRatio: "5/4" }}>
              <img src={kit.about} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
          </div>

          <div className="in-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.gallery.map((src, i) => (
              <figure
                key={src}
                className="in-shot"
                style={{ margin: 0, borderRadius: 22, overflow: "hidden", aspectRatio: i === 1 ? "3/4" : "1" }}
              >
                <img
                  src={src}
                  alt={`L'institut ${i + 1}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="in-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ ...meta, marginBottom: 14 }}>
              {avg}/5 · {reviewCount} avis
            </div>
            <h2 className="in-h2" style={h2}>
              Elles en <span style={{ color: accentDark, fontStyle: "italic" }}>reparlent</span>.
            </h2>
          </div>
          <div className="in-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {kit.testimonials.map((t) => (
              <blockquote
                key={t.author}
                style={{ margin: 0, background: C.bg, borderRadius: 26, padding: 32, display: "flex", flexDirection: "column", gap: 18 }}
              >
                <Stars value={t.rating} color={accent} size={14} />
                <p style={{ fontFamily: DISPLAY, fontSize: 20, lineHeight: 1.6, margin: 0, flex: 1 }}>« {t.comment} »</p>
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
      <section id="contact" className="in-pad" style={{ padding: "96px 24px" }}>
        <div className="in-two" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div>
            <h2 className="in-h2" style={h2}>
              Nous <span style={{ color: accentDark, fontStyle: "italic" }}>rejoindre</span>.
            </h2>
            <div style={{ marginTop: 32, fontSize: 18, lineHeight: 1.9, color: C.inkSoft }}>
              {address || "Centre-ville"}
              <br />
              {cityLabel}, France
              <br />
              <a className="in-link" href={`tel:${tel}`} style={{ fontWeight: 600 }}>
                {phone || "—"}
              </a>
            </div>
          </div>
          <div style={{ ...soft, padding: "30px 34px" }}>
            <div style={{ ...meta, marginBottom: 10 }}>Horaires</div>
            {[
              ["Lundi", "Fermé"],
              ["Mardi — vendredi", "10:00 – 19:00"],
              ["Samedi", "10:00 – 17:00"],
              ["Dimanche", "Fermé"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: `1px solid ${C.veil}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(42,51,43,0.32)" : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={label} ville={cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(255,255,255,0.55)", padding: "36px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(255,255,255,0.55)" }}>
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
