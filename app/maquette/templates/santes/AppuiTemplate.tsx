import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Pédicure-podologue — direction « L'appui ».
 *
 * Le podologue vend deux choses qui n'ont rien à voir : des soins de pédicurie
 * et des semelles. La seconde est celle qu'on lui dispute — pharmacies, grandes
 * surfaces de sport, semelles vendues en rayon. Son seul argument opposable est
 * l'examen : une semelle qui ne repose sur aucune analyse de la marche ne
 * corrige rien. La page montre donc l'analyse avant le produit.
 *
 * DA : carte de pression. Le hero porte une empreinte plantaire dont les zones
 * sont colorées du bleu (appui léger) au rouge (appui excessif) — c'est
 * exactement l'image que le praticien commente en consultation, et personne
 * d'autre ne peut la montrer. Typo : Chivo, une grotesque un peu carrée qui
 * tient les chiffres, sur un fond gris instrument.
 *
 * Aucun témoignage : déontologie des professions de santé.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#F4F5F7",
  panel: "#FFFFFF",
  ink: "#1B2228",
  inkSoft: "rgba(27,34,40,0.62)",
  line: "rgba(27,34,40,0.14)",
  cool: "#2B5D8C",
  mid: "#E9A13B",
};

const DISPLAY = "'Chivo', system-ui, sans-serif";
const BODY = "'Public Sans', system-ui, sans-serif";

