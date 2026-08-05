import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Psychologue — direction « Le cadre ».
 *
 * Ce qui empêche de prendre le premier rendez-vous, ce n'est pas le prix :
 * c'est de ne pas savoir ce qui va se passer pendant cinquante minutes. La page
 * ne vend donc rien — elle décrit la première séance minute par minute, puis
 * pose le cadre : durée, tarif, rythme, secret professionnel.
 *
 * DA : le cadre au sens propre. Un filet fin encadre la page, le contenu est
 * étroit et très aéré, la palette est sourde (grège froid, bleu ardoise). Un
 * cadran de cinquante minutes en SVG tient lieu d'accroche. Aucun visuel
 * chaleureux forcé, aucune main tendue sur fond de coucher de soleil : la
 * sobriété est ici le message.
 *
 * Aucun témoignage : déontologie, et sur ce métier plus qu'ailleurs.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#EBEAE6",
  panel: "#F7F6F3",
  ink: "#23252A",
  inkSoft: "rgba(35,37,42,0.62)",
  line: "rgba(35,37,42,0.16)",
};

const DISPLAY = "'Literata', Georgia, serif";
const BODY = "'Lexend', system-ui, sans-serif";

/** Cadran des cinquante minutes : la durée, rendue visible. */
function CadranSeance({ accent }: { accent: string }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const part = (50 / 60) * c;
  return (
    <svg viewBox="0 0 200 200" width="100%" role="img" aria-label="Durée d'une séance : cinquante minutes">
      <circle cx="100" cy="100" r={r} fill="none" stroke={C.line} strokeWidth="14" />
      <circle
        cx="100" cy="100" r={r} fill="none" stroke={accent} strokeWidth="14" strokeLinecap="butt"
        strokeDasharray={`${part} ${c - part}`} transform="rotate(-90 100 100)"
      />
      <text x="100" y="96" textAnchor="middle" fill={C.ink} fontFamily={DISPLAY} fontSize="40">50</text>
      <text x="100" y="122" textAnchor="middle" fill={C.inkSoft} fontFamily={BODY} fontSize="12" letterSpacing="3">
        MINUTES
      </text>
    </svg>
  );
}

