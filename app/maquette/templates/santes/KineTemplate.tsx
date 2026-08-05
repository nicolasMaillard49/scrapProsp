import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Kinésithérapeute — direction « Le protocole ».
 *
 * Un kiné ne manque pas de patients : il manque de patients qui comprennent
 * pourquoi il faut vingt séances. Sa page ne sert donc pas à attirer, elle sert
 * à poser le cadre — les quatre phases, leurs durées, les critères de sortie.
 * C'est aussi ce qui réduit les abandons en cours de rééducation.
 *
 * Pas de témoignages : interdit aux professions de santé. Informations
 * pratiques et questions fréquentes à la place.
 *
 * D'où la DA : vert clinique et gris, une frise horizontale numérotée qui
 * traverse la page, typographie condensée lisible de loin. Un protocole affiché
 * au mur de la salle, pas une plaquette.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F2F6F4",
  panel: "#FFFFFF",
  ink: "#13211D",
  inkSoft: "rgba(19,33,29,0.62)",
  line: "rgba(19,33,29,0.13)",
};

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const BODY = "'Barlow', system-ui, sans-serif";

export default function KineTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "protocole", "kine");
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
    metaSpacing: "0.16em",
  };

  const slotTheme = {
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.16em",
    ink: C.ink,
    inkSoft: C.inkSoft,
    line: C.line,
    accent,
    onAccent: "#fff",
    panel: C.panel,
    radius: 8,
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
    radius: 8,
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
    fontWeight: 600,
    fontSize: 48,
    lineHeight: 1,
    textTransform: "uppercase",
    letterSpacing: "0.01em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .ki-phase { transition: transform .18s ease, border-color .18s ease; }
        .ki-phase:hover { transform: translateY(-3px); border-color: ${accent}; }
        .ki-cta { transition: filter .15s ease; }
        .ki-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ki-h1 { font-size: 60px !important; }
          .ki-hero { grid-template-columns: 1fr !important; }
          .ki-phases { grid-template-columns: 1fr 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.panel, borderBottom: `2px solid ${C.ink}` }}>
        <div
          className="sa-pad"
          style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 27, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {name}
          </span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#protocole" style={{ color: C.inkSoft, textDecoration: "none" }}>Protocole</a>
            <a href="#motifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Motifs</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos</a>
          </nav>
          <a
            className="ki-cta"
            href="#rendez-vous"
            style={{ background: accent, color: "#fff", padding: "12px 22px", borderRadius: 6, fontWeight: 600, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "60px 24px 64px" }}>
        <div className="ki-hero" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>Sur prescription</span>
            </div>

            <h1
              className="ki-h1"
              style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 76, lineHeight: 0.96, textTransform: "uppercase", letterSpacing: "0.005em", margin: 0 }}
            >
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 470 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="ki-cta" href="#protocole" style={{ background: C.ink, color: C.panel, padding: "16px 28px", borderRadius: 6, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                Voir le protocole
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `2px solid ${C.ink}`, color: C.ink, padding: "14px 28px", borderRadius: 6, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "8px 13px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <figure style={{ margin: 0, borderRadius: 8, overflow: "hidden", aspectRatio: "4/5" }}>
            <img src={kit.hero} alt={`Cabinet de ${name} à ${v.cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </figure>
        </div>
      </section>

      {/* ── Le module : les quatre phases ── */}
      <section id="protocole" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 36 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Du bilan à la sortie</div>
            <h2 style={h2}>Quatre phases, des durées annoncées</h2>
          </div>

          <div className="ki-phases" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {m.phases.map((ph, i) => (
              <div key={ph.titre} className="ki-phase" style={{ border: `1px solid ${C.line}`, borderTop: `4px solid ${accent}`, borderRadius: 6, padding: "24px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 40, lineHeight: 1, color: accent }}>{i + 1}</span>
                  <span style={{ ...meta, color: C.ink }}>{ph.duree}</span>
                </div>
                <div style={{ fontFamily: DISPLAY, fontSize: 24, textTransform: "uppercase", marginBottom: 8 }}>{ph.titre}</div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.inkSoft }}>{ph.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 38, lineHeight: 1 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Motifs + agenda ── */}
      <section id="motifs" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 52, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Ce qui est pris en charge</div>
            <h2 style={{ ...h2, fontSize: 40, marginBottom: 24 }}>Les motifs les plus fréquents</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {m.motifs.map((mo) => (
                <li key={mo} style={{ display: "flex", gap: 14, padding: "15px 0", borderTop: `1px solid ${C.line}`, fontSize: 17 }}>
                  <span aria-hidden style={{ color: accent }}>—</span>
                  <span>{mo}</span>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.65, color: C.inkSoft }}>
              Cette liste n&apos;est pas limitative. La prise en charge dépend de la prescription et du bilan.
            </p>
          </div>

          <SlotPicker
            theme={slotTheme}
            seed={v.seed}
            title="Prendre rendez-vous"
            note="Munissez-vous de votre prescription et de votre carte Vitale. Prévenez 24 h à l'avance en cas d'empêchement."
          />
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="tarifs" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 34, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 26 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 23, textTransform: "uppercase" }}>{s.name}</div>
                      <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                      {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontSize: 26, whiteSpace: "nowrap" }}>
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
        <div className="sa-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
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
            <h2 style={{ ...h2, fontSize: 42, marginBottom: 18 }}>Trente minutes, en individuel</h2>
            <p style={{ fontSize: 17, lineHeight: 1.78, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section id="infos" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 30 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...h2, fontSize: 34, margin: "46px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ border: `1px solid ${C.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 6, padding: "20px 24px", background: C.bg }}>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, fontSize: 42, marginBottom: 24 }}>Le cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>
                  {address || "Centre-ville"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 30, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "07:30 – 19:30"],
              ["Samedi", "08:00 – 12:00"],
              ["Dimanche", "Fermé"],
              ["Domicile", "Sur prescription"],
            ].map(([d, h]) => (
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
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 50, lineHeight: 1, textTransform: "uppercase", margin: "0 0 20px" }}>
          Un bilan, puis un protocole
        </h2>
        <a
          className="ki-cta"
          href="#rendez-vous"
          style={{ display: "inline-block", background: accent, color: "#fff", padding: "17px 36px", borderRadius: 6, fontWeight: 600, fontSize: 18, textDecoration: "none" }}
        >
          {kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
