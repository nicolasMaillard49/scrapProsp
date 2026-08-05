import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Diététicien — direction « L'assiette ».
 *
 * Le diététicien diplômé se bat contre le coach en nutrition d'Instagram, qui
 * promet moins huit kilos en un mois. Il ne peut pas gagner sur la promesse —
 * il gagne sur ce qu'il refuse de faire. La page affiche donc explicitement ce
 * que l'accompagnement N'EST PAS : pas de régime sous 1 200 kcal, pas de
 * compléments vendus au cabinet, pas de chiffre promis. C'est l'argument le
 * plus fort du métier, et personne ne l'écrit.
 *
 * DA : l'assiette, en proportions réelles plutôt qu'en photo de salade. Un
 * disque partagé en trois secteurs sert d'accroche, vert frais sur crème,
 * Bricolage Grotesque pour sa franchise un peu carrée.
 *
 * Aucun témoignage : cohérence avec les autres maquettes de santé, et les
 * transformations avant/après sont exactement ce qu'on veut éviter ici.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FBFBF5",
  panel: "#FFFFFF",
  ink: "#242A1E",
  inkSoft: "rgba(36,42,30,0.62)",
  line: "rgba(36,42,30,0.14)",
  warn: "#B4553F",
};

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Onest', system-ui, sans-serif";

/** L'assiette en proportions : légumes, féculents, protéines. */
function Assiette({ accent }: { accent: string }) {
  const parts = [
    { label: "Légumes", frac: 0.5, color: accent },
    { label: "Féculents", frac: 0.25, color: "#C9A227" },
    { label: "Protéines", frac: 0.25, color: "#8C6A4F" },
  ];
  const r = 74;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 220 220" width="100%" role="img" aria-label="Proportions d'une assiette équilibrée">
      <circle cx="110" cy="110" r="94" fill="none" stroke={C.line} strokeWidth="2" />
      {parts.map((p) => {
        const dash = p.frac * c;
        const el = (
          <circle
            key={p.label}
            cx="110" cy="110" r={r} fill="none" stroke={p.color} strokeWidth="30"
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
            transform="rotate(-90 110 110)"
          />
        );
        offset += dash;
        return el;
      })}
      <circle cx="110" cy="110" r="46" fill={C.panel} />
      <text x="110" y="106" textAnchor="middle" fill={C.ink} fontFamily={DISPLAY} fontSize="26" fontWeight="700">½</text>
      <text x="110" y="128" textAnchor="middle" fill={C.inkSoft} fontFamily={BODY} fontSize="11" letterSpacing="1.5">
        LÉGUMES
      </text>
    </svg>
  );
}

