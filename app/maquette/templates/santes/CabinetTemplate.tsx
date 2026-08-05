import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Médecin généraliste — direction « Le cabinet ».
 *
 * Un médecin n'a aucun besoin d'être trouvé : il a besoin d'arrêter de répondre
 * au téléphone. Les appels qu'il reçoit portent sur les horaires, le secteur de
 * conventionnement, les absences, la conduite à tenir la nuit. Sa page est donc
 * une fiche d'informations pratiques, et l'agenda en ligne absorbe le reste.
 *
 * Registre volontairement institutionnel : sérif de labeur, colonnes sobres,
 * aucun visuel commercial. La déontologie médicale interdit la publicité et
 * tout ce qui ressemble à du démarchage — une page qui « vend » un médecin lui
 * pose un problème avec son Ordre. Aucun témoignage de patient, donc, et aucune
 * promesse : on informe.
 *
 * L'encart d'urgence est en haut et en rouge : c'est l'information dont la
 * mauvaise version tue.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FBFCFD",
  panel: "#FFFFFF",
  ink: "#16202B",
  inkSoft: "rgba(22,32,43,0.64)",
  line: "rgba(22,32,43,0.14)",
  alert: "#C0392B",
};

const DISPLAY = "'Source Serif 4', Georgia, serif";
const BODY = "'Source Sans 3', system-ui, sans-serif";

export default function CabinetTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "cabinet", "medecin");
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
    radius: 8,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.14em",
  };

  const slotTheme = {
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.14em",
    ink: C.ink,
    inkSoft: C.inkSoft,
    line: C.line,
    accent,
    onAccent: "#fff",
    panel: C.panel,
    radius: 10,
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
    radius: 10,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 500,
    fontSize: 40,
    lineHeight: 1.12,
    letterSpacing: "-0.015em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400..600&family=Source+Sans+3:wght@400;600;700&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .cb-line:hover { background: ${C.bg}; }
        .cb-cta { transition: filter .15s ease; }
        .cb-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .cb-h1 { font-size: 42px !important; }
          .cb-hero { grid-template-columns: 1fr !important; }
          .cb-info { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div
          className="sa-pad"
          style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 24, letterSpacing: "-0.015em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#pratique" style={{ color: C.inkSoft, textDecoration: "none" }}>Informations</a>
            <a href="#consultations" style={{ color: C.inkSoft, textDecoration: "none" }}>Consultations</a>
            <a href="#urgence" style={{ color: C.inkSoft, textDecoration: "none" }}>Urgences</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Accès</a>
          </nav>
          <a
            className="cb-cta"
            href="#rendez-vous"
            style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Bandeau urgence ── */}
      <div id="urgence" style={{ background: C.alert, color: "#fff", padding: "13px 24px" }}>
        <div
          className="sa-pad"
          style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 15, lineHeight: 1.5 }}
        >
          <span style={{ ...meta, color: "rgba(255,255,255,0.85)" }}>Urgences</span>
          <span>{m.urgence}</span>
        </div>
      </div>

      {/* ── Hero + agenda ── */}
      <section className="sa-pad" style={{ padding: "60px 24px 68px" }}>
        <div className="cb-hero" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>

            <h1 className="cb-h1" style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 54, lineHeight: 1.06, letterSpacing: "-0.025em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.75, color: C.inkSoft, maxWidth: 470 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="cb-cta" href="#pratique" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                Informations pratiques
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, color: C.ink, padding: "16px 28px", borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <SlotPicker
            theme={slotTheme}
            seed={v.seed}
            title="Prendre rendez-vous"
            note="Rendez-vous en ligne à toute heure. Des créneaux de consultation non programmée sont ouverts chaque matin."
          />
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: C.panel, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "30px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, color: accent }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, color: C.inkSoft }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Le module : la fiche du cabinet ── */}
      <section id="pratique" className="sa-pad" style={{ padding: "76px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 32 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>La fiche du cabinet</div>
            <h2 style={h2}>Tout ce qu&apos;on demande au téléphone.</h2>
          </div>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, overflow: "hidden" }}>
            {m.pratiques.map((pr) => (
              <div
                key={pr.k}
                className="cb-info cb-line"
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.9fr 2fr",
                  gap: 20,
                  padding: "20px 24px",
                  borderTop: `1px solid ${C.line}`,
                  alignItems: "baseline",
                }}
              >
                <span style={{ ...meta, color: C.ink }}>{pr.k}</span>
                <span style={{ fontSize: 17, lineHeight: 1.6, color: C.inkSoft }}>{pr.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Consultations ── */}
      <section id="consultations" className="sa-pad" style={{ background: C.panel, padding: "76px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
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
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 21 }}>{s.name}</div>
                      <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                      {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, whiteSpace: "nowrap" }}>
                      {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Le cabinet ── */}
      <section className="sa-pad" style={{ padding: "76px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>Informer, simplement.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "76px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...h2, fontSize: 32, margin: "46px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "20px 24px", background: C.bg }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accès ── */}
      <section id="contact" className="sa-pad" style={{ padding: "76px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>Accès et contact</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>
                  {address || "Centre-ville"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone du secrétariat</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 28, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Résultats et ordonnances</div>
                <div style={{ fontSize: 17, lineHeight: 1.6 }}>
                  Transmis par messagerie sécurisée de santé. Jamais par courriel ordinaire.
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires d&apos;ouverture</div>
            {[
              ["Lundi — vendredi", "08:30 – 19:00"],
              ["Samedi", "09:00 – 12:00"],
              ["Dimanche et fériés", "Fermé — 116 117"],
              ["Urgence vitale", "15"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "15" || h.includes("116") ? C.alert : C.ink, fontWeight: h === "15" ? 700 : 400 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
