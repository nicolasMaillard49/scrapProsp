import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Sage-femme — direction « La frise ».
 *
 * Deux malentendus coûtent des patientes à une sage-femme libérale : on croit
 * qu'elle n'intervient qu'à l'accouchement, et on ignore qu'elle assure aussi
 * le suivi gynécologique de femmes qui ne sont pas enceintes. La page répond
 * par une frise : du premier mois au retour à la maison, avec ce qui est pris
 * en charge à chaque étape — et la consultation de prévention à la fin, qui
 * n'a rien à voir avec une grossesse.
 *
 * DA : la frise elle-même, tracée comme une ligne de vie horizontale ponctuée
 * de jalons. Rose sourd et sauge, sur blanc cassé ; Petrona pour sa douceur
 * sans mièvrerie. On évite le registre « faire-part de naissance » : ce qui se
 * décide ici est médical.
 *
 * Aucun témoignage : déontologie des professions de santé.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FBF7F6",
  panel: "#FFFFFF",
  ink: "#2B1F24",
  inkSoft: "rgba(43,31,36,0.62)",
  line: "rgba(43,31,36,0.14)",
  sage: "#7FA8A0",
};

const DISPLAY = "'Petrona', Georgia, serif";
const BODY = "'Hanken Grotesk', system-ui, sans-serif";

export default function FriseTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "suivi", "sagefemme");
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
    radius: 16,
    border: `1px solid ${C.line}`,
    shadow: "0 18px 40px -32px rgba(43,31,36,0.35)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.15em",
  };

  const slotTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.15em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line,
    accent, onAccent: "#fff", panel: C.panel, radius: 14,
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.15em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 14,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.15em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 500, fontSize: 42, lineHeight: 1.1,
    letterSpacing: "-0.015em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Petrona:ital,wght@0,400;0,500;0,600;1,400&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .fr-jalon { transition: transform .18s ease, border-color .18s ease; }
        .fr-jalon:hover { transform: translateY(-4px); border-color: ${accent}; }
        .fr-cta { transition: filter .15s ease; }
        .fr-cta:hover { filter: brightness(1.07); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .fr-h1 { font-size: 46px !important; }
          .fr-hero { grid-template-columns: 1fr !important; }
          .fr-jalons { grid-template-columns: 1fr 1fr !important; }
          .fr-rail { display: none !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", height: 78, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 25 }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#frise" style={{ color: C.inkSoft, textDecoration: "none" }}>Le suivi</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Consultations</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a className="fr-cta" href="#rendez-vous" style={{ background: accent, color: "#fff", padding: "12px 22px", borderRadius: 999, fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "62px 24px 68px" }}>
        <div className="fr-hero" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>
            <h1 className="fr-h1" style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ fontStyle: "italic", color: accent }}>{kit.promise.strong}</span>
            </h1>
            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.75, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="fr-cta" href="#frise" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 999, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                Voir le suivi complet
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "16px 28px", borderRadius: 999, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>{g}</span>
              ))}
            </div>
          </div>
          <SlotPicker theme={slotTheme} seed={v.seed} title="Prendre rendez-vous" note="Consultations de suivi de grossesse, post-natales et gynécologiques de prévention." />
        </div>
      </section>

      {/* ── La frise ── */}
      <section id="frise" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Le suivi, étape par étape</div>
            <h2 style={h2}>
              Ce qui est prévu, <span style={{ fontStyle: "italic", color: accent }}>et quand</span>.
            </h2>
          </div>

          {/* Le rail : c'est lui qui fait lire la grille comme une durée */}
          <div className="fr-rail" style={{ position: "relative", height: 2, background: C.line, margin: "0 0 26px" }}>
            {m.jalons.map((_, i) => (
              <span
                key={i}
                aria-hidden
                style={{
                  position: "absolute",
                  top: -5,
                  left: `${(i / (m.jalons.length - 1)) * 100}%`,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: i === m.jalons.length - 1 ? C.sage : accent,
                  transform: "translateX(-50%)",
                }}
              />
            ))}
          </div>

          <div className="fr-jalons" style={{ display: "grid", gridTemplateColumns: `repeat(${m.jalons.length}, 1fr)`, gap: 14 }}>
            {m.jalons.map((j) => (
              <div key={j.titre} className="fr-jalon" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 20px" }}>
                <div style={{ ...meta, color: accent, marginBottom: 10 }}>{j.moment}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 20, lineHeight: 1.2, marginBottom: 8 }}>{j.titre}</div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: C.inkSoft }}>{j.desc}</p>
              </div>
            ))}
          </div>

          <p style={{ margin: "28px 0 0", fontSize: 16, lineHeight: 1.75, color: C.inkSoft, maxWidth: 780 }}>{m.note}</p>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 34, lineHeight: 1 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Consultations ── */}
      <section id="tarifs" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 32, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>
          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 26 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services.filter((s) => s.cat === cat).map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 21 }}>{s.name}</div>
                    <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                    {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                  </div>
                  <span style={{ fontFamily: DISPLAY, fontSize: 23, whiteSpace: "nowrap" }}>
                    {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Le cabinet ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>
              Pas seulement <span style={{ fontStyle: "italic", color: accent }}>pour la grossesse</span>.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section id="infos" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 32, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 19, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>Le cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 28, color: accent, textDecoration: "none" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "08:30 – 19:00"], ["Samedi", "09:00 – 12:00"], ["Dimanche", "Fermé"], ["Visites à domicile", "Après l'accouchement"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: C.ink, color: "#fff", padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 44, lineHeight: 1.08, margin: "0 0 20px" }}>
          Un suivi, du début à la suite.
        </h2>
        <a className="fr-cta" href="#rendez-vous" style={{ display: "inline-block", background: accent, color: "#fff", padding: "17px 36px", borderRadius: 999, fontWeight: 600, fontSize: 18, textDecoration: "none" }}>
          {kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
