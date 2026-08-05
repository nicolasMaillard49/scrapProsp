import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Couvreur & maçon — direction « Le chantier ».
 *
 * Ces deux-là vendent un devis à quatre ou cinq chiffres à quelqu'un qui n'a
 * aucun moyen de juger le travail. Ce qui bloque n'est donc pas le prix mais
 * l'inconnu : combien de temps, dans quel ordre, et qu'est-ce qui se passe si
 * ça dérape. La page répond dans cet ordre — d'abord les signes qui doivent
 * faire appeler, ensuite les étapes datées du chantier.
 *
 * D'où la DA : béton clair et encre, condensée capitale (Oswald), règles
 * horizontales et numérotation apparente. Un dossier de chantier, pas un
 * magazine — c'est ce registre-là qui rassure sur ce métier.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#EDEAE4",
  panel: "#F8F6F2",
  ink: "#1A1917",
  inkSoft: "rgba(26,25,23,0.62)",
  line: "rgba(26,25,23,0.16)",
};

const DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const BODY = "'Karla', system-ui, sans-serif";

export default function ChantierTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "chantier", "couvreur");
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
    radius: 2,
    border: `1px solid ${C.line}`,
    shadow: "none",
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
    radius: 2,
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
    radius: 2,
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
    fontSize: 52,
    lineHeight: 1,
    letterSpacing: "0.005em",
    textTransform: "uppercase",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip", paddingBottom: 62 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=Karla:wght@400;500;700&display=swap');
        ${ARTISAN_CSS}
        .ch-shot img { transition: transform .7s cubic-bezier(.2,.7,.3,1); }
        .ch-shot:hover img { transform: scale(1.05); }
        .ch-step { transition: background .15s ease; }
        .ch-step:hover { background: ${C.panel}; }
        .ch-cta { transition: filter .15s ease; }
        .ch-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ch-h1 { font-size: 62px !important; }
          .ch-hero { grid-template-columns: 1fr !important; }
          .ch-steps { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ borderBottom: `2px solid ${C.ink}`, background: C.bg }}>
        <div
          className="ar-pad"
          style={{
            maxWidth: 1260,
            margin: "0 auto",
            padding: "0 24px",
            height: 76,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 26, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {name}
          </span>
          <nav className="ar-nav" style={{ display: "flex", gap: 28, ...meta }}>
            <a href="#etapes" style={{ color: C.inkSoft, textDecoration: "none" }}>Étapes</a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Travaux</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Chantiers</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="ch-cta"
            href={`tel:${v.tel}`}
            style={{
              background: C.ink,
              color: C.panel,
              padding: "13px 22px",
              fontFamily: DISPLAY,
              fontWeight: 500,
              fontSize: 15,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ar-pad" style={{ padding: "56px 24px 0" }}>
        <div className="ch-hero" style={{ maxWidth: 1260, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "end" }}>
          <div style={{ paddingBottom: 40 }}>
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
              className="ch-h1"
              style={{
                fontFamily: DISPLAY,
                fontWeight: 500,
                fontSize: 84,
                lineHeight: 0.94,
                textTransform: "uppercase",
                letterSpacing: "0.005em",
                margin: 0,
              }}
            >
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 440 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
              <a
                className="ch-cta"
                href="#etapes"
                style={{
                  background: accent,
                  color: "#fff",
                  padding: "17px 30px",
                  fontFamily: DISPLAY,
                  fontWeight: 500,
                  fontSize: 16,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  textDecoration: "none",
                }}
              >
                Comment ça se passe
              </a>
              <HeroCall phone={phone} tel={v.tel} theme={callTheme} />
            </div>
          </div>

          <figure className="ch-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "5/4" }}>
            <img src={kit.hero} alt={`${v.label} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Bandeau garanties ── */}
      <div style={{ background: C.ink, color: "rgba(248,246,242,0.8)", padding: "16px 24px", marginTop: 48 }}>
        <div className="ar-pad" style={{ maxWidth: 1260, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center", ...meta, color: "rgba(248,246,242,0.8)" }}>
          {kit.ticker.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Le module : les signes puis les étapes ── */}
      <section id="etapes" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1260, margin: "0 auto" }}>
          <div className="ar-two" style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 56, alignItems: "start" }}>
            <div>
              <div style={{ ...meta, color: accent, marginBottom: 12 }}>Ce qui doit faire appeler</div>
              <h2 style={{ ...h2, fontSize: 44, marginBottom: 26 }}>
                Cinq signes
                <br />
                à ne pas laisser passer
              </h2>
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {m.alertes.map((a, i) => (
                  <li
                    key={a}
                    style={{
                      display: "flex",
                      gap: 16,
                      padding: "16px 0",
                      borderTop: `1px solid ${C.line}`,
                      fontSize: 16,
                      lineHeight: 1.55,
                    }}
                  >
                    <span style={{ fontFamily: DISPLAY, fontSize: 20, color: accent, flex: "0 0 auto" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <div style={{ ...meta, color: accent, marginBottom: 12 }}>Du premier appel à la réception</div>
              <h2 style={{ ...h2, fontSize: 44, marginBottom: 26 }}>Les étapes, datées</h2>
              <div className="ch-steps" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {m.steps.map((s, i) => (
                  <div
                    key={s.title}
                    className="ch-step"
                    style={{ border: `1px solid ${C.line}`, padding: "24px 22px", background: "transparent" }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontFamily: DISPLAY, fontSize: 38, lineHeight: 1, color: accent }}>{i + 1}</span>
                      <span style={{ ...meta, color: C.ink, background: C.panel, padding: "5px 9px" }}>{s.delay}</span>
                    </div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 22, textTransform: "uppercase", marginBottom: 8 }}>{s.title}</div>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.inkSoft }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "38px 24px" }}>
        <div className="ar-three ar-pad" style={{ maxWidth: 1260, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 42, lineHeight: 1 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Travaux ── */}
      <section id="prestations" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1260, margin: "0 auto" }}>
          <div style={{ marginBottom: 44, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 32 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "20px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 24, textTransform: "uppercase", letterSpacing: "0.01em" }}>{s.name}</div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
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

      {/* ── L'artisan ── */}
      <section className="ar-pad" style={{ padding: "88px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1260, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <AboutVisual
            about={kit.about}
            portrait={kit.portrait}
            alt={`${v.label} à ${v.cityLabel}`}
            name={name}
            role={v.label}
            theme={portraitTheme}
          />
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;entreprise</div>
            <h2 style={{ ...h2, fontSize: 46, marginBottom: 22 }}>
              Le prix du départ
              <br />
              <span style={{ color: accent }}>est celui d&apos;arrivée.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, padding: "9px 13px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1260, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 34 }}>
            {kit.labels.gallery} <span style={{ color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {kit.gallery.map((src, i) => (
              <figure
                key={`${src}-${i}`}
                className="ch-shot"
                style={{ margin: 0, overflow: "hidden", aspectRatio: i === 0 ? "3/4" : "1", gridRow: i === 0 ? "span 2" : undefined, background: C.bg }}
              >
                <img src={src} alt={`Chantier ${i + 1} — ${name}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1260, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 38 }}>
            <h2 style={h2}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, border: `1px solid ${C.line}`, padding: 26, display: "flex", flexDirection: "column", gap: 16, background: C.panel }}>
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
      <section id="contact" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1260, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, fontSize: 46, marginBottom: 26 }}>
              Zone d&apos;<span style={{ color: accent }}>intervention</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
              {kit.zone.map((z) => (
                <span key={z} style={{ border: `1px solid ${C.line}`, padding: "9px 14px", fontSize: 15 }}>
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
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 28, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ border: `1px solid ${C.line}`, padding: 30, background: C.bg }}>
            <div style={{ ...meta, marginBottom: 18 }}>Horaires de bureau</div>
            {[
              ["Lundi — vendredi", "07:30 – 18:00"],
              ["Samedi", "Sur rendez-vous"],
              ["Dimanche", "Fermé"],
              ["Visite de chantier", "Sur appel"],
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
      <section style={{ position: "relative", color: "#fff", padding: "96px 24px", textAlign: "center", overflow: "hidden" }}>
        <img src={kit.hero} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: C.ink, opacity: 0.82 }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 56, lineHeight: 1, textTransform: "uppercase", margin: "0 0 24px" }}>
            Une visite, un devis, un prix.
          </h2>
          <a
            className="ch-cta"
            href={`tel:${v.tel}`}
            style={{
              display: "inline-block",
              background: accent,
              color: "#fff",
              padding: "18px 38px",
              fontFamily: DISPLAY,
              fontWeight: 500,
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textDecoration: "none",
            }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(248,246,242,0.6)", padding: "34px 24px" }}>
        <div className="ar-pad" style={{ maxWidth: 1260, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(248,246,242,0.6)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={"Visite et devis gratuits"} />
    </div>
  );
}
