import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Expert-comptable — direction « Le grand livre ».
 *
 * Un dirigeant ne change pas de cabinet parce que le sien est cher : il en
 * change parce qu'il apprend une échéance la veille, et qu'on ne lui répond
 * pas. La page attaque par là — le calendrier fiscal de l'année, mois par
 * mois — puis annonce un forfait par type de structure. Deux informations que
 * les cabinets gardent pour le premier rendez-vous, et qui suffisent à faire
 * décrocher le téléphone.
 *
 * DA : le grand livre. Réglure horizontale héritée du registre comptable,
 * vert-de-gris et papier, un surligneur ocre pour les échéances qui tombent.
 * Sora en display : une grotesque aux chiffres nets, lisible en colonne.
 *
 * Offre « vitrine » : la page ne montre pas d'agenda. Un premier rendez-vous
 * d'expertise comptable se cale après un échange, pas en cliquant sur un
 * créneau.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F6F8F6",
  panel: "#FFFFFF",
  ink: "#18211E",
  inkSoft: "rgba(24,33,30,0.62)",
  line: "rgba(24,33,30,0.14)",
  marker: "#E9C46A",
};

const DISPLAY = "'Sora', system-ui, sans-serif";
const BODY = "'Sora', system-ui, sans-serif";

export default function GrandLivreTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "calendrier", "expertcomptable");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const MOIS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const charges = new Set(m.echeances.map((e) => e.mois));

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: "#fff", radius: 8, border: `1px solid ${C.line}`,
    shadow: "0 18px 40px -34px rgba(24,33,30,0.35)",
    display: DISPLAY, meta: BODY, metaSpacing: "0.14em",
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.14em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 8,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.14em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 38, lineHeight: 1.12,
    letterSpacing: "-0.035em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        ${SANTE_CSS}
        .gl-mois { transition: background .18s ease, color .18s ease; }
        .gl-mois:hover { background: ${accent}; color: #fff; }
        .gl-forfait { transition: border-color .18s ease, transform .18s ease; }
        .gl-forfait:hover { border-color: ${accent}; transform: translateY(-3px); }
        .gl-cta { transition: filter .15s ease; }
        .gl-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .gl-h1 { font-size: 40px !important; }
          .gl-hero { grid-template-columns: 1fr !important; }
          .gl-forfaits { grid-template-columns: 1fr 1fr !important; }
          .gl-bande { overflow-x: auto !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 40 }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.04em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#calendrier" style={{ color: C.inkSoft, textDecoration: "none" }}>Calendrier</a>
            <a href="#forfaits" style={{ color: C.inkSoft, textDecoration: "none" }}>Forfaits</a>
            <a href="#missions" style={{ color: C.inkSoft, textDecoration: "none" }}>Missions</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a className="gl-cta" href={`tel:${v.tel}`} style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero + bande des douze mois ── */}
      <section className="sa-pad" style={{ padding: "64px 24px 24px" }}>
        <div className="gl-hero" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 18, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>
            <h1 className="gl-h1" style={{ fontWeight: 700, fontSize: 52, lineHeight: 1.04, letterSpacing: "-0.05em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>
            <p style={{ marginTop: 20, fontSize: 17.5, lineHeight: 1.75, color: C.inkSoft, maxWidth: 470 }}>{kit.promise.sub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="gl-cta" href="#forfaits" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
                Voir les forfaits
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, color: C.ink, padding: "16px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>{g}</span>
              ))}
            </div>
          </div>
          <figure style={{ margin: 0, borderRadius: 10, overflow: "hidden", aspectRatio: "4/3" }}>
            <img src={kit.hero} alt={`Cabinet de ${name} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── La bande des mois ── */}
      <section id="calendrier" className="sa-pad" style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div className="gl-bande" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, marginBottom: 34 }}>
            {MOIS.map((mo, i) => {
              const charge = charges.has(MOIS_LONG[i]);
              return (
                <div
                  key={i}
                  className="gl-mois"
                  title={MOIS_LONG[i]}
                  style={{
                    textAlign: "center",
                    padding: "16px 0 14px",
                    borderRadius: 6,
                    background: charge ? C.marker : C.panel,
                    border: `1px solid ${charge ? C.marker : C.line}`,
                    fontWeight: charge ? 700 : 400,
                    fontSize: 15,
                  }}
                >
                  {mo}
                </div>
              );
            })}
          </div>

          <div style={{ maxWidth: 620, marginBottom: 26 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>L&apos;année fiscale</div>
            <h2 style={h2}>Les échéances, annoncées avant qu&apos;elles ne tombent.</h2>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
            {m.echeances.map((e) => (
              <div key={e.mois} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, padding: "18px 24px", borderTop: `1px solid ${C.line}`, alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{e.mois}</span>
                <span style={{ color: C.inkSoft, fontSize: 16, lineHeight: 1.6 }}>{e.quoi}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Les forfaits ── */}
      <section id="forfaits" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 36 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Forfaits mensuels</div>
            <h2 style={h2}>Un montant par structure, pas par surprise.</h2>
          </div>
          <div className="gl-forfaits" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {m.forfaits.map((f) => (
              <div key={f.structure} className="gl-forfait" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "26px 24px" }}>
                <div style={{ ...meta, marginBottom: 14 }}>{f.structure}</div>
                <div style={{ fontWeight: 700, fontSize: 34, letterSpacing: "-0.05em", color: accent }}>
                  {f.prix} €
                  <span style={{ fontSize: 15, fontWeight: 400, color: C.inkSoft, letterSpacing: 0 }}> /mois</span>
                </div>
                <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.55 }}>HT, révisé une fois par an</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginTop: 40 }}>
            {kit.facts.map((f) => (
              <div key={f.k} style={{ maxWidth: 230 }}>
                <div style={{ fontWeight: 700, fontSize: 26, color: accent, letterSpacing: "-0.04em" }}>{f.k}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: C.inkSoft, marginTop: 5 }}>{f.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Missions ── */}
      <section id="missions" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 32, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>
          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services.filter((s) => s.cat === cat).map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em" }}>{s.name}</div>
                    <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 20, whiteSpace: "nowrap", letterSpacing: "-0.04em" }}>
                    {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Le cabinet ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
          <AboutVisual
            about={kit.about}
            portrait={kit.portrait}
            alt={`${v.label} à ${v.cityLabel}`}
            name={name}
            role={v.label}
            theme={portraitTheme}
          />
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Le cabinet</div>
            <h2 style={{ ...h2, marginBottom: 18 }}>Un interlocuteur, pas un dossier qui circule.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 30, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 10, padding: "20px 24px" }}>
                <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 8, letterSpacing: "-0.02em" }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 22 }}>Premier rendez-vous</h2>
            <p style={{ margin: "0 0 24px", fontSize: 16.5, lineHeight: 1.8, color: C.inkSoft, maxWidth: 460 }}>
              Il est offert et sans engagement : point de situation, forfait proposé, et le cas échéant reprise du
              dossier avec votre cabinet actuel — c&apos;est une obligation déontologique entre confrères.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontWeight: 700, fontSize: 28, color: accent, textDecoration: "none", letterSpacing: "-0.04em" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "09:00 – 18:00"], ["Samedi", "Fermé"], ["Dimanche", "Fermé"], ["Rendez-vous en visio", "Possible"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(255,255,255,0.6)", padding: "30px 24px" }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(255,255,255,0.6)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
