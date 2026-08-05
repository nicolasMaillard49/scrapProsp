import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Plombier & serrurier — direction « L'urgence ».
 *
 * Ces deux métiers ne vendent pas une prestation, ils vendent deux chiffres :
 * dans combien de temps vous êtes là, et combien ça coûte. Quelqu'un qui a de
 * l'eau au sol ou qui est dehors à 23 h ne lit pas une page, il cherche un
 * numéro et un prix. Tout le reste passe donc après.
 *
 * D'où la DA : signalétique plutôt que magazine. Fond ardoise, accent saturé,
 * Archivo Black, angles vifs, et le téléphone présent à l'écran en permanence.
 * Le module du hero n'est pas un agenda mais un tarificateur : on clique sur sa
 * panne, on lit le prix de départ avant d'appeler. C'est ce qui répond à la
 * peur réelle du client — se faire avoir sur la facture.
 *
 * L'offre reste « vitrine » (300 €) : cette page ne montre aucun agenda. Le
 * jour où elle en montrera un, `offer` passe à « booking » dans le kit et le
 * prix affiché suit tout seul.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#0E141B",
  panel: "#18212C",
  panelSoft: "#1F2A37",
  ink: "#F3F6F9",
  inkSoft: "rgba(243,246,249,0.62)",
  line: "rgba(243,246,249,0.12)",
};

const DISPLAY = "'Archivo', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