export default function CadreTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "seance", "psychologue");
  const kit = v.kit;
  const accent = kit.accent;
  const m = v.module;

  const theme: OfferTheme = {
    bg: C.bg, panel: C.panel, ink: C.ink, inkSoft: C.inkSoft, accent,
    onAccent: "#fff", radius: 2, border: `1px solid ${C.line}`, shadow: "none",
    display: DISPLAY, meta: BODY, metaSpacing: "0.2em",
  };

  const slotTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.2em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line,
    accent, onAccent: "#fff", panel: C.panel, radius: 2,
  };

  const portraitTheme = {
    display: DISPLAY, meta: BODY, metaSpacing: "0.2em",
    ink: C.ink, inkSoft: C.inkSoft, line: C.line, accent, panel: C.panel, radius: 2,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY, fontSize: 10, fontWeight: 500,
    textTransform: "uppercase", letterSpacing: "0.2em", color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 400, fontSize: 36, lineHeight: 1.2,
    letterSpacing: "-0.01em", margin: 0, color: C.ink,
  };

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,300..600&family=Lexend:wght@300;400;500&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .cd-temps { transition: border-color .2s ease; }
        .cd-temps:hover { border-color: ${accent}; }
        .cd-cta { transition: filter .15s ease; }
        .cd-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .cd-h1 { font-size: 38px !important; }
          .cd-hero { grid-template-columns: 1fr !important; }
          .cd-frame { padding: 20px !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      {/* Le filet qui encadre toute la page — la DA, littéralement */}
      <div className="cd-frame" style={{ padding: "28px 28px 0" }}>
        <div style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <header style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="sa-pad" style={{ maxWidth: 1000, margin: "0 auto", padding: "0 32px", height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 22 }}>{name}</span>
              <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
                <a href="#seance" style={{ color: C.inkSoft, textDecoration: "none" }}>La séance</a>
                <a href="#cadre" style={{ color: C.inkSoft, textDecoration: "none" }}>Le cadre</a>
                <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
                <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
              </nav>
              <a className="cd-cta" href="#rendez-vous" style={{ background: accent, color: "#fff", padding: "11px 20px", fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
                {kit.labels.cta}
              </a>
            </div>
          </header>

          {/* ── Hero ── */}
          <section className="sa-pad" style={{ padding: "70px 32px 66px" }}>
            <div className="cd-hero" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 56, alignItems: "center" }}>
              <div>
                <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <span style={{ color: accent }}>{v.label}</span>
                  <span style={{ width: 18, height: 1, background: C.line }} />
                  <span>{v.cityLabel}</span>
                </div>
                <h1 className="cd-h1" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 48, lineHeight: 1.14, letterSpacing: "-0.02em", margin: 0 }}>
                  {kit.promise.lead}
                  <br />
                  <span style={{ color: accent }}>{kit.promise.strong}</span>
                </h1>
                <p style={{ marginTop: 22, fontSize: 17, lineHeight: 1.85, color: C.inkSoft, maxWidth: 440 }}>{kit.promise.sub}</p>
                <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                  <a className="cd-cta" href="#seance" style={{ background: C.ink, color: C.panel, padding: "15px 26px", fontSize: 15, textDecoration: "none" }}>
                    Ce qui se passe en séance
                  </a>
                  {phone && (
                    <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, color: C.ink, padding: "15px 26px", fontSize: 15, textDecoration: "none" }}>
                      {phone}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ padding: "0 10px" }}>
                <CadranSeance accent={accent} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── La première séance ── */}
      <section id="seance" className="sa-pad" style={{ padding: "76px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ maxWidth: 560, marginBottom: 36 }}>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>La première séance</div>
            <h2 style={h2}>Quatre temps, et rien d&apos;obligatoire.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {m.deroule.map((d, i) => (
              <div key={d.titre} className="cd-temps" style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 24, padding: "26px 0", borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 26, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 22, marginBottom: 8 }}>{d.titre}</div>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.75, color: C.inkSoft, maxWidth: 620 }}>{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Le cadre ── */}
      <section id="cadre" className="sa-pad" style={{ background: C.panel, padding: "76px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ maxWidth: 560, marginBottom: 32 }}>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>Le cadre</div>
            <h2 style={h2}>Ce à quoi vous vous engagez.</h2>
          </div>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.line, border: `1px solid ${C.line}` }}>
            {m.cadre.map((c) => (
              <div key={c.k} style={{ background: C.panel, padding: "26px 24px" }}>
                <div style={{ ...meta, marginBottom: 10 }}>{c.k}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 19, lineHeight: 1.4 }}>{c.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 34, flexWrap: "wrap", marginTop: 36 }}>
            {kit.facts.map((f) => (
              <div key={f.k} style={{ maxWidth: 220 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 26, color: accent }}>{f.k}</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: C.inkSoft, marginTop: 4 }}>{f.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prendre rendez-vous ── */}
      <section className="sa-pad" style={{ padding: "76px 32px" }}>
        <div className="sa-two" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "start" }}>
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 14 }}>Le cabinet</div>
            <h2 style={{ ...h2, marginBottom: 20 }}>Un lieu, et du temps.</h2>
            <AboutVisual
              about={kit.about}
              portrait={kit.portrait}
              alt={`Cabinet de ${name} à ${v.cityLabel}`}
              name={name}
              role={v.label}
              theme={portraitTheme}
              ratio="3/2"
            />
            <p style={{ fontSize: 16.5, lineHeight: 1.85, color: C.inkSoft, margin: "28px 0 0" }}>{v.about}</p>
          </div>
          <SlotPicker theme={slotTheme} seed={v.seed} title="Prendre rendez-vous" note="Annulation possible jusqu'à 24 h avant, sans frais. Les séances en visioconférence sont au même tarif." />
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="tarifs" className="sa-pad" style={{ background: C.panel, padding: "76px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 30, maxWidth: 600 }}>
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
                    <div style={{ fontFamily: DISPLAY, fontSize: 20 }}>{s.name}</div>
                    <p style={{ margin: "4px 0 0", color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
                    {s.refund && <div style={{ ...meta, marginTop: 8, color: accent }}>{s.refund}</div>}
                  </div>
                  <span style={{ fontFamily: DISPLAY, fontSize: 22, whiteSpace: "nowrap" }}>
                    {santePrice(s.price, s.from, s.unit, s.priceLabel)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Infos + FAQ ── */}
      <section className="sa-pad" style={{ padding: "76px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: 26 }}>Informations pratiques</h2>
          <div className="sa-four" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {kit.infos.map((i) => (
              <div key={i.k} style={{ border: `1px solid ${C.line}`, padding: "20px 22px", background: C.panel }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6 }}>{i.v}</div>
              </div>
            ))}
          </div>
          <h2 style={{ ...h2, fontSize: 28, margin: "44px 0 18px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ border: `1px solid ${C.line}`, padding: "20px 24px", background: C.panel }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 18, marginBottom: 8 }}>{f.q}</div>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75, color: C.inkSoft }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="sa-pad" style={{ background: C.panel, padding: "76px 32px" }}>
        <div className="sa-two" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
          <div>
            <h2 style={{ ...h2, marginBottom: 22 }}>Le cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Adresse</div>
                <div style={{ fontSize: 16.5 }}>{address || "Centre-ville"}, {v.cityLabel}</div>
              </div>
              <div>
                <div style={{ ...meta, marginBottom: 6 }}>Téléphone</div>
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 26, color: accent, textDecoration: "none" }}>{phone || "—"}</a>
              </div>
            </div>
          </div>
          <div style={{ border: `1px solid ${C.line}`, padding: 28, background: C.bg }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[["Lundi — vendredi", "09:00 – 20:00"], ["Samedi", "09:00 – 13:00"], ["Dimanche", "Fermé"], ["Visioconférence", "Créneaux dédiés"]].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 0", borderTop: `1px solid ${C.line}`, fontSize: 15.5 }}>
                <span>{d}</span>
                <span style={{ color: h === "Fermé" ? C.inkSoft : C.ink }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={v.label} ville={v.cityLabel} />}

      <footer style={{ background: C.bg, color: C.inkSoft, padding: "30px 32px", borderTop: `1px solid ${C.line}` }}>
        <div className="sa-pad" style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, ...meta }}>
          <span>© {v.year} {name}</span>
          <span>{v.cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
