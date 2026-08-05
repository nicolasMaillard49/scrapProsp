import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Avocat — direction « Le dossier ».
 *
 * Ce qui retient d'appeler un avocat, c'est de ne pas savoir combien ça va
 * coûter — et de craindre que le compteur tourne dès le premier bonjour. La
 * page répond par ce que la loi impose déjà : la convention d'honoraires
 * écrite, et les trois modes de calcul possibles. L'honoraire de résultat est
 * présenté avec sa limite légale (jamais seul), parce qu'un cabinet qui
 * l'explique inspire plus confiance qu'un cabinet qui l'esquive.
 *
 * DA : le dossier. Les domaines d'intervention sont des onglets de chemise
 * cartonnée, la palette est bleu nuit et laiton, le display est Frank Ruhl
 * Libre — un serif à contraste marqué qui tient l'autorité sans virer au
 * pastiche de cabinet américain.
 *
 * Pas de témoignages de clients : le RIN encadre strictement la publicité des
 * avocats, et la sollicitation personnalisée reste bornée.
 *
 * Offre « vitrine » : cette page ne montre pas d'agenda. Un premier rendez-vous
 * chez un avocat se cale au téléphone, après un premier tri du dossier.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#111C2E",
  panel: "#18253A",
  panelSoft: "#1F2E47",
  ink: "#F2EFE7",
  inkSoft: "rgba(242,239,231,0.6)",
  line: "rgba(242,239,231,0.16)",
};

const DISPLAY = "'Frank Ruhl Libre', Georgia, serif";
const BODY = "'Libre Franklin', system-ui, sans-serif";

export default function DossierTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "dossier", "avocat");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: C.bg, radius: 4, border: `1px solid ${C.line}`, shadow: "none",
    display: DISPLAY, meta: BODY, metaSpacing: "0.18em",
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.18em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panelSoft, radius: 4,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.18em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 400, fontSize: 42, lineHeight: 1.14,
    letterSpacing: "-0.01em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700&family=Libre+Franklin:wght@400;500;600&display=swap');
        ${SANTE_CSS}
        .do-onglet { transition: background .18s ease, border-color .18s ease, transform .18s ease; }
        .do-onglet:hover { background: ${C.panelSoft}; border-color: ${accent}; transform: translateY(-3px); }
        .do-hono { transition: border-color .18s ease; }
        .do-hono:hover { border-color: ${accent}; }
        .do-cta { transition: filter .15s ease; }
        .do-cta:hover { filter: brightness(1.12); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .do-h1 { font-size: 44px !important; }
          .do-hero { grid-template-columns: 1fr !important; }
          .do-onglets { grid-template-columns: 1fr 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: "rgba(17,28,46,0.95)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 40, borderBottom: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", height: 78, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 24 }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#domaines" style={{ color: C.inkSoft, textDecoration: "none" }}>Domaines</a>
            <a href="#honoraires" style={{ color: C.inkSoft, textDecoration: "none" }}>Honoraires</a>
            <a href="#interventions" style={{ color: C.inkSoft, textDecoration: "none" }}>Interventions</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a className="do-cta" href={`tel:${v.tel}`} style={{ background: accent, color: C.bg, padding: "12px 20px", borderRadius: 3, fontWeight: 600, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "72px 24px 76px" }}>
        <div className="do-hero" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 18, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>
            <h1 className="do-h1" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 58, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>
            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.8, color: C.inkSoft, maxWidth: 480 }}>{kit.promise.sub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 34, flexWrap: "wrap" }}>
              <a className="do-cta" href="#honoraires" style={{ background: accent, color: C.bg, padding: "16px 28px", borderRadius: 3, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
                Comment sont calculés les honoraires
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, color: C.ink, padding: "16px 28px", borderRadius: 3, fontWeight: 500, fontSize: 15, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 3, padding: "8px 13px" }}>{g}</span>
              ))}
            </div>
          </div>

          <figure style={{ margin: 0, borderRadius: 4, overflow: "hidden", aspectRatio: "4/5" }}>
            <img src={kit.hero} alt={`Cabinet de ${name} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Les domaines, en onglets de dossier ── */}
      <section id="domaines" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 38 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Domaines d&apos;intervention</div>
            <h2 style={h2}>Six matières, un même dossier.</h2>
          </div>
          <div className="do-onglets" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {m.domaines.map((d, i) => (
              <div key={d.name} style={{ position: "relative", paddingTop: 14 }}>
                {/* L'onglet de la chemise */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute", top: 0, left: 18, height: 16, width: 92,
                    background: C.panelSoft, border: `1px solid ${C.line}`, borderBottom: "none",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <div className="do-onglet" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: "0 4px 4px 4px", padding: "24px 22px", position: "relative" }}>
                  <div style={{ ...meta, color: accent, marginBottom: 10 }}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 22, marginBottom: 8 }}>{d.name}</div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: C.inkSoft }}>{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Les honoraires ── */}
      <section id="honoraires" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 34 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Convention d&apos;honoraires</div>
            <h2 style={h2}>Trois modes de calcul, écrits avant.</h2>
          </div>
          <div className="sa-three" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {m.honoraires.map((h) => (
              <div key={h.type} className="do-hono" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${accent}`, borderRadius: 4, padding: "26px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 22, marginBottom: 10 }}>{h.type}</div>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7, color: C.inkSoft }}>{h.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginTop: 40 }}>
            {kit.facts.map((f) => (
              <div key={f.k} style={{ maxWidth: 240 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 30, color: accent }}>{f.k}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: C.inkSoft, marginTop: 4 }}>{f.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interventions ── */}
      <section id="interventions" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
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
                    <div style={{ fontFamily: DISPLAY, fontSize: 21 }}>{s.name}</div>
                    <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                  <span style={{ fontFamily: DISPLAY, fontSize: 22, whiteSpace: "nowrap", color: accent }}>
                    {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Le cabinet ── */}
      <section className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>Le coût avant les diligences.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 32, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${accent}`, borderRadius: 4, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 19, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>Prendre rendez-vous</h2>
            <p style={{ margin: "0 0 24px", fontSize: 16.5, lineHeight: 1.8, color: C.inkSoft, maxWidth: 460 }}>
              Le premier échange sert à cerner la situation et à vérifier que le cabinet peut intervenir. Il se
              cale par téléphone : décrivez brièvement votre dossier, on vous dit sous quel délai vous êtes reçu.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 30, color: accent, textDecoration: "none" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires du secrétariat</div>
            {[["Lundi — vendredi", "09:00 – 19:00"], ["Samedi", "Sur rendez-vous"], ["Dimanche", "Fermé"], ["Rendez-vous en visio", "Possible"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px" }}>
        <div className="sa-pad" style={{ maxWidth: 1140, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