export default function UrgenceTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "urgence", "plombier");
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
    radius: 6,
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
    radius: 6,
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
    radius: 6,
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
    fontWeight: 800,
    fontSize: 44,
    lineHeight: 1.02,
    letterSpacing: "-0.02em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip", paddingBottom: 62 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
        ${ARTISAN_CSS}
        .ur-panne { transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .ur-panne:hover { background: ${accent}; border-color: ${accent}; transform: translateY(-2px); }
        .ur-panne:hover .ur-panne-price { color: #fff; }
        .ur-shot img { transition: transform .6s cubic-bezier(.2,.7,.3,1); }
        .ur-shot:hover img { transform: scale(1.05); }
        .ur-call { transition: filter .15s ease; }
        .ur-call:hover { filter: brightness(1.12); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ur-h1 { font-size: 52px !important; }
          .ur-hero { grid-template-columns: 1fr !important; gap: 36px !important; }
          .ur-delay { font-size: 76px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      {/* ── Barre d'urgence : le numéro ne quitte jamais l'écran ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(14,20,27,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="ar-pad"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 24px",
            height: 74,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <span
              style={{
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontSize: 21,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </span>
            <span className="ar-nav" style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8, color: "#4ADE80" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
              Disponible maintenant
            </span>
          </div>

          <nav className="ar-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Travaux</a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>Avis</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Zone</a>
          </nav>

          <a
            className="ur-call"
            href={`tel:${v.tel}`}
            style={{
              background: accent,
              color: "#fff",
              padding: "13px 22px",
              borderRadius: 6,
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: 16,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero + tarificateur ── */}
      <section className="ar-pad" style={{ padding: "64px 24px 76px", position: "relative", overflow: "hidden" }}>
        <img
          src={kit.hero}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.16,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, ${C.bg} 42%, rgba(14,20,27,0.72))`,
          }}
        />
        <div
          className="ur-hero"
          style={{
            position: "relative",
            maxWidth: 1240,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: 56,
            alignItems: "center",
          }}
        >
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

            <h1
              className="ur-h1"
              style={{
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontSize: 78,
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.65, color: C.inkSoft, maxWidth: 460 }}>
              {kit.promise.sub}
            </p>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 36, flexWrap: "wrap" }}>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Sur place en</div>
                <div
                  className="ur-delay"
                  style={{
                    fontFamily: DISPLAY,
                    fontWeight: 900,
                    fontSize: 96,
                    lineHeight: 0.82,
                    letterSpacing: "-0.05em",
                    color: accent,
                  }}
                >
                  {m.delay}
                </div>
              </div>
              <a
                className="ur-call"
                href={`tel:${v.tel}`}
                style={{
                  background: accent,
                  color: "#fff",
                  padding: "20px 34px",
                  borderRadius: 6,
                  fontFamily: DISPLAY,
                  fontWeight: 900,
                  fontSize: 20,
                  textDecoration: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {kit.labels.cta}
              </a>
              <HeroCall phone={phone} tel={v.tel} theme={callTheme} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {kit.garanties.map((g) => (
                <span
                  key={g}
                  style={{
                    ...meta,
                    color: C.ink,
                    border: `1px solid ${C.line}`,
                    borderRadius: 4,
                    padding: "7px 12px",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          {/* Le module — le prix AVANT l'appel */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 30 }}>
            <div style={{ ...meta, color: accent, marginBottom: 6 }}>Tarifs de départ</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 27, lineHeight: 1.15, marginBottom: 22 }}>
              Quelle est la panne ?
            </div>

            <div className="ar-four" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {m.pannes.map((panne) => (
                <a
                  key={panne.label}
                  href={`tel:${v.tel}`}
                  className="ur-panne"
                  style={{
                    display: "block",
                    background: C.panelSoft,
                    border: `1px solid ${C.line}`,
                    borderRadius: 6,
                    padding: "18px 16px",
                    textDecoration: "none",
                    color: C.ink,
                  }}
                >
                  <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 12 }} aria-hidden>
                    {panne.icon}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{panne.label}</div>
                  <div className="ur-panne-price" style={{ ...meta, color: accent, letterSpacing: "0.06em" }}>
                    {panne.price}
                  </div>
                </a>
              ))}
            </div>

            <p style={{ margin: "22px 0 0", fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}>{m.priceNote}</p>
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "36px 24px" }}>
        <div
          className="ar-three ar-pad"
          style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}
        >
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 38, lineHeight: 1, letterSpacing: "-0.03em" }}>
                {f.k}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.92 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="prestations" className="ar-pad" style={{ padding: "92px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ marginBottom: 46, maxWidth: 620 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={{ ...h2, textTransform: "uppercase" }}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 34 }}>
              <div style={{ ...meta, color: accent, marginBottom: 12 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div
                    key={s.name}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 24,
                      padding: "20px 0",
                      borderTop: `1px solid ${C.line}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 21 }}>{s.name}</div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                    </div>
                    <span
                      style={{
                        fontFamily: DISPLAY,
                        fontWeight: 800,
                        fontSize: 24,
                        whiteSpace: "nowrap",
                        color: s.price === 0 ? "#4ADE80" : C.ink,
                      }}
                    >
                      {artisanPrice(s.price, s.from, s.unit)}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── L'artisan ── */}
      <section className="ar-pad" style={{ background: C.panel, padding: "92px 24px" }}>
        <div
          className="ar-two"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;artisan</div>
            <h2 style={{ ...h2, marginBottom: 22 }}>
              Le même numéro
              <br />
              <span style={{ color: accent }}>après l&apos;intervention.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 36, marginTop: 34, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 34, color: accent }}>{v.avg}/5</div>
                <div style={meta}>{v.reviewCount} avis clients</div>
              </div>
              <div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 34, color: accent }}>{m.delay}</div>
                <div style={meta}>délai moyen d&apos;arrivée</div>
              </div>
            </div>
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

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ padding: "92px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <h2 style={{ ...h2, textTransform: "uppercase", marginBottom: 34 }}>
            {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {kit.gallery.map((src, i) => (
              <figure
                key={`${src}-${i}`}
                className="ur-shot"
                style={{ margin: 0, borderRadius: 6, overflow: "hidden", aspectRatio: "4/3", background: C.panel }}
              >
                <img
                  src={src}
                  alt={`Chantier ${i + 1} — ${name}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ background: C.panel, padding: "92px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 38 }}>
            <h2 style={{ ...h2, textTransform: "uppercase" }}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.testimonials.map((t) => (
              <blockquote
                key={t.author}
                style={{
                  margin: 0,
                  background: C.panelSoft,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: 26,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
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

      {/* ── Zone et contact ── */}
      <section id="contact" className="ar-pad" style={{ padding: "92px 24px" }}>
        <div
          className="ar-two"
          style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}
        >
          <div>
            <h2 style={{ ...h2, textTransform: "uppercase", marginBottom: 26 }}>
              Zone d&apos;<span style={{ color: accent }}>intervention</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 34 }}>
              {kit.zone.map((z) => (
                <span
                  key={z}
                  style={{
                    border: `1px solid ${C.line}`,
                    borderRadius: 4,
                    padding: "9px 14px",
                    fontSize: 15,
                  }}
                >
                  {z}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Atelier</div>
                <div style={{ fontSize: 17 }}>
                  {address || "Centre-ville"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Disponibilité</div>
            {[
              ["Lundi — vendredi", "07:00 – 20:00"],
              ["Samedi", "08:00 – 19:00"],
              ["Dimanche", "Urgences uniquement"],
              ["Nuits et jours fériés", "Urgences uniquement"],
            ].map(([d, h]) => (
              <div
                key={d}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 0",
                  borderTop: `1px solid ${C.line}`,
                  fontSize: 15,
                }}
              >
                <span>{d}</span>
                <span style={{ color: h.startsWith("Urgences") ? accent : C.ink }}>{h}</span>
              </div>
            ))}
            <p style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 13, lineHeight: 1.6, marginTop: 20, marginBottom: 0 }}>
              En dehors des horaires, l&apos;appel est basculé sur le portable d&apos;astreinte.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: accent, color: "#fff", padding: "76px 24px", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: 50,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            margin: "0 0 24px",
            textTransform: "uppercase",
          }}
        >
          Un problème maintenant ?
        </h2>
        <a
          className="ur-call"
          href={`tel:${v.tel}`}
          style={{
            display: "inline-block",
            background: "#fff",
            color: accent,
            padding: "19px 40px",
            borderRadius: 6,
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: 22,
            textDecoration: "none",
          }}
        >
          {phone || kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "34px 24px" }}>
        <div
          className="ar-pad"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            ...meta,
          }}
        >
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={`Sur place en ${m.delay}`} />
    </div>
  );
}
