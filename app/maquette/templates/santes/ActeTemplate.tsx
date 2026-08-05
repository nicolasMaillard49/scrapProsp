import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Notaire — direction « L'acte ».
 *
 * Un notaire ne peut pas se différencier par le prix : ses émoluments sont
 * fixés par décret, identiques d'une étude à l'autre. Ce qui se choisit, c'est
 * l'accompagnement. La page joue donc franc jeu — elle explique que les
 * « frais de notaire » sont à 80 % des taxes, puis livre ce que personne ne
 * publie : pour chaque acte, le délai réel et la liste des pièces. C'est
 * l'information qui fait gagner trois semaines sur un dossier.
 *
 * DA : le document authentique. Capitales romaines (Cinzel) pour les titres,
 * Faustina pour le texte, filets doubles, sceau dessiné en SVG. Bordeaux sur
 * papier ivoire — le registre de l'acte, pas celui de l'agence immobilière.
 *
 * Pas de témoignages : la publicité des notaires est encadrée par leur Ordre.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F3F0E7",
  panel: "#FBF9F3",
  ink: "#241F1C",
  inkSoft: "rgba(36,31,28,0.64)",
  line: "rgba(36,31,28,0.18)",
};

const DISPLAY = "'Cinzel', Georgia, serif";
const BODY = "'Faustina', Georgia, serif";

/** Le sceau : ce qui distingue un acte authentique d'un contrat sous seing privé. */
function Sceau({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 200 200" width="100%" role="img" aria-label="Sceau de l'acte authentique">
      <circle cx="100" cy="100" r="86" fill="none" stroke={accent} strokeWidth="2" />
      <circle cx="100" cy="100" r="78" fill="none" stroke={accent} strokeWidth="0.8" />
      <circle cx="100" cy="100" r="56" fill="none" stroke={accent} strokeWidth="0.8" />
      {/* Denture du sceau */}
      {Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        const x1 = 100 + Math.cos(a) * 86;
        const y1 = 100 + Math.sin(a) * 86;
        const x2 = 100 + Math.cos(a) * 92;
        const y2 = 100 + Math.sin(a) * 92;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="1.6" />;
      })}
      <path id="sceau-arc" d="M100 100 m -66 0 a 66 66 0 1 1 132 0" fill="none" />
      <text fill={accent} fontFamily={DISPLAY} fontSize="13" letterSpacing="4.5">
        <textPath href="#sceau-arc" startOffset="50%" textAnchor="middle">
          ACTE AUTHENTIQUE
        </textPath>
      </text>
      <text x="100" y="96" textAnchor="middle" fill={C.ink} fontFamily={DISPLAY} fontSize="21" letterSpacing="2">
        DATE
      </text>
      <text x="100" y="122" textAnchor="middle" fill={C.ink} fontFamily={DISPLAY} fontSize="21" letterSpacing="2">
        CERTAINE
      </text>
      <line x1="62" y1="104" x2="138" y2="104" stroke={C.line} strokeWidth="1" />
    </svg>
  );
}