export default function AssietteTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "accompagnement", "dieteticien");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: "#fff", radius: 14, border: `1px solid ${C.line}`,
    shadow: "0 18px 40px -32px rgba(36,42,30,0.35)",
    display: DISPLAY, meta: BODY, metaSpacing: "0.13em",
  };

  const slotTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.13em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line,
    accent, onAccent: "#fff", panel: C.panel, radius: 14,
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.13em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 14,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.13em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 700, fontSize: 42, lineHeight: 1.06,
    letterSpacing: "-0.03em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Onest:wght@400;500;600&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .as-etape { transition: transform .18s ease, border-color .18s ease; }
        .as-etape:hover { transform: translateY(-3px); border-color: ${accent}; }
        .as-cta { transition: filter .15s ease; }
        .as-cta:hover { filter: brightness(1.07); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .as-h1 { font-size: 46px !important; }
          .as-hero { grid-template-columns: 1fr !important; }
          .as-etapes { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", height: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 23, letterSpacing: "-0.03em" }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#accompagnement" style={{ color: C.inkSoft, textDecoration: "none" }}>L&apos;accompagnement</a>
            <a href="#nonce" style={{ color: C.inkSoft, textDecoration: "none" }}>Ce que ce n&apos;est pas</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a className="as-cta" href="#rendez-vous" style={{ background: accent, color: "#fff", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "62px 24px 68px" }}>
        <div className="as-hero" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
            </div>
            <h1 className="as-h1" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 58, lineHeight: 1, letterSpacing: "-0.04em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>
            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.72, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="as-cta" href="#accompagnement" style={{ background: C.ink, color: "#fff", padding: "16px 28px", borderRadius: 12, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                Comment ça se passe
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "16px 28px", borderRadius: 12, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
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
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 24px" }}>
            <div style={{ ...meta, marginBottom: 10 }}>Le repère de base</div>
            <Assiette accent={accent} />
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}>
              Un point de départ, pas une règle : la répartition se travaille avec vos contraintes réelles.
            </p>
          </div>
        </div>
      </section>

      {/* ── L'accompagnement ── */}
      <section id="accompagnement" className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ maxWidth: 620, marginBottom: 34 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Trois étapes</div>
            <h2 style={h2}>Du bilan au suivi espacé.</h2>
          </div>
          <div className="as-etapes" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {m.etapes.map((e, i) => (
              <div key={e.titre} className="as-etape" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 24px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 36, color: accent, lineHeight: 1 }}>{i + 1}</span>
                  <span style={{ ...meta, color: C.ink }}>{e.quand}</span>
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 21, marginBottom: 8 }}>{e.titre}</div>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: C.inkSoft }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ce que ce n'est pas — l'argument du métier ── */}
      <section id="nonce" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div className="sa-two" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 48, alignItems: "center" }}>
            <div>
              <div style={{ ...meta, color: C.warn, marginBottom: 12 }}>Ce que ce n&apos;est pas</div>
              <h2 style={{ ...h2, marginBottom: 18 }}>Ce qu&apos;on ne vous proposera pas.</h2>
              <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.75, color: C.inkSoft }}>
                Un diététicien nutritionniste est un professionnel de santé diplômé d&apos;État. Ce cadre lui interdit
                certaines pratiques que d&apos;autres s&apos;autorisent — c&apos;est précisément ce qui le distingue.
              </p>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {m.nonCe.map((n) => (
                <li
                  key={n}
                  style={{
                    display: "flex", gap: 14, alignItems: "flex-start",
                    padding: "18px 22px", marginBottom: 10,
                    background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.warn}`,
                    borderRadius: 12, fontSize: 16.5, lineHeight: 1.55,
                  }}
                >
                  <span aria-hidden style={{ color: C.warn, fontWeight: 700 }}>✕</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, letterSpacing: "-0.03em" }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Consultations + agenda ── */}
      <section id="tarifs" className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>{kit.labels.catalogueNote}</div>
            <h2 style={{ ...h2, marginBottom: 24 }}>
              {kit.labels.catalogue} <span style={{ color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
            {v.cats.map((cat) => (
              <div key={cat} style={{ marginBottom: 22 }}>
                <div style={{ ...meta, color: accent, marginBottom: 8 }}>{cat}</div>
                {kit.services.filter((s) => s.cat === cat).map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "baseline", gap: 18, padding: "16px 0", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18 }}>{s.name}</div>
                      <p style={{ margin: "3px 0 0", color: C.inkSoft, fontSize: 14.5, lineHeight: 1.55 }}>{s.desc}</p>
                      {s.refund && <div style={{ ...meta, marginTop: 6, color: accent }}>{s.refund}</div>}
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, whiteSpace: "nowrap" }}>
                      {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <SlotPicker theme={slotTheme} seed={v.seed} title="Prendre rendez-vous" note="Le premier rendez-vous dure une heure. Notez ce que vous mangez pendant trois jours avant de venir, sans rien changer." />
        </div>
      </section>

      {/* ── Le cabinet ── */}
      <section className="sa-pad" style={{ padding: "78px 24px" }}>
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
            <h2 style={{ ...h2, marginBottom: 18 }}>Tenir dans six mois.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.inkSoft, margin: 0 }}>{v.about}</p>
          </div>
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ background: C.panel, padding: "78px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 28 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 32, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ padding: "78px 24px" }}>
        <div className="sa-two" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 24 }}>Le cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 17 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 4 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, color: accent, textDecoration: "none" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "09:00 – 19:00"], ["Samedi", "09:00 – 12:30"], ["Dimanche", "Fermé"], ["Visioconférence", "Créneaux dédiés"]].map(([d, h]) => (
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
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
          Un bilan, un plan qui tient.
        </h2>
        <a className="as-cta" href="#rendez-vous" style={{ display: "inline-block", background: accent, color: "#fff", padding: "17px 36px", borderRadius: 12, fontWeight: 600, fontSize: 18, textDecoration: "none" }}>
          {kit.labels.cta}
        </a>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.panel, color: C.inkSoft, padding: "30px 24px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1140, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
