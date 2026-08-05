import type { TemplateProps } from "../data";
import { DemoBanner, NmfCredit, OfferBlock, type OfferTheme } from "../niches/shared";
import { AboutVisual } from "../portrait";
import { SANTE_CSS, SlotPicker, santePrice, santeView } from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Orthophoniste — direction « La bulle ».
 *
 * L'orthophoniste n'a aucun problème de demande : il a un problème de tri. Les
 * familles appellent sans savoir si le trouble le concerne, et il passe ses
 * journées à orienter au téléphone. La page trie à sa place : quatre groupes
 * d'âge, et sous chacun les troubles réellement pris en charge. Le délai
 * d'attente est annoncé au lieu d'être esquivé — c'est la question suivante.
 *
 * DA : la bulle de parole, puisque c'est de parole qu'il s'agit. Chaque groupe
 * d'âge est une bulle dont la queue pointe vers son étiquette, sur un fond crème
 * chaud. Gloock, un serif à empattements très épais, donne à l'ensemble une
 * bonhomie qui convient à un cabinet où viennent surtout des enfants — loin du
 * bleu hospitalier employé par tous les sites de santé.
 *
 * Aucun témoignage : déontologie des professions de santé.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FFFAF2",
  panel: "#FFFFFF",
  ink: "#2A2320",
  inkSoft: "rgba(42,35,32,0.62)",
  line: "rgba(42,35,32,0.14)",
  sky: "#4E8FA8",
};

const DISPLAY = "'Gloock', Georgia, serif";
const BODY = "'Rubik', system-ui, sans-serif";

