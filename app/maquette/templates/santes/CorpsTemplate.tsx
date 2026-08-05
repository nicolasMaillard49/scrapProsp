import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Ostéopathe — direction « La planche ».
 *
 * Ce que vend un ostéopathe est mal compris : les gens viennent pour un dos et
 * repartent surpris qu'on ait regardé ailleurs. La page part donc de son objet
 * de travail — la planche anatomique — et montre les quatre zones avec, sous
 * chacune, les motifs qui s'y rattachent. Le message « le motif n'est pas la
 * frontière » devient visuel au lieu d'être une phrase.
 *
 * DA : planche sombre plutôt que cabinet clair. Indigo profond, tracés à la
 * craie, cuivre en accent, sérif à fort contraste (Spectral) contre une
 * grotesque neutre. C'est le registre de l'atlas d'anatomie, pas celui du spa —
 * et ça éloigne la maquette du beige thérapeutique que tout le monde emploie.
 *
 * Aucun témoignage : déontologie des professions de santé. Informations
 * pratiques et questions fréquentes à la place.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#161B26",
  panel: "#1E2532",
  panelSoft: "#252D3C",
  ink: "#EDEAE3",
  inkSoft: "rgba(237,234,227,0.58)",
  line: "rgba(237,234,227,0.16)",
  chalk: "rgba(237,234,227,0.34)",
};

const DISPLAY = "'Spectral', Georgia, serif";
const BODY = "'Work Sans', system-ui, sans-serif";

/** Silhouette à la craie : les quatre zones de la planche, numérotées. */
function PlancheCorps({ accent, zones }: { accent: string; zones: string[] }) {
  // Ancres des repères, en coordonnées du viewBox.
  const marks = [
    { x: 128, y: 96 },
    { x: 128, y: 176 },
    { x: 128, y: 256 },
    { x: 128, y: 330 },
  ];
  return (
    <svg viewBox="0 0 256 420" width="100%" role="img" aria-label="Zones traitées, sur une silhouette">
      <g fill="none" stroke={C.chalk} strokeWidth="1.6" strokeLinecap="round">
        {/* Tête et cou */}
        <circle cx="128" cy="52" r="26" />
        <path d="M128 78 v18" />
        {/* Tronc */}
        <path d="M92 104 h72 l10 96 h-92 z" />
        {/* Bras */}
        <path d="M92 106 L62 190 L54 246" />
        <path d="M164 106 L194 190 L202 246" />
        {/* Bassin */}
        <path d="M84 200 h88 l-6 40 h-76 z" />
        {/* Jambes */}
        <path d="M100 240 L94 330 L90 396" />
        <path d="M156 240 L162 330 L166 396" />
        {/* Repères de vertèbres — le détail qui dit « planche » */}
        {[118, 132, 146, 160, 174, 188].map((y) => (
          <path key={y} d={`M124 ${y} h8`} strokeWidth="1.2" />
        ))}
      </g>
      {marks.map((m, i) => (
        <g key={i}>
          <line x1={m.x + 14} y1={m.y} x2="228" y2={m.y} stroke={accent} strokeWidth="1" strokeDasharray="3 4" />
          <circle cx={m.x} cy={m.y} r="7" fill="none" stroke={accent} strokeWidth="1.8" />
          <circle cx={m.x} cy={m.y} r="2.4" fill={accent} />
          <text x="234" y={m.y + 4} fill={accent} fontFamily={BODY} fontSize="11" fontWeight="600">
            {i + 1}
          </text>
        </g>
      ))}
      <text x="12" y="410" fill={C.inkSoft} fontFamily={BODY} fontSize="10" letterSpacing="2">
        {zones.length} ZONES EXAMINÉES
      </text>
    </svg>
  );
}

