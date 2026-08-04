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
  nextDays,
  seedOf,
  type OfferTheme,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Coiffeur — direction « Le miroir ».
 *
 * Ce qu'un salon vend, ce n'est pas une coupe : c'est un créneau. Le module de
 * réservation est donc posé DANS le hero, à hauteur de regard, pas relégué en
 * bas de page — c'est l'argument qui fait passer la maquette de 300 à 500 €, il
 * doit se voir avant le premier scroll.
 *
 * Greige chaud + prune, empattements fins (Instrument Serif) et angles adoucis :
 * l'inverse du papier/encre à bordures dures des maquettes artisan, parce qu'un
 * salon se vend sur la douceur, pas sur la robustesse.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#EDE7E3",
  panel: "#FBF9F7",
  ink: "#1C1418",
  inkSoft: "rgba(28,20,24,0.62)",
  line: "rgba(28,20,24,0.12)",
};

const DISPLAY = "'Instrument Serif', Georgia, serif";
const BODY = "'DM Sans', system-ui, sans-serif";

export default function CoiffeurTemplate({
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
  const label = metierLabel(metier || "Coiffeur");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 4.8;
  const reviewCount = reviews ?? 96;
  const slots = daySlots(seed, 9, 18, 45);
  const days = nextDays(5);
  const freeToday = slots.filter((s) => !s.taken).length;
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.panel,
    radius: 18,
    border: `1px solid ${C.line}`,
    shadow: "0 18px 40px -28px rgba(28,20,24,0.45)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.16em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: C.inkSoft,
  };

  const card: React.CSSProperties = {
    background: C.panel,
    borderRadius: 18,
    border: `1px solid ${C.line}`,
    boxShadow: "0 18px 40px -28px rgba(28,20,24,0.45)",
  };

  const cats = [...new Set(kit.services.map((s) => s.cat))];

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300..700&display=swap');
        ${SHARED_CSS}
        .cf-serif { font-family: ${DISPLAY}; font-weight: 400; }
        .cf-slot { transition: background .18s ease, color .18s ease, border-color .18s ease; }
        .cf-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .cf-shot img { transition: transform .6s cubic-bezier(.2,.7,.3,1); }
        .cf-shot:hover img { transform: scale(1.04); }
        .cf-link { color: inherit; text-decoration: none; border-bottom: 1px solid ${accent}55; padding-bottom: 1px; }
        .cf-link:hover { border-color: ${accent}; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .cf-hero { grid-template-columns: 1fr !important; gap: 40px !important; }
          .cf-h1 { font-size: 62px !important; }
          .cf-two { grid-template-columns: 1fr !important; }
          .cf-shots { grid-template-columns: 1fr 1fr !important; }
          .cf-nav { display: none !important; }
          .cf-pad { padding: 64px 20px !important; }
          .cf-h2 { font-size: 38px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      {/* ── En-tête ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(237,231,227,0.88)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            padding: "0 24px",
            height: 68,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span className="cf-serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
            {name}
          </span>
          <nav className="cf-nav" style={{ display: "flex", gap: 30, ...meta }}>
            <a className="cf-link" href="#prestations" style={{ border: "none" }}>
              Prestations
            </a>
            <a className="cf-link" href="#galerie" style={{ border: "none" }}>
              Galerie
            </a>
            <a className="cf-link" href="#avis" style={{ border: "none" }}>
              Avis
            </a>
            <a className="cf-link" href="#contact" style={{ border: "none" }}>
              Contact
            </a>
          </nav>
          <a
            href={`tel:${tel}`}
            style={{
              background: accent,
              color: "#fff",
              padding: "11px 20px",
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

      {/* ── Hero + réservation ── */}
      <section className="cf-pad" style={{ padding: "72px 24px 88px" }}>
        <div
          className="cf-hero"
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
              <span>
                {label} · {cityLabel}
              </span>
              <span style={{ width: 28, height: 1, background: C.line }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Stars value={avg} color={accent} size={12} />
                {avg}/5
              </span>
            </div>
            <h1
              className="cf-serif cf-h1"
              style={{ fontSize: 92, lineHeight: 0.98, margin: 0, letterSpacing: "-0.02em" }}
            >
              Votre place
              <br />
              est <span style={{ fontStyle: "italic", color: accent }}>réservée</span>.
            </h1>
            <p
              style={{
                marginTop: 26,
                fontSize: 18,
                lineHeight: 1.7,
                color: C.inkSoft,
                maxWidth: 460,
              }}
            >
              Choisissez votre créneau en trente secondes, sans appeler ni attendre la réponse d&apos;un
              message. {name} vous confirme immédiatement.
            </p>
            <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <a
                href="#reserver"
                style={{
                  background: C.ink,
                  color: C.panel,
                  padding: "16px 30px",
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Voir les créneaux
              </a>
              <a href={`tel:${tel}`} className="cf-link" style={{ fontSize: 16, fontWeight: 500 }}>
                ou appeler le {phone || "salon"}
              </a>
            </div>
          </div>

          {/* Le module — signature de la page */}
          <div id="reserver" style={{ ...card, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <span className="cf-serif" style={{ fontSize: 26 }}>
                Prendre rendez-vous
              </span>
              <span style={{ ...meta, color: accent }}>{freeToday} places</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
              {days.map((d) => (
                <div
                  key={`${d.label}-${d.num}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "10px 0 12px",
                    borderRadius: 12,
                    background: d.today ? C.ink : "transparent",
                    color: d.today ? C.panel : C.ink,
                    border: `1px solid ${d.today ? C.ink : C.line}`,
                  }}
                >
                  <div style={{ ...meta, color: d.today ? "rgba(255,255,255,0.6)" : C.inkSoft, fontSize: 10 }}>
                    {d.label}
                  </div>
                  <div className="cf-serif" style={{ fontSize: 22, marginTop: 2 }}>
                    {d.num}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...meta, marginTop: 24, marginBottom: 12 }}>Créneaux du jour</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {slots.map((s) => (
                <span
                  key={s.time}
                  className={`cf-slot${s.taken ? " is-taken" : ""}`}
                  style={{
                    textAlign: "center",
                    padding: "11px 0",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    border: `1px solid ${s.taken ? "transparent" : C.line}`,
                    background: s.taken ? "rgba(28,20,24,0.05)" : "transparent",
                    color: s.taken ? "rgba(28,20,24,0.28)" : C.ink,
                    textDecoration: s.taken ? "line-through" : "none",
                    cursor: s.taken ? "default" : "pointer",
                  }}
                >
                  {s.time}
                </span>
              ))}
            </div>

            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 13, marginTop: 22, marginBottom: 0, lineHeight: 1.6 }}>
              Confirmation immédiate, rappel SMS la veille. Annulation possible jusqu&apos;à 24 h avant.
            </p>
          </div>
        </div>
      </section>

      {/* ── Bandeau de réassurance ── */}
      <div style={{ background: C.ink, color: "rgba(251,249,247,0.75)", padding: "18px 24px" }}>
        <div
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 28,
            justifyContent: "center",
            ...meta,
            color: "rgba(251,249,247,0.75)",
          }}
        >
          {kit.ticker.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Prestations ── */}
      <section id="prestations" className="cf-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <div style={{ maxWidth: 560, marginBottom: 56 }}>
            <div style={{ ...meta, marginBottom: 14 }}>{kit.labels.catalogueNote}</div>
            <h2 className="cf-serif cf-h2" style={{ fontSize: 54, lineHeight: 1.02, margin: 0 }}>
              {kit.labels.catalogue} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 40 }}>
              <div style={{ ...meta, color: accent, marginBottom: 16 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div
                    key={s.name}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 20,
                      padding: "20px 0",
                      borderTop: `1px solid ${C.line}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cf-serif" style={{ fontSize: 26, lineHeight: 1.2 }}>
                        {s.name}
                      </div>
                      <p style={{ margin: "6px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                    {s.duration != null && (
                      <span style={{ ...meta, whiteSpace: "nowrap" }}>{s.duration} min</span>
                    )}
                    <span className="cf-serif" style={{ fontSize: 30, whiteSpace: "nowrap" }}>
                      {s.price} €
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── À propos ── */}
      <section className="cf-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div
          className="cf-two"
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <figure className="cf-shot" style={{ margin: 0, borderRadius: 22, overflow: "hidden", aspectRatio: "4/5" }}>
            <img src={kit.about} alt={`${label} à ${cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
          <div>
            <div style={{ ...meta, marginBottom: 16 }}>La maison</div>
            <h2 className="cf-serif cf-h2" style={{ fontSize: 46, lineHeight: 1.05, margin: "0 0 24px" }}>
              Le salon, en <span style={{ fontStyle: "italic", color: accent }}>deux mots</span>.
            </h2>
            <p style={{ fontSize: 18, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{about}</p>
            <div style={{ display: "flex", gap: 40, marginTop: 36, flexWrap: "wrap" }}>
              <div>
                <div className="cf-serif" style={{ fontSize: 38, color: accent }}>
                  {avg}/5
                </div>
                <div style={meta}>{reviewCount} avis clients</div>
              </div>
              <div>
                <div className="cf-serif" style={{ fontSize: 38, color: accent }}>
                  7j/7
                </div>
                <div style={meta}>réservation en ligne</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="cf-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <h2 className="cf-serif cf-h2" style={{ fontSize: 54, lineHeight: 1.02, margin: "0 0 40px" }}>
            {kit.labels.gallery} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="cf-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.gallery.map((src, i) => (
              <figure
                key={src}
                className="cf-shot"
                style={{
                  margin: 0,
                  borderRadius: 18,
                  overflow: "hidden",
                  aspectRatio: i % 3 === 1 ? "3/4" : "1",
                  background: C.panel,
                }}
              >
                <img
                  src={src}
                  alt={`Réalisation ${i + 1} — ${name}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="cf-pad" style={{ background: C.panel, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 44 }}>
            <h2 className="cf-serif cf-h2" style={{ fontSize: 54, lineHeight: 1, margin: 0 }}>
              Ce qu&apos;elles en <span style={{ fontStyle: "italic", color: accent }}>disent</span>
            </h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={avg} color={accent} size={14} /> {avg}/5 · {reviewCount} avis
            </span>
          </div>
          <div className="cf-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {kit.testimonials.map((t) => (
              <blockquote
                key={t.author}
                style={{ ...card, margin: 0, padding: 30, display: "flex", flexDirection: "column", gap: 18 }}
              >
                <Stars value={t.rating} color={accent} size={14} />
                <p className="cf-serif" style={{ fontSize: 22, lineHeight: 1.45, margin: 0, flex: 1 }}>
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

      {/* ── Contact ── */}
      <section id="contact" className="cf-pad" style={{ padding: "96px 24px" }}>
        <div
          className="cf-two"
          style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}
        >
          <div>
            <h2 className="cf-serif cf-h2" style={{ fontSize: 54, lineHeight: 1.02, margin: "0 0 24px" }}>
              Nous <span style={{ fontStyle: "italic", color: accent }}>trouver</span>.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 32 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 18 }}>
                  {address || "Centre-ville"}, {cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a className="cf-link" href={`tel:${tel}`} style={{ fontSize: 18 }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>
          <div style={{ ...card, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Horaires</div>
            {[
              ["Lundi", "Fermé"],
              ["Mardi — jeudi", "09:00 – 19:00"],
              ["Vendredi", "09:00 – 20:00"],
              ["Samedi", "09:00 – 18:00"],
              ["Dimanche", "Fermé"],
            ].map(([d, h]) => (
              <div
                key={d}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderTop: `1px solid ${C.line}`,
                  fontSize: 16,
                }}
              >
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(28,20,24,0.35)" : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ position: "relative", color: "#fff", padding: "104px 24px", textAlign: "center", overflow: "hidden" }}>
        {/* La photo du salon revient ici : le hero appartient au module de
            réservation, mais l'ambiance doit clore la page, pas disparaître. */}
        <img
          src={kit.hero}
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: accent, opacity: 0.88 }} aria-hidden />
        <div style={{ position: "relative" }}>
          <h2 className="cf-serif cf-h2" style={{ fontSize: 58, lineHeight: 1.02, margin: "0 0 28px" }}>
            Un créneau vous attend.
          </h2>
          <a
            href="#reserver"
            style={{
              display: "inline-block",
              background: "#fff",
              color: accent,
              padding: "17px 38px",
              borderRadius: 999,
              fontSize: 17,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={label} ville={cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(251,249,247,0.55)", padding: "36px 24px" }}>
        <div
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            ...meta,
            color: "rgba(251,249,247,0.55)",
          }}
        >
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
