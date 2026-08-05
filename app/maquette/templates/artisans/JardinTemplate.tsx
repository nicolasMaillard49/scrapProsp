import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, Stars, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { ARTISAN_CSS, HeroCall, StickyCall, artisanPrice, artisanView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Paysagiste — direction « Le jardin ».
 *
 * Le paysagiste est le seul artisan qui vend un abonnement plutôt qu'un
 * chantier : sa marge est dans le contrat d'entretien, pas dans la création.
 * La page vend donc l'année entière — quatre saisons, ce qu'on fait à chacune,
 * et ce qui arrive si on en saute une. Le calendrier remplace le module de
 * réservation : c'est lui qui transforme un devis ponctuel en contrat.
 *
 * D'où la DA : crème et vert profond, sérif de presse (Newsreader), colonnes
 * saisonnières. Le registre du jardin qui dure, pas du coup de tondeuse.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F5F2E9",
  panel: "#FCFAF4",
  ink: "#1C2618",
  inkSoft: "rgba(28,38,24,0.62)",
  line: "rgba(28,38,24,0.15)",
};

const DISPLAY = "'Newsreader', Georgia, serif";
const BODY = "'Karla', system-ui, sans-serif";

export default function JardinTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = artisanView(p, "jardin", "paysagiste");
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
    radius: 14,
    border: `1px solid ${C.line}`,
    shadow: "0 20px 40px -34px rgba(28,38,24,0.5)",
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
    radius: 999,
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
    radius: 999,
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
    fontWeight: 400,
    fontSize: 48,
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
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Karla:wght@400;500;700&display=swap');
        ${ARTISAN_CSS}
        .jd-shot img { transition: transform .7s cubic-bezier(.2,.7,.3,1); }
        .jd-shot:hover img { transform: scale(1.05); }
        .jd-saison { transition: background .18s ease, transform .18s ease; }
        .jd-saison:hover { background: ${C.panel}; transform: translateY(-3px); }
        .jd-cta { transition: filter .15s ease; }
        .jd-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .jd-h1 { font-size: 58px !important; }
          .jd-hero { grid-template-columns: 1fr !important; }
          .jd-saisons { grid-template-columns: 1fr 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
        <div
          className="ar-pad"
          style={{ maxWidth: 1220, margin: "0 auto", padding: "0 24px", height: 78, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 26, letterSpacing: "-0.02em" }}>{name}</span>
          <nav className="ar-nav" style={{ display: "flex", gap: 28, ...meta }}>
            <a href="#saisons" style={{ color: C.inkSoft, textDecoration: "none" }}>Les saisons</a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>Prestations</a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>Jardins</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="jd-cta"
            href={`tel:${v.tel}`}
            style={{ background: accent, color: "#fff", padding: "13px 22px", borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ar-pad" style={{ padding: "72px 24px 76px" }}>
        <div className="jd-hero" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 60, alignItems: "center" }}>
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

            <h1 className="jd-h1" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 74, lineHeight: 1.02, letterSpacing: "-0.03em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ fontStyle: "italic", color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.75, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap", alignItems: "center" }}>
              <a
                className="jd-cta"
                href="#saisons"
                style={{ background: C.ink, color: C.panel, padding: "17px 30px", borderRadius: 999, fontWeight: 700, fontSize: 16, textDecoration: "none" }}
              >
                Voir le calendrier
              </a>
              <HeroCall phone={phone} tel={v.tel} theme={callTheme} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <figure className="jd-shot" style={{ margin: 0, overflow: "hidden", borderRadius: 18, aspectRatio: "4/5" }}>
            <img src={kit.hero} alt={`${v.label} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Le module : les quatre saisons ── */}
      <section id="saisons" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 44 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Le contrat d&apos;entretien</div>
            <h2 style={h2}>
              Ce qu&apos;on fait chez vous,
              <span style={{ fontStyle: "italic", color: accent }}> saison par saison</span>.
            </h2>
          </div>

          <div className="jd-saisons" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {m.saisons.map((s, i) => (
              <div
                key={s.name}
                className="jd-saison"
                style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: "26px 24px 28px" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 27, color: accent }}>{s.name}</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 20, color: C.line }}>0{i + 1}</span>
                </div>
                <div style={{ ...meta, marginBottom: 18 }}>{s.months}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {s.tasks.map((t) => (
                    <li
                      key={t}
                      style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.line}`, fontSize: 15, lineHeight: 1.5 }}
                    >
                      <span aria-hidden style={{ color: accent, flex: "0 0 auto" }}>—</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p style={{ margin: "30px 0 0", fontSize: 16, lineHeight: 1.75, color: C.inkSoft, maxWidth: 780 }}>{m.contratNote}</p>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "38px 24px" }}>
        <div className="ar-three ar-pad" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 38, lineHeight: 1 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Prestations ── */}
      <section id="prestations" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
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

      {/* ── L'entreprise ── */}
      <section className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div className="ar-two" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
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
            <h2 style={{ ...h2, marginBottom: 22 }}>
              Un jardin qui tient
              <span style={{ fontStyle: "italic", color: accent }}> la saison suivante</span>.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
            <div style={{ display: "flex", gap: 36, marginTop: 32, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 34, color: accent }}>{v.avg}/5</div>
                <div style={meta}>{v.reviewCount} avis clients</div>
              </div>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 34, color: accent }}>4 saisons</div>
                <div style={meta}>couvertes par le contrat</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      <section id="galerie" className="ar-pad" style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 34 }}>
            {kit.labels.gallery} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.gallerySub}</span>
          </h2>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {kit.gallery.map((src, i) => (
              <figure key={`${src}-${i}`} className="jd-shot" style={{ margin: 0, borderRadius: 14, overflow: "hidden", aspectRatio: i % 3 === 1 ? "3/4" : "1", background: C.panel }}>
                <img src={src} alt={`Jardin ${i + 1} — ${name}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="ar-pad" style={{ background: C.panel, padding: "88px 24px" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 38 }}>
            <h2 style={h2}>Ce qu&apos;ils en disent</h2>
            <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={v.avg} color={accent} size={14} /> {v.avg}/5 · {v.reviewCount} avis
            </span>
          </div>
          <div className="ar-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {kit.testimonials.map((t) => (
              <blockquote key={t.author} style={{ margin: 0, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
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
        <div className="ar-two" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 26 }}>
              Zone d&apos;<span style={{ fontStyle: "italic", color: accent }}>intervention</span>
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

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 30 }}>
            <div style={{ ...meta, marginBottom: 18 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "08:00 – 18:00"],
              ["Samedi", "08:00 – 12:00"],
              ["Dimanche", "Fermé"],
              ["Visite de terrain", "Sur rendez-vous"],
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
        <img src={kit.hero} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: accent, opacity: 0.86 }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 56, lineHeight: 1.04, margin: "0 0 26px" }}>
            Un jardin, toute l&apos;année.
          </h2>
          <a
            className="jd-cta"
            href={`tel:${v.tel}`}
            style={{ display: "inline-block", background: "#fff", color: accent, padding: "18px 38px", borderRadius: 999, fontWeight: 700, fontSize: 18, textDecoration: "none" }}
          >
            {phone || kit.labels.cta}
          </a>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(252,250,244,0.6)", padding: "34px 24px" }}>
        <div className="ar-pad" style={{ maxWidth: 1220, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(252,250,244,0.6)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}

      <StickyCall phone={phone} tel={v.tel} theme={callTheme} note={"Visite et plan d'intention offerts"} />
    </div>
  );
}
