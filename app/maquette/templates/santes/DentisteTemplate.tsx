import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Dentiste — direction « Le plan de traitement ».
 *
 * Ce qui fait peur chez le dentiste n'est pas le fauteuil, c'est la facture :
 * personne ne sait ce que coûte une couronne ni ce qui en revient. La page
 * répond par le seul document que le cabinet produit déjà — le devis, avec ses
 * trois colonnes : honoraires, base de remboursement, reste à charge. Aucun
 * argument commercial n'est aussi efficace, et il est parfaitement conforme.
 *
 * Pas de témoignages de patients : c'est interdit aux professions de santé.
 * À leur place, des informations pratiques et des questions fréquentes.
 *
 * D'où la DA : blanc clinique, bleu froid, tableaux alignés au cordeau. La page
 * doit ressembler à un document, pas à une publicité.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F7FAFC",
  panel: "#FFFFFF",
  ink: "#0F1F2B",
  inkSoft: "rgba(15,31,43,0.62)",
  line: "rgba(15,31,43,0.12)",
};

const DISPLAY = "'Plus Jakarta Sans', system-ui, sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function DentisteTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "devis", "dentiste");
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
    radius: 12,
    border: `1px solid ${C.line}`,
    shadow: "0 20px 44px -34px rgba(15,31,43,0.4)",
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
    radius: 14,
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
    radius: 14,
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
    fontWeight: 800,
    fontSize: 40,
    lineHeight: 1.08,
    letterSpacing: "-0.035em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .dt-row:hover { background: ${C.bg}; }
        .dt-cta { transition: filter .15s ease; }
        .dt-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .dt-h1 { font-size: 44px !important; }
          .dt-hero { grid-template-columns: 1fr !important; }
          .dt-devis { font-size: 13px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(247,250,252,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="sa-pad"
          style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#devis" style={{ color: C.inkSoft, textDecoration: "none" }}>Devis type</a>
            <a href="#soins" style={{ color: C.inkSoft, textDecoration: "none" }}>Soins</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos pratiques</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="dt-cta"
            href="#rendez-vous"
            style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero + agenda ── */}
      <section className="sa-pad" style={{ padding: "64px 24px 72px" }}>
        <div className="dt-hero" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>

            <h1 className="dt-h1" style={{ fontWeight: 800, fontSize: 56, lineHeight: 1.02, letterSpacing: "-0.045em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 470 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="dt-cta" href="#devis" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                Voir un devis type
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "16px 28px", borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <SlotPicker
            theme={slotTheme}
            seed={v.seed}
            title="Prendre rendez-vous"
            note="Confirmation immédiate et rappel SMS la veille. Pour une douleur aiguë, appelez le cabinet le matin."
          />
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 32, letterSpacing: "-0.04em" }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Le module : le devis type ── */}
      <section id="devis" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 34 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Ce que vous recevez avant les soins</div>
            <h2 style={h2}>Trois colonnes, aucune surprise.</h2>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
            <div
              className="dt-devis"
              style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr", gap: 0, ...meta, background: C.bg, padding: "14px 22px" }}
            >
              <span>Acte</span>
              <span style={{ textAlign: "right" }}>Honoraires</span>
              <span style={{ textAlign: "right" }}>Sécu</span>
              <span style={{ textAlign: "right" }}>Reste à charge</span>
            </div>
            {m.lignes.map((l) => (
              <div
                key={l.acte}
                className="dt-devis dt-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 1fr 1.4fr",
                  gap: 0,
                  padding: "18px 22px",
                  borderTop: `1px solid ${C.line}`,
                  fontSize: 15,
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 700 }}>{l.acte}</span>
                <span style={{ textAlign: "right" }}>{l.honoraires.toFixed(2).replace(".", ",")} €</span>
                <span style={{ textAlign: "right", color: accent, fontWeight: 700 }}>
                  {l.secu === 0 ? "—" : `${l.secu.toFixed(2).replace(".", ",")} €`}
                </span>
                <span style={{ textAlign: "right", color: C.inkSoft }}>{l.reste}</span>
              </div>
            ))}
          </div>

          <p style={{ margin: "20px 0 0", fontSize: 14, lineHeight: 1.7, color: C.inkSoft, maxWidth: 780 }}>{m.note}</p>

          <div
            style={{
              marginTop: 26,
              background: C.panel,
              border: `1px solid ${accent}44`,
              borderLeft: `4px solid ${accent}`,
              borderRadius: 12,
              padding: "20px 24px",
            }}
          >
            <div style={{ ...meta, color: accent, marginBottom: 8 }}>Urgence</div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>{m.urgence}</p>
          </div>
        </div>
      </section>

      {/* ── Les soins ── */}
      <section id="soins" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 38, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>

          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{s.name}</div>
                      <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                      {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 21, whiteSpace: "nowrap", letterSpacing: "-0.03em" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>Ce que vous devez savoir avant de venir.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.78, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Informations pratiques ── */}
      <section id="infos" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 32 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...h2, fontSize: 32, margin: "48px 0 22px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "20px 24px", background: C.bg }}>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>Le cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>
                  {address || "Centre-ville"}, {v.cityLabel}
                </div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontWeight: 800, fontSize: 26, color: accent, textDecoration: "none", letterSpacing: "-0.03em" }}>
                  {phone || "—"}
                </a>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Rendez-vous</div>
                <div style={{ fontSize: 17 }}>En ligne à toute heure, ou par téléphone aux heures d&apos;ouverture.</div>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[
              ["Lundi — jeudi", "09:00 – 19:00"],
              ["Vendredi", "09:00 – 17:00"],
              ["Samedi", "09:00 – 12:00"],
              ["Dimanche", "Fermé"],
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
        <h2 style={{ fontWeight: 800, fontSize: 42, lineHeight: 1.06, letterSpacing: "-0.04em", margin: "0 0 20px" }}>
          Un rendez-vous, un devis, puis les soins.
        </h2>
        <a
          className="dt-cta"
          href="#rendez-vous"
          style={{ display: "inline-block", background: accent, color: "#fff", padding: "17px 36px", borderRadius: 10, fontWeight: 700, fontSize: 18, textDecoration: "none" }}
        >
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