export default function CorpsTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "zones", "osteopathe");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.bg,
    radius: 8,
    border: `1px solid ${C.line}`,
    shadow: "none",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.18em",
  };

  const slotTheme = {
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.18em",
    ink: C.ink,
    inkSoft: C.inkSoft,
    line: C.line,
    accent,
    onAccent: C.bg,
    panel: C.panelSoft,
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
    radius: 12,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 400,
    fontSize: 42,
    lineHeight: 1.1,
    letterSpacing: "-0.015em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;1,300&family=Work+Sans:wght@400;500;600&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: ${C.bg}; }
        .os-zone { transition: border-color .18s ease, background .18s ease; }
        .os-zone:hover { border-color: ${accent}; background: ${C.panelSoft}; }
        .os-cta { transition: filter .15s ease; }
        .os-cta:hover { filter: brightness(1.12); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .os-h1 { font-size: 46px !important; }
          .os-hero { grid-template-columns: 1fr !important; }
          .os-zones { grid-template-columns: 1fr 1fr !important; }
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
          background: "rgba(22,27,38,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="sa-pad"
          style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 25, letterSpacing: "-0.015em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#zones" style={{ color: C.inkSoft, textDecoration: "none" }}>Zones</a>
            <a href="#seance" style={{ color: C.inkSoft, textDecoration: "none" }}>La séance</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos</a>
          </nav>
          <a
            className="os-cta"
            href="#rendez-vous"
            style={{ background: accent, color: C.bg, padding: "12px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero : la planche ── */}
      <section className="sa-pad" style={{ padding: "64px 24px 72px" }}>
        <div className="os-hero" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>

            <h1 className="os-h1" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 60, lineHeight: 1.04, letterSpacing: "-0.025em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ fontStyle: "italic", color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.75, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <a className="os-cta" href="#zones" style={{ background: accent, color: C.bg, padding: "16px 28px", borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                Voir les zones
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, color: C.ink, padding: "16px 28px", borderRadius: 8, fontSize: 16, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "22px 18px" }}>
            <PlancheCorps accent={accent} zones={m.zones.map((z) => z.name)} />
          </div>
        </div>
      </section>

      {/* ── Les zones ── */}
      <section id="zones" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Ce qui s&apos;examine</div>
            <h2 style={h2}>
              Le motif de consultation
              <br />
              <span style={{ fontStyle: "italic", color: accent }}>ne limite pas l&apos;examen.</span>
            </h2>
          </div>

          <div className="os-zones" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {m.zones.map((z, i) => (
              <div key={z.name} className="os-zone" style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "24px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: `1.5px solid ${accent}`,
                      color: accent,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 22 }}>{z.name}</span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {z.motifs.map((mo) => (
                    <li key={mo} style={{ padding: "9px 0", borderTop: `1px solid ${C.line}`, fontSize: 15, lineHeight: 1.5, color: C.inkSoft }}>
                      {mo}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── La séance + agenda ── */}
      <section id="seance" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>La séance</div>
            <h2 style={{ ...h2, marginBottom: 22 }}>Une heure, un tarif unique.</h2>
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 44, color: accent, lineHeight: 1 }}>{m.seance.duree}</div>
                <div style={meta}>durée de consultation</div>
              </div>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 44, color: accent, lineHeight: 1 }}>{m.seance.prix}</div>
                <div style={meta}>quel que soit le motif</div>
              </div>
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{m.seance.note}</p>

            <div style={{ display: "flex", gap: 26, marginTop: 32, flexWrap: "wrap" }}>
              {kit.facts.map((f) => (
                <div key={f.k} style={{ maxWidth: 200 }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 28, color: C.ink }}>{f.k}</div>
                  <div style={{ ...meta, textTransform: "none", letterSpacing: 0, fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{f.v}</div>
                </div>
              ))}
            </div>
          </div>

          <SlotPicker
            theme={slotTheme}
            seed={v.seed}
            title="Prendre rendez-vous"
            note="Prévoyez une heure. Apportez vos examens d'imagerie récents s'il y en a."
          />
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="tarifs" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 34, maxWidth: 640 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={h2}>
              {kit.labels.catalogue} <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
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
                      <div style={{ fontFamily: DISPLAY, fontSize: 22 }}>{s.name}</div>
                      <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                      {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontSize: 24, whiteSpace: "nowrap" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>
              Ce que l&apos;ostéopathie <span style={{ fontStyle: "italic", color: accent }}>ne remplace pas</span>.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section id="infos" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 30 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...h2, fontSize: 32, margin: "46px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "20px 24px", background: C.bg }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 20, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ padding: "80px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
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
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 30, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "08:00 – 20:00"],
              ["Samedi", "09:00 – 13:00"],
              ["Dimanche", "Fermé"],
              ["Domicile", "Sur demande"],
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
      <section style={{ background: accent, color: C.bg, padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 46, lineHeight: 1.06, margin: "0 0 20px" }}>
          Une heure pour regarder l&apos;ensemble.
        </h2>
        <a
          className="os-cta"
          href="#rendez-vous"
          style={{ display: "inline-block", background: C.bg, color: accent, padding: "17px 36px", borderRadius: 8, fontWeight: 600, fontSize: 18, textDecoration: "none" }}
        >
          {kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px" }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