/** Empreinte plantaire : les zones d'appui, du plus léger au plus chargé. */
function CarteAppui({ accent }: { accent: string }) {
  const foot = (dx: number, mirror: boolean) => (
    <g transform={`translate(${dx} 0) ${mirror ? "scale(-1 1) translate(-150 0)" : ""}`}>
      {/* Contour du pied */}
      <path
        d="M75 14 C104 14 118 40 118 74 C118 104 108 124 104 150 C100 176 106 196 100 222 C94 248 78 258 66 258 C50 258 40 244 40 226 C40 200 46 178 44 152 C42 126 32 106 32 74 C32 40 46 14 75 14 Z"
        fill={C.panel}
        stroke={C.line}
        strokeWidth="1.5"
      />
      {/* Talon — charge maximale */}
      <ellipse cx="70" cy="220" rx="26" ry="30" fill={accent} opacity="0.85" />
      {/* Avant-pied — charge forte */}
      <ellipse cx="74" cy="96" rx="34" ry="24" fill={C.mid} opacity="0.85" />
      {/* Voûte — charge faible */}
      <ellipse cx="72" cy="160" rx="18" ry="34" fill={C.cool} opacity="0.35" />
      {/* Orteils */}
      {[
        [50, 40, 10],
        [68, 32, 8],
        [84, 32, 7],
        [98, 38, 6],
        [110, 48, 5],
      ].map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill={C.cool} opacity="0.5" />
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 340 300" width="100%" role="img" aria-label="Carte des appuis plantaires">
      {foot(10, false)}
      {foot(190, true)}
      {/* Échelle de charge */}
      <g transform="translate(12 274)">
        <rect x="0" y="0" width="52" height="8" rx="4" fill={C.cool} opacity="0.4" />
        <rect x="58" y="0" width="52" height="8" rx="4" fill={C.mid} opacity="0.85" />
        <rect x="116" y="0" width="52" height="8" rx="4" fill={accent} opacity="0.85" />
        <text x="0" y="24" fill={C.inkSoft} fontFamily={BODY} fontSize="10" letterSpacing="1.4">
          APPUI LÉGER
        </text>
        <text x="116" y="24" fill={C.inkSoft} fontFamily={BODY} fontSize="10" letterSpacing="1.4">
          APPUI EXCESSIF
        </text>
      </g>
    </svg>
  );
}

export default function AppuiTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "appui", "podologue");
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
    radius: 10,
    border: `1px solid ${C.line}`,
    shadow: "0 18px 40px -32px rgba(27,34,40,0.4)",
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
    radius: 12,
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
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 700,
    fontSize: 40,
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    margin: 0,
    color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Chivo:wght@400;600;700;900&family=Public+Sans:wght@400;600;700&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .ap-etape { transition: border-color .18s ease, transform .18s ease; }
        .ap-etape:hover { border-color: ${accent}; transform: translateY(-3px); }
        .ap-cta { transition: filter .15s ease; }
        .ap-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .ap-h1 { font-size: 44px !important; }
          .ap-hero { grid-template-columns: 1fr !important; }
          .ap-etapes { grid-template-columns: 1fr 1fr !important; }
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
          background: "rgba(244,245,247,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          className="sa-pad"
          style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 21, letterSpacing: "-0.035em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#examen" style={{ color: C.inkSoft, textDecoration: "none" }}>L&apos;examen</a>
            <a href="#semelles" style={{ color: C.inkSoft, textDecoration: "none" }}>Semelles</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos</a>
          </nav>
          <a
            className="ap-cta"
            href="#rendez-vous"
            style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero : la carte d'appui ── */}
      <section className="sa-pad" style={{ padding: "60px 24px 68px" }}>
        <div className="ap-hero" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>

            <h1 className="ap-h1" style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 58, lineHeight: 1, letterSpacing: "-0.045em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.7, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="ap-cta" href="#examen" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
                Voir les 4 étapes
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

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "24px 22px", boxShadow: theme.shadow }}>
            <div style={{ ...meta, marginBottom: 14 }}>Relevé d&apos;appuis — exemple</div>
            <CarteAppui accent={accent} />
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: C.ink, color: "#fff", padding: "30px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 32, letterSpacing: "-0.04em", color: accent }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.88 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── L'examen ── */}
      <section id="examen" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 34 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Avant la semelle</div>
            <h2 style={h2}>Quatre étapes, dans cet ordre.</h2>
          </div>

          <div className="ap-etapes" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {m.etapes.map((e, i) => (
              <div key={e.titre} className="ap-etape" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "24px 22px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 34, color: accent, lineHeight: 1, marginBottom: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, marginBottom: 8 }}>{e.titre}</div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.inkSoft }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Semelles + agenda ── */}
      <section id="semelles" className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Les semelles</div>
            <h2 style={{ ...h2, marginBottom: 22 }}>Moulées ici, ajustées après.</h2>
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 22 }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 40, color: accent, lineHeight: 1 }}>{m.semelles.delai}</div>
                <div style={meta}>de fabrication</div>
              </div>
              <div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 40, color: accent, lineHeight: 1 }}>{m.semelles.prix}</div>
                <div style={meta}>la paire</div>
              </div>
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>{m.semelles.note}</p>
          </div>

          <SlotPicker
            theme={slotTheme}
            seed={v.seed}
            title="Prendre rendez-vous"
            note="Venez avec les chaussures que vous portez le plus souvent : elles en disent autant que l'examen."
          />
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="tarifs" className="sa-pad" style={{ padding: "78px 24px" }}>
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
              {kit.services
                .filter((s) => s.cat === cat)
                .map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "18px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19 }}>{s.name}</div>
                      <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
                      {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 21, whiteSpace: "nowrap", letterSpacing: "-0.03em" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>La marche décide, pas le catalogue.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.78, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section id="infos" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...h2, fontSize: 32, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.q}</div>
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
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 28, color: accent, textDecoration: "none", letterSpacing: "-0.03em" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "08:30 – 19:00"],
              ["Samedi", "09:00 – 13:00"],
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
      <section style={{ background: accent, color: "#fff", padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.04em", margin: "0 0 20px" }}>
          Un examen, puis une semelle.
        </h2>
        <a
          className="ap-cta"
          href="#rendez-vous"
          style={{ display: "inline-block", background: "#fff", color: accent, padding: "17px 36px", borderRadius: 10, fontWeight: 700, fontSize: 18, textDecoration: "none" }}
        >
          {kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
