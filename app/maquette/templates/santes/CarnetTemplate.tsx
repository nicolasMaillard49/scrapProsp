import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Vétérinaire — direction « Le carnet ».
 *
 * Deux angoisses envoient les gens chez le vétérinaire : l'urgence de nuit et
 * la facture de la chirurgie. La page traite les deux d'entrée — l'astreinte
 * en bandeau, le devis systématique en promesse — puis reprend l'objet que
 * chaque propriétaire a déjà dans un tiroir : le carnet de santé, avec ses
 * lignes de vaccins et leurs rythmes.
 *
 * DA : papier kraft, tampons, filets d'imprimé administratif. Zilla Slab, un
 * slab serif qui a l'air encré. C'est le registre du document officiel de
 * l'animal — pas celui de l'animalerie, qui inonde ce métier de photos de
 * chiots et ne dit rien de ce qu'on paye.
 *
 * Aucun témoignage : par cohérence avec les autres maquettes de santé, et
 * parce que les avis vétérinaires portent souvent sur des décès d'animaux.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FAF5EC",
  panel: "#FFFDF8",
  ink: "#23281F",
  inkSoft: "rgba(35,40,31,0.64)",
  line: "rgba(35,40,31,0.16)",
  forest: "#2F4A3C",
};

const DISPLAY = "'Zilla Slab', Georgia, serif";
const BODY = "'Asap', system-ui, sans-serif";

export default function CarnetTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "animaux", "veterinaire");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: "#fff", radius: 4, border: `1px solid ${C.line}`, shadow: "none",
    display: DISPLAY, meta: BODY, metaSpacing: "0.15em",
  };

  const slotTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.15em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line,
    accent, onAccent: "#fff", panel: C.panel, radius: 6,
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.15em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 6,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.15em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 42, lineHeight: 1.08,
    letterSpacing: "-0.015em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500;600;700&family=Asap:wght@400;500;600&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .ca-espece { transition: background .15s ease, color .15s ease, border-color .15s ease; }
        .ca-espece:hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .ca-ligne:hover { background: ${C.bg}; }
        .ca-cta { transition: filter .15s ease; }
        .ca-cta:hover { filter: brightness(1.07); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ca-h1 { font-size: 46px !important; }
          .ca-hero { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.panel, borderBottom: `2px solid ${C.ink}` }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 25 }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#carnet" style={{ color: C.inkSoft, textDecoration: "none" }}>Le carnet</a>
            <a href="#actes" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Accès</a>
          </nav>
          <a className="ca-cta" href={`tel:${v.tel}`} style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 4, fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Bandeau d'astreinte ── */}
      <div style={{ background: C.forest, color: "#fff", padding: "13px 24px" }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 15, lineHeight: 1.5 }}>
          <span style={{ ...meta, color: "rgba(255,255,255,0.85)" }}>Urgences</span>
          <span>{m.urgence}</span>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "60px 24px 66px" }}>
        <div className="ca-hero" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>
            <h1 className="ca-h1" style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 58, lineHeight: 1.02, letterSpacing: "-0.03em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>
            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>

            <div style={{ ...meta, marginTop: 30, marginBottom: 12 }}>Espèces reçues</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {m.especes.map((e) => (
                <span key={e} className="ca-espece" style={{ border: `1px solid ${C.line}`, borderRadius: 4, padding: "9px 14px", fontSize: 15, background: C.panel }}>
                  {e}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <a className="ca-cta" href={`tel:${v.tel}`} style={{ background: C.ink, color: C.panel, padding: "16px 28px", borderRadius: 4, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                {phone || "Appeler la clinique"}
              </a>
              <a href="#carnet" style={{ border: `2px solid ${C.ink}`, color: C.ink, padding: "14px 28px", borderRadius: 4, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                Le carnet de vaccination
              </a>
            </div>
          </div>
          <SlotPicker theme={slotTheme} seed={v.seed} title="Prendre rendez-vous" note="Les urgences passent sans rendez-vous aux heures d'ouverture. Apportez le carnet de santé de l'animal." />
        </div>
      </section>

      {/* ── Le carnet de vaccination ── */}
      <section id="carnet" className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 32 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Prévention</div>
            <h2 style={h2}>Le carnet, et ses rappels.</h2>
          </div>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: C.bg, overflow: "hidden" }}>
            <div style={{ ...meta, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, padding: "14px 24px", borderBottom: `2px solid ${C.ink}` }}>
              <span>Vaccin</span>
              <span>Rythme</span>
            </div>
            {m.vaccins.map((vac) => (
              <div key={vac.nom} className="ca-ligne" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, padding: "18px 24px", borderTop: `1px solid ${C.line}`, fontSize: 16, alignItems: "baseline" }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19 }}>{vac.nom}</span>
                <span style={{ color: C.inkSoft }}>{vac.rythme}</span>
              </div>
            ))}
          </div>

          <p style={{ margin: "20px 0 0", fontSize: 15, lineHeight: 1.7, color: C.inkSoft, maxWidth: 760 }}>
            Le protocole exact dépend de l&apos;âge, du mode de vie et des voyages prévus. Il est fixé en consultation,
            et la clinique vous rappelle avant chaque échéance.
          </p>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, lineHeight: 1 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Actes ── */}
      <section id="actes" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 32, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>
          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 26 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services.filter((s) => s.cat === cat).map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20 }}>{s.name}</div>
                    <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
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

      {/* ── La clinique ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
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
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>La clinique</div>
            <h2 style={{ ...h2, marginBottom: 18 }}>Un devis avant, un appel après.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section id="infos" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 32, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 6, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>La clinique</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone (bascule sur l&apos;astreinte la nuit)</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, color: accent, textDecoration: "none" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "08:30 – 19:00"], ["Samedi", "09:00 – 17:00"], ["Dimanche", "Urgences uniquement"], ["Nuits et fériés", "Astreinte"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Astreinte" || h.startsWith("Urgences") ? accent : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: C.forest, color: "#fff", padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 44, lineHeight: 1.06, margin: "0 0 20px" }}>
          Une urgence ? Appelez, on décroche.
        </h2>
        <a className="ca-cta" href={`tel:${v.tel}`} style={{ display: "inline-block", background: "#fff", color: C.forest, padding: "17px 36px", borderRadius: 4, fontWeight: 600, fontSize: 19, textDecoration: "none" }}>
          {phone || kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(255,253,248,0.6)", padding: "30px 24px" }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(255,253,248,0.6)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