export default function ActeTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "actes", "notaire");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: "#fff", radius: 2, border: `1px solid ${C.line}`, shadow: "none",
    display: DISPLAY, meta: BODY, metaSpacing: "0.22em",
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.22em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 2,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 10.5, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.22em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 500, fontSize: 34, lineHeight: 1.25,
    letterSpacing: "0.02em", margin: 0, color: C.ink, textTransform: "uppercase",
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Faustina:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        ${SANTE_CSS}
        .ac-acte:hover { background: ${C.bg}; }
        .ac-cta { transition: filter .15s ease; }
        .ac-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ac-h1 { font-size: 34px !important; }
          .ac-hero { grid-template-columns: 1fr !important; }
          .ac-ligne { grid-template-columns: 1fr !important; gap: 6px !important; }
          .ac-ligne .ac-col { border: none !important; padding-left: 0 !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.panel, borderBottom: `3px double ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 84, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 21, letterSpacing: "0.06em", textTransform: "uppercase" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#actes" style={{ color: C.inkSoft, textDecoration: "none" }}>Les actes</a>
            <a href="#frais" style={{ color: C.inkSoft, textDecoration: "none" }}>Les frais</a>
            <a href="#etude" style={{ color: C.inkSoft, textDecoration: "none" }}>L&apos;étude</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a className="ac-cta" href={`tel:${v.tel}`} style={{ background: accent, color: "#fff", padding: "12px 20px", fontFamily: DISPLAY, fontSize: 13, letterSpacing: "0.08em", textDecoration: "none", whiteSpace: "nowrap" }}>
            {phone || kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "76px 24px 80px" }}>
        <div className="ac-hero" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 18, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>
            <h1 className="ac-h1" style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 46, lineHeight: 1.22, letterSpacing: "0.01em", margin: 0, textTransform: "uppercase" }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>
            <p style={{ marginTop: 24, fontSize: 18.5, lineHeight: 1.8, color: C.inkSoft, maxWidth: 500 }}>{kit.promise.sub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 34, flexWrap: "wrap" }}>
              <a className="ac-cta" href="#actes" style={{ background: C.ink, color: C.panel, padding: "16px 28px", fontFamily: DISPLAY, fontSize: 14, letterSpacing: "0.08em", textDecoration: "none" }}>
                Délais et pièces par acte
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, color: C.ink, padding: "16px 28px", fontFamily: DISPLAY, fontSize: 14, letterSpacing: "0.08em", textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>
          </div>
          <div style={{ padding: "0 8px" }}>
            <Sceau accent={accent} />
          </div>
        </div>
      </section>

      {/* ── Les actes ── */}
      <section id="actes" className="sa-pad" style={{ background: C.panel, padding: "80px 24px", borderTop: `3px double ${C.line}`, borderBottom: `3px double ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>Ce qu&apos;il faut apporter</div>
            <h2 style={h2}>Chaque acte, son délai et ses pièces</h2>
          </div>

          <div className="ac-ligne" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.6fr 1.6fr", gap: 20, ...meta, paddingBottom: 12, borderBottom: `1px solid ${C.line}` }}>
            <span>Acte</span>
            <span>Délai courant</span>
            <span>Pièces à réunir</span>
          </div>
          {m.actes.map((a) => (
            <div
              key={a.nom}
              className="ac-ligne ac-acte"
              style={{ display: "grid", gridTemplateColumns: "1.1fr 0.6fr 1.6fr", gap: 20, padding: "22px 0", borderBottom: `1px solid ${C.line}`, alignItems: "baseline" }}
            >
              <span style={{ fontFamily: DISPLAY, fontSize: 19, letterSpacing: "0.02em" }}>{a.nom}</span>
              <span className="ac-col" style={{ color: accent, fontSize: 16.5 }}>{a.delai}</span>
              <span className="ac-col" style={{ color: C.inkSoft, fontSize: 16.5, lineHeight: 1.6, borderLeft: `1px solid ${C.line}`, paddingLeft: 20 }}>
                {a.pieces}
              </span>
            </div>
          ))}

          <p style={{ margin: "26px 0 0", fontSize: 17, lineHeight: 1.8, color: C.inkSoft, maxWidth: 780 }}>{m.note}</p>
        </div>
      </section>

      {/* ── Les frais ── */}
      <section id="frais" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div className="sa-two" style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 52, alignItems: "center" }}>
            <div>
              <div style={{ ...meta, color: accent, marginBottom: 14 }}>Les frais de notaire</div>
              <h2 style={{ ...h2, marginBottom: 20 }}>Ils ne vont pas au notaire</h2>
              <p style={{ margin: 0, fontSize: 17.5, lineHeight: 1.85, color: C.inkSoft }}>
                Sur une vente, l&apos;essentiel de ce qu&apos;on appelle « frais de notaire » est constitué de droits
                et de taxes reversés à l&apos;État et aux collectivités. Les émoluments de l&apos;étude, eux, sont
                fixés par décret : ils sont identiques dans toutes les études de France.
              </p>
            </div>
            <div>
              {[
                { part: "≈ 80 %", quoi: "Droits de mutation reversés à l'État et au département" },
                { part: "≈ 10 %", quoi: "Débours : documents, géomètre, cadastre, publication" },
                { part: "≈ 10 %", quoi: "Émoluments de l'étude, tarifés par décret" },
              ].map((f) => (
                <div key={f.part} style={{ display: "flex", gap: 22, padding: "20px 0", borderTop: `1px solid ${C.line}`, alignItems: "baseline" }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 26, color: accent, minWidth: 92 }}>{f.part}</span>
                  <span style={{ fontSize: 16.5, lineHeight: 1.6 }}>{f.quoi}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginTop: 44 }}>
            {kit.facts.map((f) => (
              <div key={f.k} style={{ maxWidth: 240 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 26, color: accent, letterSpacing: "0.02em" }}>{f.k}</div>
                <div style={{ fontSize: 15, lineHeight: 1.6, color: C.inkSoft, marginTop: 6 }}>{f.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prestations ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "80px 24px", borderTop: `3px double ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ marginBottom: 32, maxWidth: 660 }}>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} {kit.labels.catalogueSub}
            </h2>
          </div>
          {v.cats.map((cat) => (
            <div key={cat} style={{ marginBottom: 22 }}>
              <div style={{ ...meta, color: accent, marginBottom: 10 }}>{cat}</div>
              {kit.services.filter((s) => s.cat === cat).map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 19, letterSpacing: "0.02em" }}>{s.name}</div>
                    <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 16, lineHeight: 1.6 }}>{s.desc}</p>
                    {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                  </div>
                  <span style={{ fontFamily: DISPLAY, fontSize: 17, whiteSpace: "nowrap", color: accent, letterSpacing: "0.04em" }}>
                    {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── L'étude ── */}
      <section id="etude" className="sa-pad" style={{ padding: "80px 24px" }}>
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
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>L&apos;étude</div>
            <h2 style={{ ...h2, marginBottom: 20 }}>Expliquer avant de signer</h2>
            <p style={{ fontSize: 17.5, lineHeight: 1.85, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "80px 24px", borderTop: `3px double ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.bg, border: `1px solid ${C.line}`, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 10 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.6 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 26, margin: "44px 0 18px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.bg, border: `1px solid ${C.line}`, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 17, letterSpacing: "0.02em", marginBottom: 10 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.75, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>Prendre rendez-vous</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Adresse</div>
                <div style={{ fontSize: 17.5 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 28, color: accent, textDecoration: "none", letterSpacing: "0.02em" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ border: `1px solid ${C.line}`, padding: 28, background: C.panel }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "09:00 – 12:30 · 14:00 – 18:00"], ["Samedi", "Sur rendez-vous"], ["Dimanche", "Fermé"], ["Signature à distance", "Visioconférence sécurisée"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink, textAlign: "right" }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.ink, color: "rgba(251,249,243,0.62)", padding: "32px 24px" }}>
        <div className="sa-pad" style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta, color: "rgba(251,249,243,0.62)" }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
