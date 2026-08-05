import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Sophrologue — direction « Le souffle ».
 *
 * Personne ne sait à quoi ressemble une séance de sophrologie. C'est le seul
 * obstacle réel du métier : on n'achète pas ce qu'on ne peut pas se
 * représenter. La page raconte donc l'heure minute par minute, et pose le
 * cadre déontologique — accompagnement, ni diagnostic ni traitement — au lieu
 * de le laisser dans le flou où prospèrent les dérives.
 *
 * DA : une courbe de respiration tracée en SVG traverse le hero, et les quatre
 * temps de la séance se lisent dessous comme sur une partition. Bleu lavande
 * et brume, Epilogue en display comme en texte, très peu de contraste. La page
 * doit ralentir le lecteur — c'est le produit.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#EEF1F7",
  panel: "#FAFBFD",
  ink: "#232838",
  inkSoft: "rgba(35,40,56,0.62)",
  line: "rgba(35,40,56,0.14)",
};

const DISPLAY = "'Epilogue', system-ui, sans-serif";
const BODY = "'Epilogue', system-ui, sans-serif";

/** La courbe du souffle : quatre cycles, un par temps de la séance. */
function CourbeSouffle({ accent }: { accent: string }) {
  const w = 640;
  const h = 150;
  const mid = h / 2;
  // Quatre amplitudes décroissantes : l'apaisement se voit dans le tracé.
  const amps = [46, 40, 30, 20];
  let d = `M0 ${mid}`;
  amps.forEach((a, i) => {
    const seg = w / amps.length;
    const x0 = i * seg;
    d += ` C ${x0 + seg * 0.2} ${mid - a}, ${x0 + seg * 0.3} ${mid - a}, ${x0 + seg * 0.5} ${mid}`;
    d += ` C ${x0 + seg * 0.7} ${mid + a}, ${x0 + seg * 0.8} ${mid + a}, ${x0 + seg} ${mid}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Courbe de respiration sur une séance">
      <line x1="0" y1={mid} x2={w} y2={mid} stroke={C.line} strokeWidth="1" strokeDasharray="4 6" />
      <path d={d} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      {amps.map((_, i) => (
        <circle key={i} cx={(i + 0.5) * (w / amps.length)} cy={mid} r="3.5" fill={accent} />
      ))}
    </svg>
  );
}

export default function SouffleTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "respiration", "sophrologue");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: "#fff", radius: 18, border: `1px solid ${C.line}`,
    shadow: "0 20px 44px -36px rgba(35,40,56,0.4)",
    display: DISPLAY, meta: BODY, metaSpacing: "0.18em",
  };

  const slotTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.18em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line,
    accent, onAccent: "#fff", panel: C.panel, radius: 16,
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.18em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 16,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.18em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 400, fontSize: 40, lineHeight: 1.15,
    letterSpacing: "-0.025em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@300;400;500;600&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .so-temps { transition: background .2s ease; }
        .so-temps:hover { background: ${C.panel}; }
        .so-cta { transition: filter .15s ease; }
        .so-cta:hover { filter: brightness(1.07); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .so-h1 { font-size: 42px !important; }
          .so-two { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: "rgba(238,241,247,0.94)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 40, borderBottom: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 22, letterSpacing: "-0.02em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#seance" style={{ color: C.inkSoft, textDecoration: "none" }}>La séance</a>
            <a href="#indications" style={{ color: C.inkSoft, textDecoration: "none" }}>Indications</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a className="so-cta" href="#rendez-vous" style={{ background: accent, color: "#fff", padding: "12px 22px", borderRadius: 999, fontWeight: 500, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero + courbe ── */}
      <section className="sa-pad" style={{ padding: "70px 24px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
            <span style={{ color: accent }}>{v.label}</span>
            <span style={{ width: 18, height: 1, background: C.line }} />
            <span>{v.cityLabel}</span>
          </div>
          <h1 className="so-h1" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 56, lineHeight: 1.08, letterSpacing: "-0.035em", margin: 0, maxWidth: 720 }}>
            {kit.promise.lead} <span style={{ color: accent }}>{kit.promise.strong}</span>
          </h1>
          <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.8, color: C.inkSoft, maxWidth: 560 }}>{kit.promise.sub}</p>
        </div>
      </section>

      <section className="sa-pad" style={{ padding: "10px 24px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <CourbeSouffle accent={accent} />
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.line, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden", marginTop: -6 }}>
            {m.minutes.map((mn) => (
              <div key={mn.t} className="so-temps" style={{ background: C.bg, padding: "24px 22px" }}>
                <div style={{ ...meta, color: accent, marginBottom: 10 }}>{mn.t}</div>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: C.ink }}>{mn.quoi}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <a className="so-cta" href="#rendez-vous" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 999, fontWeight: 500, fontSize: 16, textDecoration: "none" }}>
              {kit.labels.cta}
            </a>
            {phone && (
              <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "16px 28px", borderRadius: 999, fontWeight: 500, fontSize: 16, textDecoration: "none" }}>
                {phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Indications ── */}
      <section id="indications" className="sa-pad" style={{ background: C.panel, padding: "76px 24px" }}>
        <div className="so-two sa-two" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Indications</div>
            <h2 style={{ ...h2, marginBottom: 18 }}>Ce qui s&apos;accompagne.</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: C.inkSoft }}>
              La sophrologie accompagne : elle ne pose aucun diagnostic et ne remplace ni un traitement ni un
              suivi médical ou psychologique en cours.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
              {kit.garanties.map((g) => (
                <span key={g} style={{ ...meta, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px" }}>{g}</span>
              ))}
            </div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {m.indications.map((ind) => (
              <li key={ind} style={{ display: "flex", gap: 14, padding: "16px 0", borderTop: `1px solid ${C.line}`, fontSize: 17, lineHeight: 1.6 }}>
                <span aria-hidden style={{ color: accent }}>◦</span>
                <span>{ind}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 32 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tarifs + agenda ── */}
      <section id="tarifs" className="sa-pad" style={{ padding: "76px 24px" }}>
        <div className="so-two sa-two" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={{ ...h2, marginBottom: 22 }}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
            {v.cats.map((cat) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ ...meta, color: accent, marginBottom: 8 }}>{cat}</div>
                {kit.services.filter((s) => s.cat === cat).map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 18, padding: "16px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 18 }}>{s.name}</div>
                      <p style={{ margin: "3px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, whiteSpace: "nowrap" }}>
                      {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <SlotPicker theme={slotTheme} seed={v.seed} title="Prendre rendez-vous" note="Venez en vêtements confortables. Les exercices se font assis ou debout, jamais au sol si vous ne le souhaitez pas." />
        </div>
      </section>

      {/* ── Le cabinet ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "76px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>Ce qui se travaille entre les séances.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ padding: "76px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 26 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 30, margin: "44px 0 18px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 18, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ background: C.panel, padding: "76px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 22 }}>Le cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 26, color: accent, textDecoration: "none" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "09:00 – 20:00"], ["Samedi", "09:00 – 13:00"], ["Dimanche", "Fermé"], ["Séances en groupe", "Mardi 18 h 30"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 16 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.bg, color: C.inkSoft, padding: "30px 24px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