export default function BulleTemplate({
  nmfCredit = false,
  ...p
}: TemplateProps & { nmfCredit?: boolean }) {
  const { name, phone, address } = p;
  const v = santeView(p, "ages", "orthophoniste");
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
    radius: 20,
    border: `1px solid ${C.line}`,
    shadow: "0 18px 40px -32px rgba(42,35,32,0.4)",
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
    radius: 18,
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
    radius: 999,
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 400,
    fontSize: 42,
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
    margin: 0,
    color: C.ink,
  };

  // La queue de bulle change de côté d'un groupe à l'autre : c'est ce qui fait
  // lire la grille comme une conversation plutôt que comme un tableau.
  const tails = ["18px", "auto", "18px", "auto"];

  return (
    <div style={{ fontFamily: BODY, background: C.bg, color: C.ink, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Gloock&family=Rubik:wght@400;500;600&display=swap');
        ${SANTE_CSS}
        .sa-slot:not(.is-taken):hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .bu-bulle { position: relative; transition: transform .18s ease; }
        .bu-bulle:hover { transform: translateY(-4px); }
        .bu-bulle::after {
          content: ""; position: absolute; bottom: -13px; width: 26px; height: 14px;
          background: ${C.panel}; border-right: 1px solid ${C.line}; border-bottom: 1px solid ${C.line};
          transform: skewX(-20deg);
        }
        .bu-cta { transition: filter .15s ease; }
        .bu-cta:hover { filter: brightness(1.08); }
        a:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .bu-h1 { font-size: 46px !important; }
          .bu-hero { grid-template-columns: 1fr !important; }
          .bu-groupes { grid-template-columns: 1fr !important; }
        }
      `,
        }}
      />

      {nmfCredit && <DemoBanner theme={theme} />}

      <header style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
        <div
          className="sa-pad"
          style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 78, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 26 }}>{name}</span>
          <nav className="sa-nav" style={{ display: "flex", gap: 26, ...meta }}>
            <a href="#ages" style={{ color: C.inkSoft, textDecoration: "none" }}>Ce qui se travaille</a>
            <a href="#tarifs" style={{ color: C.inkSoft, textDecoration: "none" }}>Tarifs</a>
            <a href="#infos" style={{ color: C.inkSoft, textDecoration: "none" }}>Infos</a>
            <a href="#contact" style={{ color: C.inkSoft, textDecoration: "none" }}>Contact</a>
          </nav>
          <a
            className="bu-cta"
            href="#rendez-vous"
            style={{ background: accent, color: "#fff", padding: "12px 22px", borderRadius: 999, fontWeight: 500, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sa-pad" style={{ padding: "64px 24px 70px" }}>
        <div className="bu-hero" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 52, alignItems: "center" }}>
          <div>
            <div style={{ ...meta, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: accent }}>{v.label}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>{v.cityLabel}</span>
              <span style={{ width: 20, height: 1, background: C.line }} />
              <span>Sur prescription</span>
            </div>

            <h1 className="bu-h1" style={{ fontFamily: DISPLAY, fontSize: 58, lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
              {kit.promise.lead}
              <br />
              <span style={{ color: accent }}>{kit.promise.strong}</span>
            </h1>

            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.75, color: C.inkSoft, maxWidth: 460 }}>{kit.promise.sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <a className="bu-cta" href="#ages" style={{ background: C.ink, color: C.panel, padding: "16px 28px", borderRadius: 999, fontWeight: 500, fontSize: 16, textDecoration: "none" }}>
                Voir par âge
              </a>
              {phone && (
                <a href={`tel:${v.tel}`} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "16px 28px", borderRadius: 999, fontWeight: 500, fontSize: 16, textDecoration: "none" }}>
                  {phone}
                </a>
              )}
            </div>

            <div
              style={{
                marginTop: 28,
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 18,
                padding: "18px 22px",
                maxWidth: 480,
              }}
            >
              <div style={{ ...meta, color: accent, marginBottom: 6 }}>Délai d&apos;attente</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.inkSoft }}>{m.attente}</p>
            </div>
          </div>

          <SlotPicker
            theme={slotTheme}
            seed={v.seed}
            title="Prendre rendez-vous"
            note="Le premier rendez-vous est un bilan. Apportez la prescription et, pour un enfant, son carnet de santé."
          />
        </div>
      </section>

      {/* ── Les groupes d'âge ── */}
      <section id="ages" className="sa-pad" style={{ background: C.panel, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ maxWidth: 640, marginBottom: 42 }}>
            <div style={{ ...meta, color: accent, marginBottom: 12 }}>Ce qui est pris en charge</div>
            <h2 style={h2}>Quatre âges, quatre demandes.</h2>
          </div>

          <div className="bu-groupes" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "34px 24px" }}>
            {m.groupes.map((g, i) => (
              <div key={g.age} style={{ display: "flex", flexDirection: "column" }}>
                <div
                  className="bu-bulle"
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    borderRadius: 22,
                    padding: "26px 28px",
                    boxShadow: theme.shadow,
                    ...(i % 2 === 0 ? { ["--tail" as string]: tails[i] } : {}),
                  }}
                >
                  <div style={{ fontFamily: DISPLAY, fontSize: 24, marginBottom: 14, color: accent }}>{g.age}</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {g.troubles.map((t) => (
                      <li key={t} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: `1px solid ${C.line}`, fontSize: 16, lineHeight: 1.5 }}>
                        <span aria-hidden style={{ color: C.sky }}>•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <span style={{ ...meta, marginTop: 22, marginLeft: 8, color: C.inkSoft }}>
                  Groupe {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trois chiffres ── */}
      <section style={{ background: accent, color: "#fff", padding: "32px 24px" }}>
        <div className="sa-three sa-pad" style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {kit.facts.map((f) => (
            <div key={f.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 34, lineHeight: 1 }}>{f.k}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.94 }}>{f.v}</span>
            </div>
          ))}
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
            <h2 style={{ ...h2, marginBottom: 18 }}>Un bilan avant toute rééducation.</h2>
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
              <div key={i.k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "20px 22px" }}>
                <div style={{ ...meta, marginBottom: 8 }}>{i.k}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55 }}>{i.v}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...h2, fontSize: 32, margin: "44px 0 20px" }}>Questions fréquentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {kit.faq.map((f) => (
              <div key={f.q} className="sa-faq" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "20px 24px" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 19, marginBottom: 8 }}>{f.q}</div>
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
                <a href={`tel:${v.tel}`} style={{ fontFamily: DISPLAY, fontSize: 30, color: accent, textDecoration: "none" }}>
                  {phone || "—"}
                </a>
              </div>
            </div>
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 18, padding: 28 }}>
            <div style={{ ...meta, marginBottom: 16 }}>Horaires</div>
            {[
              ["Lundi — vendredi", "09:00 – 19:00"],
              ["Mercredi", "09:00 – 18:00"],
              ["Samedi", "Sur rendez-vous"],
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
        <h2 style={{ fontFamily: DISPLAY, fontSize: 44, lineHeight: 1.08, margin: "0 0 20px" }}>
          Un bilan, et on sait quoi travailler.
        </h2>
        <a
          className="bu-cta"
          href="#rendez-vous"
          style={{ display: "inline-block", background: accent, color: "#fff", padding: "17px 36px", borderRadius: 999, fontWeight: 500, fontSize: 18, textDecoration: "none" }}
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
