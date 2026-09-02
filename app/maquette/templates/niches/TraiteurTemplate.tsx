import type { TemplateProps } from "../data";
import { metierLabel } from "../data";
import { kitForMetier } from "../nicheKits";
import {
  DemoBanner,
  NmfCredit,
  OfferBlock,
  SHARED_CSS,
  Stars,
  priceLabel,
  seedOf,
  type OfferTheme,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
 * Traiteur — direction « Le carton ».
 *
 * POURQUOI PAS LA MAQUETTE RESTAURANT, où « traiteur » atterrissait jusqu'ici.
 * Un restaurant vend un couvert ce soir ; un traiteur vend une DATE, six mois à
 * l'avance, pour un événement qui n'a pas lieu chez lui. Le module de
 * réservation du restaurant (couverts / service / heure) ne veut rien dire
 * ici : personne ne réserve un mariage à 20 h 30.
 *
 * CE QUE LA PAGE MONTRE À LA PLACE : les samedis encore libres de la saison.
 * C'est la première question de tout client — « vous êtes libre le 21 juin ? »
 * — et la seule dont la réponse déclenche l'appel dans la minute. Un
 * calendrier qui affiche aussi les dates DÉJÀ PRISES fait deux choses qu'aucun
 * argumentaire ne fait : il prouve que le traiteur travaille, et il met une
 * horloge sur la décision.
 *
 * La DA emprunte au carton d'invitation plutôt qu'au site de restaurant :
 * papier lin, filets doubles, romaine à empattements, capitales interlettrées.
 * Le fond clair est aussi ce qui sépare cette maquette de la Salle du soir
 * dans la planche de contact — deux métiers voisins ne doivent pas se
 * ressembler à la vignette.
 * ────────────────────────────────────────────────────────────── */

const C = {
  bg: "#FAF6F0",
  panel: "#FFFFFF",
  wash: "#F1E8DC",
  ink: "#2A2320",
  inkSoft: "rgba(42,35,32,0.62)",
  line: "rgba(42,35,32,0.14)",
};

const DISPLAY = "'EB Garamond', Garamond, Georgia, serif";
const BODY = "'Mulish', system-ui, sans-serif";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const COVERS = [40, 60, 80, 120];

interface Month {
  key: string;
  label: string;
  year: number;
  days: Array<{ n: number; taken: boolean }>;
}

/**
 * Les samedis des quatre prochains mois, dont ceux déjà réservés.
 *
 * Groupés à partir d'une liste de samedis à venir, et non mois par mois : un
 * mois entamé peut n'en avoir plus aucun, et il ne doit pas s'afficher vide.
 *
 * Les mois proches sont plus pleins que les mois lointains (le seuil descend
 * avec `k`). C'est ce qui rend la rareté crédible : un traiteur dont juillet
 * serait libre et novembre complet ne raconte rien de vrai.
 */
function seasonSaturdays(seed: number): Month[] {
  const out: Month[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1); // jamais une date passée, ni celle du jour
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);

  for (let i = 0; i < 22; i++) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let month = out.find((m) => m.key === key);
    if (!month) {
      if (out.length === 4) break;
      month = { key, label: MONTHS[d.getMonth()], year: d.getFullYear(), days: [] };
      out.push(month);
    }
    const k = out.length - 1;
    month.days.push({ n: d.getDate(), taken: ((seed >> ((i * 3) % 27)) & 7) < 5 - k });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export default function TraiteurTemplate({
  name,
  metier,
  ville,
  phone,
  rating,
  reviews,
  address,
  nmfCredit = false,
}: TemplateProps & { nmfCredit?: boolean }) {
  const kit = kitForMetier(metier);
  const accent = kit.accent;
  const label = metierLabel(metier || "Traiteur");
  const tel = phone.replace(/\s/g, "");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";
  const year = new Date().getFullYear();
  const seed = seedOf(name + cityLabel);
  const avg = rating ?? 4.8;
  const reviewCount = reviews ?? 96;
  const about = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);
  const cats = [...new Set(kit.services.map((s) => s.cat))];

  const season = seasonSaturdays(seed);
  const firstOpen = season.find((m) => m.days.some((d) => !d.taken));
  const openDays = firstOpen ? firstOpen.days.filter((d) => !d.taken) : [];
  const pickedDate = firstOpen && openDays.length
    ? `${openDays[0].n} ${firstOpen.label} ${firstOpen.year}`
    : "Votre date";
  const pickedCovers = COVERS[seed % COVERS.length];

  const theme: OfferTheme = {
    bg: C.wash,
    panel: C.panel,
    ink: C.ink,
    inkSoft: C.inkSoft,
    accent,
    onAccent: C.panel,
    radius: 2,
    border: `1px solid ${C.line}`,
    shadow: "0 1px 2px rgba(42,35,32,0.05)",
    display: DISPLAY,
    meta: BODY,
    metaSpacing: "0.2em",
  };

  const meta: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: C.inkSoft,
  };

  const h2: React.CSSProperties = {
    fontFamily: DISPLAY,
    fontWeight: 400,
    fontSize: 50,
    lineHeight: 1.08,
    margin: 0,
    color: C.ink,
  };

  /* Le filet double du carton d'invitation : un trait d'accent, un trait fin. */
  const rule = (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 54, margin: "0 auto" }} aria-hidden>
      <span style={{ height: 1, background: accent }} />
      <span style={{ height: 1, background: C.line }} />
    </div>
  );

  return (
    <div style={{ fontFamily: BODY, color: C.ink, background: C.bg, margin: 0, overflowX: "clip" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..600&family=Mulish:wght@300;400;600;700&display=swap');
        ${SHARED_CSS}
        .tr-shot img { transition: transform .9s cubic-bezier(.2,.7,.3,1); }
        .tr-shot:hover img { transform: scale(1.04); }
        .tr-day { transition: background .18s ease, color .18s ease, border-color .18s ease; }
        .tr-day.is-free:hover { background: ${accent}; border-color: ${accent}; color: #fff; }
        .tr-chip { transition: background .18s ease, color .18s ease, border-color .18s ease; }
        .tr-chip:hover { border-color: ${accent}; }
        .tr-link { color: ${accent}; text-decoration: none; }
        .tr-link:hover { text-decoration: underline; }
        .tr-drop::first-letter {
          font-family: ${DISPLAY}; font-size: 62px; line-height: .82; float: left;
          margin: 6px 12px 0 0; color: ${accent};
        }
        a:focus-visible, button:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        @media (max-width: 980px) {
          .tr-two { grid-template-columns: 1fr !important; }
          .tr-cal { grid-template-columns: 1fr !important; }
          .tr-menu { grid-template-columns: 1fr !important; }
          .tr-shots { grid-template-columns: 1fr 1fr !important; }
          .tr-h1 { font-size: 48px !important; }
          .tr-h2 { font-size: 34px !important; }
          .tr-nav { display: none !important; }
          .tr-pad { padding: 60px 20px !important; }
          .tr-card { padding: 34px 24px !important; }
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
          background: "rgba(250,246,240,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 24px",
            height: 74,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 26, letterSpacing: "0.01em" }}>{name}</span>
          <nav className="tr-nav" style={{ display: "flex", gap: 30, ...meta, fontWeight: 400 }}>
            <a href="#dates" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Les dates
            </a>
            <a href="#prestations" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Les formules
            </a>
            <a href="#galerie" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Réceptions
            </a>
            <a href="#avis" style={{ color: C.inkSoft, textDecoration: "none" }}>
              Avis
            </a>
          </nav>
          <a
            href="#dates"
            style={{
              border: `1px solid ${accent}`,
              color: accent,
              padding: "11px 22px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {kit.labels.cta}
          </a>
        </div>
      </header>

      {/* ── Hero : le carton posé sur la photo ── */}
      <section style={{ position: "relative", background: C.bg }}>
        <div style={{ position: "relative", height: 560, overflow: "hidden" }}>
          <img
            src={kit.hero}
            alt={`${label} à ${cityLabel}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to bottom, rgba(42,35,32,0.10), ${C.bg})`,
            }}
            aria-hidden
          />
        </div>
        <div
          className="tr-pad"
          style={{ position: "relative", maxWidth: 900, margin: "-200px auto 0", padding: "0 24px 88px", textAlign: "center" }}
        >
          <div
            className="tr-card"
            style={{
              background: C.panel,
              border: `1px solid ${C.line}`,
              boxShadow: "0 18px 50px rgba(42,35,32,0.10)",
              padding: "54px 44px 48px",
            }}
          >
            <div style={{ ...meta, color: accent, marginBottom: 18 }}>
              {label} · {cityLabel}
            </div>
            <h1 className="tr-h1" style={{ ...h2, fontSize: 66, lineHeight: 1 }}>
              {name}
            </h1>
            <div style={{ margin: "26px 0" }}>{rule}</div>
            <p style={{ margin: "0 auto", maxWidth: 540, fontSize: 18, lineHeight: 1.8, color: C.inkSoft }}>
              Des réceptions cuisinées maison, du plateau repas du mardi au repas de noces.
              Dites-nous votre date, on vous dit tout de suite si elle est libre.
            </p>
            <div
              style={{
                marginTop: 32,
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <a
                href="#dates"
                style={{
                  background: accent,
                  color: "#fff",
                  padding: "16px 34px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                {kit.labels.cta}
              </a>
              <span style={{ ...meta, fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Stars value={avg} color={accent} size={13} /> {avg}/5 · {reviewCount} avis
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Le calendrier des dates ── */}
      <section id="dates" className="tr-pad" style={{ background: C.wash, padding: "88px 24px" }}>
        <div
          className="tr-cal"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "0.8fr 1.2fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ ...meta, color: accent, marginBottom: 16 }}>Disponibilités</div>
            <h2 className="tr-h2" style={h2}>
              Les samedis
              <br />
              <span style={{ fontStyle: "italic" }}>encore libres.</span>
            </h2>
            <p style={{ marginTop: 22, color: C.inkSoft, fontSize: 17, lineHeight: 1.8, maxWidth: 380 }}>
              On ne prend qu&apos;une grande réception par samedi — c&apos;est la condition pour que
              la cuisine soit à vous seuls. Ce qui est barré est déjà réservé.
            </p>
            {openDays.length > 0 && firstOpen && (
              <p
                style={{
                  marginTop: 26,
                  padding: "14px 18px",
                  background: C.panel,
                  borderLeft: `3px solid ${accent}`,
                  color: C.ink,
                  fontSize: 15,
                  lineHeight: 1.6,
                  maxWidth: 380,
                }}
              >
                Il reste <strong>{openDays.length}</strong> samedi{openDays.length > 1 ? "s" : ""} en{" "}
                <strong>{firstOpen.label}</strong>.
              </p>
            )}
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 34 }} className="tr-card">
            {season.map((m) => (
              <div
                key={m.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "14px 0",
                  borderBottom: `1px solid ${C.line}`,
                }}
              >
                <div style={{ ...meta, width: 84, flexShrink: 0 }}>{m.label}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {m.days.map((d) => (
                    <span
                      key={d.n}
                      className={`tr-day${d.taken ? "" : " is-free"}`}
                      title={d.taken ? "Déjà réservé" : "Libre"}
                      style={{
                        width: 44,
                        height: 44,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${d.taken ? C.line : accent}`,
                        fontFamily: DISPLAY,
                        fontSize: 19,
                        color: d.taken ? "rgba(42,35,32,0.28)" : accent,
                        textDecoration: d.taken ? "line-through" : "none",
                        cursor: d.taken ? "default" : "pointer",
                      }}
                    >
                      {d.n}
                    </span>
                  ))}
                  {m.days.every((d) => d.taken) && (
                    <span style={{ ...meta, color: "rgba(42,35,32,0.35)", marginLeft: 4 }}>Complet</span>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 20, ...meta, fontWeight: 400, padding: "16px 0 22px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 10, height: 10, border: `1px solid ${accent}` }} aria-hidden /> Libre
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 10, height: 10, border: `1px solid ${C.line}`, background: C.wash }} aria-hidden />{" "}
                Déjà réservé
              </span>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 22 }}>
              <div style={{ ...meta, marginBottom: 14 }}>Votre réception</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                <span
                  className="tr-chip"
                  style={{
                    flex: "1 1 190px",
                    padding: "14px 16px",
                    border: `1px solid ${accent}`,
                    color: accent,
                    fontFamily: DISPLAY,
                    fontSize: 19,
                    cursor: "pointer",
                  }}
                >
                  {pickedDate}
                </span>
                {COVERS.map((n) => (
                  <span
                    key={n}
                    className="tr-chip"
                    style={{
                      padding: "14px 16px",
                      border: `1px solid ${n === pickedCovers ? accent : C.line}`,
                      background: n === pickedCovers ? accent : "transparent",
                      color: n === pickedCovers ? "#fff" : C.inkSoft,
                      fontFamily: DISPLAY,
                      fontSize: 19,
                      cursor: "pointer",
                    }}
                  >
                    {n}
                  </span>
                ))}
              </div>
              <a
                href={`tel:${tel}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  background: accent,
                  color: "#fff",
                  padding: "16px 0",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Bloquer cette date
              </a>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: C.inkSoft,
                  textAlign: "center",
                }}
              >
                Sans engagement — la date est posée 8 jours, le temps de la dégustation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Les formules ── */}
      <section id="prestations" className="tr-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 className="tr-h2" style={h2}>
              {kit.labels.catalogue}{" "}
              <span style={{ fontStyle: "italic", color: accent }}>{kit.labels.catalogueSub}</span>
            </h2>
          </div>
          <div style={{ marginBottom: 22 }}>{rule}</div>
          <p
            style={{
              textAlign: "center",
              color: C.inkSoft,
              fontSize: 15,
              lineHeight: 1.7,
              maxWidth: 560,
              margin: "0 auto 56px",
            }}
          >
            {kit.labels.catalogueNote}
          </p>

          <div className="tr-menu" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 64px" }}>
            {cats.map((cat) => (
              <div key={cat} style={{ breakInside: "avoid", marginBottom: 44 }}>
                <div style={{ ...meta, color: accent, marginBottom: 10, textAlign: "center" }}>{cat}</div>
                <div style={{ marginBottom: 26 }}>{rule}</div>
                {kit.services
                  .filter((s) => s.cat === cat)
                  .map((s) => (
                    <div key={s.name} style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: DISPLAY, fontSize: 23 }}>{s.name}</span>
                        <span
                          style={{
                            flex: 1,
                            borderBottom: `1px dotted ${C.line}`,
                            transform: "translateY(-4px)",
                            minWidth: 16,
                          }}
                          aria-hidden
                        />
                        <span style={{ fontFamily: DISPLAY, fontSize: 23, color: accent, whiteSpace: "nowrap" }}>
                          {priceLabel(s.price, s.from)}
                          {s.unit && (
                            <span
                              style={{ fontFamily: BODY, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginLeft: 4 }}
                            >
                              {s.unit}
                            </span>
                          )}
                        </span>
                      </div>
                      <p style={{ margin: "5px 0 0", color: C.inkSoft, fontSize: 14.5, lineHeight: 1.65 }}>{s.desc}</p>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Nos réceptions ── */}
      <section id="galerie" className="tr-pad" style={{ background: C.wash, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div
            className="tr-two"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center", marginBottom: 56 }}
          >
            <figure className="tr-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "4/3" }}>
              <img src={kit.about} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
            <div>
              <div style={{ ...meta, color: accent, marginBottom: 16 }}>La maison</div>
              <h2 className="tr-h2" style={{ ...h2, marginBottom: 22 }}>
                {kit.labels.gallery} <span style={{ fontStyle: "italic" }}>{kit.labels.gallerySub}</span>
              </h2>
              <p className="tr-drop" style={{ fontSize: 17.5, lineHeight: 1.85, color: C.inkSoft, margin: 0 }}>
                {about}
              </p>
            </div>
          </div>
          <div className="tr-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {kit.gallery.map((src, i) => (
              <figure key={src} className="tr-shot" style={{ margin: 0, overflow: "hidden", aspectRatio: "1" }}>
                <img
                  src={src}
                  alt={`Réception ${i + 1}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avis ── */}
      <section id="avis" className="tr-pad" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 className="tr-h2" style={h2}>
              Ce qu&apos;on en <span style={{ fontStyle: "italic", color: accent }}>dit</span>.
            </h2>
          </div>
          <div style={{ marginBottom: 18 }}>{rule}</div>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ ...meta, fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Stars value={avg} color={accent} size={14} /> {avg}/5 · {reviewCount} avis
            </span>
          </div>
          <div className="tr-shots" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {kit.testimonials.map((t) => (
              <blockquote
                key={t.author}
                style={{
                  margin: 0,
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <Stars value={t.rating} color={accent} size={13} />
                <p style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: 20, lineHeight: 1.6, margin: 0, flex: 1 }}>
                  « {t.comment} »
                </p>
                <footer style={{ ...meta, fontWeight: 400, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: accent }}>{t.author}</span>
                  <span>{t.date}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── Le laboratoire & la zone ── */}
      <section id="contact" className="tr-pad" style={{ background: C.wash, padding: "88px 24px" }}>
        <div
          className="tr-two"
          style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}
        >
          <div>
            <h2 className="tr-h2" style={h2}>
              Le <span style={{ fontStyle: "italic", color: accent }}>laboratoire</span>.
            </h2>
            <div style={{ marginTop: 28, fontSize: 17.5, lineHeight: 1.9, color: C.inkSoft }}>
              {address || "Centre-ville"}
              <br />
              {cityLabel}, France
              <br />
              <a className="tr-link" href={`tel:${tel}`}>
                {phone || "—"}
              </a>
            </div>
            <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.75, color: C.inkSoft, maxWidth: 380 }}>
              Nous livrons et installons dans un rayon de 60 km autour de {cityLabel}. Au-delà,
              dites-nous où : on se déplace pour les grandes tablées.
            </p>
          </div>
          <div>
            <div style={{ ...meta, marginBottom: 12 }}>Prise de commande</div>
            {[
              ["Lundi", "Fermé"],
              ["Mardi — vendredi", "09:00 – 18:00"],
              ["Samedi", "En réception — laissez un message"],
              ["Dimanche", "Fermé"],
            ].map(([d, h]) => (
              <div
                key={d}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "16px 0",
                  borderBottom: `1px solid ${C.line}`,
                  fontSize: 15,
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontSize: 20 }}>{d}</span>
                <span style={{ color: h === "Fermé" ? "rgba(42,35,32,0.3)" : C.inkSoft, textAlign: "right" }}>{h}</span>
              </div>
            ))}
            <p style={{ marginTop: 22, fontSize: 15, lineHeight: 1.75, color: C.inkSoft }}>
              Les devis partent sous 24 h. Pour un mariage, comptez une dégustation avant signature —
              elle est offerte.
            </p>
          </div>
        </div>
      </section>

      {nmfCredit && <OfferBlock theme={theme} kit={kit} label={label} ville={cityLabel} />}

      <footer style={{ background: C.bg, color: C.inkSoft, padding: "36px 24px", borderTop: `1px solid ${C.line}` }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            ...meta,
            fontWeight: 400,
          }}
        >
          <span>
            © {year} {name}
          </span>
          <span>
            {cityLabel}, France{phone ? ` · ${phone}` : ""}
          </span>
        </div>
      </footer>

      {nmfCredit && <NmfCredit />}
    </div>
  );
}
