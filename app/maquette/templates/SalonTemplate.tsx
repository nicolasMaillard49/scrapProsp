import type { TemplateProps } from "./data";
import { metierLabel } from "./data";
import { kitForMetier } from "./nicheKits";

/* ──────────────────────────────────────────────────────────────
 * Salon — template éditorial "Atelier" (paper / ink + accent niche).
 * Port React du front booking-pro, rendu data-driven par niche
 * (coiffure / restauration / beauté…) via kitForMetier(metier).
 * Vitrine seule (pas de tunnel) : les CTA appellent ou pointent #contact.
 * Self-contained (inline styles + 1 bloc <style>). Composant serveur.
 * ────────────────────────────────────────────────────────────── */

const C = {
  paper: "#F3EEE4",
  canvas: "#FBF8F1",
  ink: "#1B1A17",
  inkSoft: "rgba(27,26,23,0.65)",
};

const SHADOW = "6px 6px 0 #1B1A17";

const labelMeta: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.22em",
  color: C.inkSoft,
};

function Stars({ value, color, stroke = C.ink, size = 14 }: { value: number; color: string; stroke?: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? color : "none"} stroke={stroke} strokeWidth={1.5}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function SalonTemplate({
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
  const accentDark = kit.accentDark;
  const label = metierLabel(metier || "Coiffeur");
  const tel = phone.replace(/\s/g, "");
  const year = new Date().getFullYear();
  const estYear = year - 8;
  const todayIdx = (new Date().getDay() + 6) % 7; // lundi=0
  const testimonials = kit.testimonials;
  const avg = rating ?? Math.round((testimonials.reduce((a, t) => a + t.rating, 0) / testimonials.length) * 10) / 10;
  const reviewCount = reviews ?? testimonials.length;
  const words = name.trim().split(/\s+/);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cityLabel = ville && ville.trim() ? ville : "votre ville";

  const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const HOURS = ["09:00 – 19:00", "09:00 – 19:00", "09:00 – 19:00", "09:00 – 20:00", "09:00 – 18:00", "Fermé", "Fermé"];
  const OPEN = [false, true, true, true, true, false, false];

  const aboutFull = kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", name);
  const aboutDrop = aboutFull.charAt(0);
  const aboutRest = aboutFull.slice(1);

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: C.ink, background: C.paper, margin: 0, overflowX: "clip" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&display=swap');
        .fr { font-family: 'Fraunces', Georgia, serif; }
        .salon-link { position: relative; text-decoration: none; color: inherit; }
        .salon-link::after { content: ''; position: absolute; left: 0; bottom: -2px; height: 1px; width: 0; background: ${accent}; transition: width .3s; }
        .salon-link:hover::after { width: 100%; }
        .gcard, .scard { transition: transform .25s ease, box-shadow .25s ease; }
        .gcard:hover { transform: translateY(-4px); }
        .gcard img, .scard img { transition: transform .5s ease; }
        .gcard:hover img, .scard:hover img { transform: scale(1.05); }
        @keyframes ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        .ticker-track { animation: ticker 28s linear infinite; }
        @media (max-width: 860px) {
          .grid12 { grid-template-columns: 1fr !important; }
          .hero-h1 { font-size: 56px !important; }
          .sec-pad { padding: 64px 20px !important; }
          .h2 { font-size: 34px !important; }
          .nav-menu { display: none !important; }
          .sgrid { grid-template-columns: 1fr !important; }
          .ggrid { grid-template-columns: 1fr 1fr !important; }
          .span-hero-img { display: none !important; }
        }
      `}} />

      {nmfCredit && (
        <div style={{ background: C.ink, color: "rgba(255,255,255,0.88)", textAlign: "center", padding: "11px 24px", fontFamily: "'Space Mono', monospace", fontSize: 13, lineHeight: 1.5 }}>
          ✨ Démo gratuite — ce site est{" "}
          <strong style={{ color: "#E8916F" }}>entièrement modifiable à votre demande</strong>{" "}
          (textes, photos, couleurs). Dites-nous ce qu&apos;on change.
        </div>
      )}

      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(243,238,228,0.9)", backdropFilter: "blur(10px)", borderBottom: `2px solid ${C.ink}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <span style={labelMeta}>Est. {estYear}</span>
            <span style={{ height: 16, width: 1, background: "rgba(27,26,23,0.3)" }} />
            <span className="fr" style={{ fontSize: 19, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
              {name}
            </span>
          </div>
          <nav className="nav-menu" style={{ display: "flex", alignItems: "center", gap: 30, ...labelMeta }}>
            <a className="salon-link" href="#prestations">Prestations</a>
            <a className="salon-link" href="#galerie">Galerie</a>
            <a className="salon-link" href="#avis">Avis</a>
            <a className="salon-link" href="#contact">Contact</a>
          </nav>
          <a href={`tel:${tel}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.ink, color: C.canvas, padding: "10px 18px", fontSize: 14, fontWeight: 500, border: `2px solid ${C.ink}`, textDecoration: "none", whiteSpace: "nowrap" }}>
            {kit.labels.cta} →
          </a>
        </div>
      </header>

      {/* Ticker */}
      <div style={{ background: C.ink, color: "rgba(251,248,241,0.6)", borderBottom: `2px solid ${C.ink}`, overflow: "hidden" }}>
        <div className="ticker-track" style={{ display: "flex", gap: 32, padding: "8px 0", ...labelMeta, color: "rgba(251,248,241,0.6)", whiteSpace: "nowrap", width: "max-content" }}>
          {[0, 1].map((n) => (
            <span key={n} style={{ display: "inline-flex", gap: 32 }}>
              <span>{cityLabel}, France</span><span style={{ opacity: 0.4 }}>◆</span>
              {kit.ticker.map((t, i) => (
                <span key={i} style={{ display: "inline-flex", gap: 32 }}>{t}<span style={{ opacity: 0.4 }}>◆</span></span>
              ))}
              <span>{label}</span><span style={{ opacity: 0.4 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section style={{ position: "relative", borderBottom: `2px solid ${C.ink}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, bottom: -60, fontSize: 360, lineHeight: 1, fontWeight: 600, color: `${accent}10`, pointerEvents: "none" }} className="fr" aria-hidden>01</div>
        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "80px 24px 110px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 48 }}>
            <span style={{ ...labelMeta, textTransform: "capitalize" }}>{label}</span>
            <span style={{ height: 1, width: 32, background: "rgba(27,26,23,0.4)" }} />
            <span style={labelMeta}>{cityLabel}</span>
          </div>
          <div className="grid12" style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 56, alignItems: "end" }}>
            <h1 className="fr hero-h1" style={{ fontSize: 92, lineHeight: 0.95, margin: 0, maxWidth: "14ch" }}>
              <span style={{ fontStyle: "italic", fontWeight: 300 }}>{words[0]}</span>
              {words.length > 1 ? (
                <>
                  <br />
                  <span style={{ fontWeight: 500 }}>{words.slice(1).join(" ")}<span style={{ color: accent }}>.</span></span>
                </>
              ) : (
                <span style={{ color: accent }}>.</span>
              )}
            </h1>
            <figure className="span-hero-img" style={{ margin: 0 }}>
              <div style={{ position: "relative", aspectRatio: "4/5", border: `2px solid ${C.ink}`, background: C.canvas, boxShadow: SHADOW, overflow: "hidden" }}>
                <img src={kit.hero} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </figure>
          </div>

          <div style={{ marginTop: 64, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }}>
            <a href={`tel:${tel}`} style={{ display: "inline-flex", alignItems: "center", gap: 12, background: C.ink, color: C.canvas, padding: "18px 36px", fontSize: 18, fontWeight: 500, border: `2px solid ${C.ink}`, boxShadow: SHADOW, textDecoration: "none" }}>
              {kit.labels.cta} →
            </a>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, ...labelMeta }}>
              <Stars value={avg} color={accent} />
              <span style={{ color: C.ink }}>{avg}/5</span>
              <span style={{ opacity: 0.5 }}>· {reviewCount} avis</span>
            </div>
          </div>
        </div>
        <div style={{ height: 12, background: `repeating-linear-gradient(45deg, ${C.ink} 0 10px, transparent 10px 20px)`, opacity: 0.8 }} aria-hidden />
      </section>

      {/* À propos (inversé) */}
      <section style={{ position: "relative", background: C.ink, color: C.canvas, borderBottom: `2px solid ${C.ink}`, overflow: "hidden" }}>
        <div className="fr" style={{ position: "absolute", left: -20, bottom: -40, fontSize: 420, lineHeight: 1, fontStyle: "italic", fontWeight: 300, color: "rgba(251,248,241,0.05)", pointerEvents: "none" }} aria-hidden>&amp;</div>
        <div className="grid12 sec-pad" style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "112px 24px", display: "grid", gridTemplateColumns: "4fr 7fr", gap: 56 }}>
          <div>
            <div style={{ ...labelMeta, color: accent, marginBottom: 16 }}>§ 02 — Présentation</div>
            <h2 className="fr h2" style={{ fontSize: 48, lineHeight: 0.95, margin: 0, fontWeight: 500 }}>
              À propos<br /><span style={{ fontStyle: "italic", fontWeight: 300 }}>de la maison<span style={{ color: accent }}>.</span></span>
            </h2>
            <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid rgba(251,248,241,0.2)", display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ ...labelMeta, color: "rgba(251,248,241,0.5)", marginBottom: 4 }}>Fondé en</div>
                <div className="fr" style={{ fontSize: 30, fontWeight: 500 }}>{estYear}</div>
              </div>
              <div>
                <div style={{ ...labelMeta, color: "rgba(251,248,241,0.5)", marginBottom: 4 }}>Localisation</div>
                <div className="fr" style={{ fontSize: 20 }}>{cityLabel}, France</div>
              </div>
            </div>
          </div>
          <div>
            <figure style={{ margin: "0 0 40px", border: "2px solid rgba(251,248,241,0.3)", aspectRatio: "4/3", overflow: "hidden" }}>
              <img src={kit.about} alt={`${label} à ${cityLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </figure>
            <p className="fr" style={{ fontSize: 23, lineHeight: 1.5, color: "rgba(251,248,241,0.9)", margin: 0 }}>
              <span style={{ fontStyle: "italic", color: accent, fontSize: 64, float: "left", lineHeight: 0.8, marginRight: 12, fontWeight: 500 }}>{aboutDrop}</span>
              {aboutRest}
            </p>
          </div>
        </div>
      </section>

      {/* Prestations */}
      <section id="prestations" className="sec-pad" style={{ background: C.canvas, borderBottom: `2px solid ${C.ink}`, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 56 }}>
            <div>
              <div style={{ ...labelMeta, marginBottom: 16 }}>§ 03 — Prestations</div>
              <h2 className="fr h2" style={{ fontSize: 56, lineHeight: 0.95, margin: 0, fontWeight: 500 }}>
                {kit.labels.catalogue}<br /><span style={{ fontStyle: "italic", fontWeight: 300 }}>{kit.labels.catalogueSub}<span style={{ color: accent }}>.</span></span>
              </h2>
            </div>
            <div style={{ ...labelMeta, maxWidth: 288, borderLeft: `2px solid ${accent}`, paddingLeft: 16, lineHeight: 1.6 }}>
              {kit.labels.catalogueNote}
            </div>
          </div>
          <div className="sgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {kit.services.map((s, i) => (
              <article key={s.name} className="scard" style={{ background: C.paper, border: `2px solid ${C.ink}`, boxShadow: SHADOW, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <figure style={{ margin: 0, aspectRatio: "3/2", borderBottom: `2px solid ${C.ink}`, overflow: "hidden", background: C.canvas }}>
                  <img src={kit.gallery[i % kit.gallery.length]} alt={s.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </figure>
                <div style={{ padding: "24px 26px 28px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                    <span style={labelMeta}>Nº {pad(i + 1)}</span>
                    <span style={{ ...labelMeta, color: accentDark }}>{s.cat}</span>
                  </div>
                  <h3 className="fr" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.05, margin: "0 0 10px" }}>{s.name}</h3>
                  <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px", flex: 1 }}>{s.desc}</p>
                  <div style={{ paddingTop: 18, borderTop: `2px solid rgba(27,26,23,0.8)`, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    {s.duration != null && kit.labels.serviceUnit ? (
                      <div>
                        <div style={{ ...labelMeta, marginBottom: 2 }}>{kit.labels.serviceUnit}</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14 }}>{s.duration} min</div>
                      </div>
                    ) : <span />}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ ...labelMeta, marginBottom: 2 }}>Tarif</div>
                      <div className="fr" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1 }}>{s.price}<span style={{ fontSize: 16, verticalAlign: "top", marginLeft: 2 }}>€</span></div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Galerie */}
      <section id="galerie" className="sec-pad" style={{ background: C.paper, borderBottom: `2px solid ${C.ink}`, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 48 }}>
            <div>
              <div style={{ ...labelMeta, marginBottom: 16 }}>§ 04 — Réalisations</div>
              <h2 className="fr h2" style={{ fontSize: 56, lineHeight: 0.95, margin: 0, fontWeight: 500 }}>
                {kit.labels.gallery}<br /><span style={{ fontStyle: "italic", fontWeight: 300 }}>{kit.labels.gallerySub}<span style={{ color: accent }}>.</span></span>
              </h2>
            </div>
          </div>
          <div className="ggrid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {kit.gallery.map((src, i) => (
              <div key={`${src}-${i}`} className="gcard" style={{ position: "relative", aspectRatio: "1", border: `2px solid ${C.ink}`, boxShadow: SHADOW, overflow: "hidden", background: C.canvas }}>
                <img src={src} alt={`Réalisation ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <span style={{ position: "absolute", top: 8, left: 8, ...labelMeta, background: "rgba(251,248,241,0.9)", padding: "2px 6px" }}>Nº {pad(i + 1)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Horaires */}
      <section className="sec-pad" style={{ background: accent, color: C.canvas, borderBottom: `2px solid ${C.ink}`, padding: "96px 24px" }}>
        <div className="grid12" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "5fr 7fr", gap: 48 }}>
          <div>
            <div style={{ ...labelMeta, color: "rgba(251,248,241,0.7)", marginBottom: 16 }}>§ 05 — Horaires</div>
            <h2 className="fr h2" style={{ fontSize: 56, lineHeight: 0.95, margin: 0, fontWeight: 500 }}>
              Quand nous<br /><span style={{ fontStyle: "italic", fontWeight: 300 }}>vous recevons.</span>
            </h2>
            <p style={{ marginTop: 36, color: "rgba(251,248,241,0.8)", maxWidth: 360, lineHeight: 1.6 }}>
              Sur rendez-vous de préférence. En cas de doute sur un créneau, appelez-nous directement.
            </p>
          </div>
          <div style={{ background: C.canvas, color: C.ink, border: `2px solid ${C.ink}`, boxShadow: SHADOW }}>
            {DAYS.map((day, i) => (
              <div key={day} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "baseline", padding: "16px 20px", borderBottom: i < DAYS.length - 1 ? "1px solid rgba(27,26,23,0.2)" : "none", background: i === todayIdx ? C.ink : "transparent", color: i === todayIdx ? C.canvas : C.ink }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: "0.15em", opacity: 0.5 }}>{pad(i + 1)}</span>
                <span className="fr" style={{ fontSize: 22, fontWeight: 500, textTransform: "capitalize" }}>
                  {day}{i === todayIdx ? <span style={{ ...labelMeta, marginLeft: 8, color: i === todayIdx ? "rgba(251,248,241,0.6)" : C.inkSoft }}>— aujourd&apos;hui</span> : null}
                </span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, textAlign: "right", opacity: OPEN[i] ? 1 : 0.4 }}>{HOURS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avis (inversé) */}
      <section id="avis" className="sec-pad" style={{ background: C.ink, color: C.canvas, borderBottom: `2px solid ${C.ink}`, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ ...labelMeta, color: accent, marginBottom: 16 }}>§ 06 — Témoignages</div>
            <h2 className="fr h2" style={{ fontSize: 56, lineHeight: 0.95, margin: 0, fontWeight: 500 }}>
              Ils en parlent<br /><span style={{ fontStyle: "italic", fontWeight: 300 }}>mieux que nous<span style={{ color: accent }}>.</span></span>
            </h2>
            <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 12 }}>
              <Stars value={avg} color={accent} stroke={accent} size={18} />
              <span className="fr" style={{ fontSize: 20 }}>{avg}/5</span>
              <span style={{ ...labelMeta, color: "rgba(251,248,241,0.5)" }}>· {reviewCount} avis</span>
            </div>
          </div>
          <div className="sgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {testimonials.map((r, i) => (
              <article key={i} style={{ background: C.canvas, color: C.ink, border: `2px solid ${C.canvas}`, padding: 30, display: "flex", flexDirection: "column", boxShadow: SHADOW }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                  <Stars value={r.rating} color={accent} />
                  <span style={labelMeta}>Nº {pad(i + 1)}</span>
                </div>
                <blockquote className="fr" style={{ fontSize: 20, lineHeight: 1.4, fontStyle: "italic", color: "rgba(27,26,23,0.9)", flex: 1, margin: 0 }}>« {r.comment} »</blockquote>
                <div style={{ marginTop: 28, paddingTop: 16, borderTop: "2px solid rgba(27,26,23,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="fr" style={{ fontSize: 16, fontWeight: 500 }}>— {r.author}</span>
                  <span style={labelMeta}>{r.date}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="sec-pad" style={{ background: C.paper, borderBottom: `2px solid ${C.ink}`, padding: "96px 24px" }}>
        <div className="grid12" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "5fr 7fr", gap: 48 }}>
          <div>
            <div style={{ ...labelMeta, marginBottom: 16 }}>§ 07 — Contact</div>
            <h2 className="fr h2" style={{ fontSize: 56, lineHeight: 0.95, margin: 0, fontWeight: 500 }}>
              Nous trouver,<br /><span style={{ fontStyle: "italic", fontWeight: 300 }}>nous joindre<span style={{ color: accent }}>.</span></span>
            </h2>
            <p style={{ marginTop: 32, color: C.inkSoft, maxWidth: 360, lineHeight: 1.6 }}>
              Pour toute demande spéciale ou question, contactez-nous directement.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: C.canvas, border: `2px solid ${C.ink}`, padding: 28, boxShadow: SHADOW }}>
              <div style={{ ...labelMeta, marginBottom: 12 }}>Adresse</div>
              <p className="fr" style={{ fontSize: 20, lineHeight: 1.3, margin: 0 }}>{address || "Centre-ville"}<br />{cityLabel}</p>
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(27,26,23,0.2)" }}>
                <div style={{ ...labelMeta, marginBottom: 4 }}>Pays</div>
                <p className="fr" style={{ fontSize: 16, margin: 0 }}>France</p>
              </div>
            </div>
            <div style={{ background: C.ink, color: C.canvas, border: `2px solid ${C.ink}`, padding: 28, boxShadow: SHADOW }}>
              <div style={{ ...labelMeta, color: "rgba(251,248,241,0.6)", marginBottom: 12 }}>Téléphone</div>
              <a className="salon-link fr" href={`tel:${tel}`} style={{ fontSize: 20, color: C.canvas }}>{phone || "—"}</a>
              <div style={{ ...labelMeta, color: "rgba(251,248,241,0.6)", marginTop: 24, marginBottom: 12 }}>Sur</div>
              <p className="fr" style={{ fontSize: 16, margin: 0 }}>Rendez-vous</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section style={{ position: "relative", background: C.ink, color: C.canvas, borderBottom: `2px solid ${C.ink}`, overflow: "hidden" }}>
        <div className="fr" style={{ position: "absolute", left: -20, top: -50, fontSize: 360, lineHeight: 1, fontWeight: 600, color: `${accent}1a`, pointerEvents: "none" }} aria-hidden>08</div>
        <div className="grid12 sec-pad" style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "112px 24px", display: "grid", gridTemplateColumns: "8fr 4fr", gap: 48, alignItems: "end" }}>
          <h2 className="fr h2" style={{ fontSize: 80, lineHeight: 0.9, margin: 0, fontWeight: 500 }}>
            Prêt(e) à<br /><span style={{ fontStyle: "italic", fontWeight: 300, color: accent }}>{kit.labels.ctaFinal}</span> votre<br />moment ?
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <a href={`tel:${tel}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, background: C.canvas, color: C.ink, border: `2px solid ${C.canvas}`, padding: "24px 32px", fontSize: 18, fontWeight: 500, textDecoration: "none" }}>
              {kit.labels.cta} →
            </a>
            <p style={{ ...labelMeta, color: "rgba(251,248,241,0.6)", lineHeight: 1.6 }}>
              Conseil personnalisé · Une équipe à votre écoute · Réponse rapide.
            </p>
          </div>
        </div>
      </section>

      {/* Pourquoi un site (démos publiques) */}
      {nmfCredit && (
        <section className="sec-pad" style={{ background: C.canvas, borderBottom: `2px solid ${C.ink}`, padding: "96px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ ...labelMeta, marginBottom: 16 }}>Pourquoi un site est important</div>
              <h2 className="fr h2" style={{ fontSize: 48, lineHeight: 1.05, margin: 0, fontWeight: 500 }}>
                Un commerce qu&apos;on trouve,<br />des clients qui reviennent.
              </h2>
            </div>
            <div className="sgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 48 }}>
              {[
                { num: "24/7", label: "visible et joignable, même fermé" },
                { num: "+30%", label: "de nouveaux clients via Google en moyenne" },
                { num: "−50%", label: "de rendez-vous oubliés grâce aux rappels" },
              ].map((s) => (
                <div key={s.label} style={{ background: C.paper, border: `2px solid ${C.ink}`, padding: "36px 28px", textAlign: "center", boxShadow: SHADOW }}>
                  <div className="fr" style={{ fontSize: 52, fontWeight: 500, color: accent, lineHeight: 1, marginBottom: 12 }}>{s.num}</div>
                  <div style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, background: C.paper, border: `2px solid ${C.ink}`, padding: "32px 48px", textAlign: "center", boxShadow: SHADOW }}>
                <span style={{ ...labelMeta, color: accentDark }}>Votre site clé en main</span>
                <div className="fr" style={{ fontSize: 46, fontWeight: 500, lineHeight: 1.1 }}>à partir de 299€</div>
                <div style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.6 }}>puis 29€/mois — hébergement, maintenance &amp; mises à jour inclus</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ background: C.ink, color: "rgba(251,248,241,0.7)", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span style={{ ...labelMeta, color: "rgba(251,248,241,0.5)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />© {year} — {name}
          </span>
          <span style={{ ...labelMeta, color: "rgba(251,248,241,0.5)" }}>{cityLabel}, France{phone ? ` · ${phone}` : ""}</span>
        </div>
      </footer>

      {/* Crédit NMF (démos publiques) */}
      {nmfCredit && (
        <div style={{ background: "#000", padding: "14px 24px", textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Démo créée par{" "}
          <a href="https://www.nmf-agence.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#E8916F", textDecoration: "none", fontWeight: 700 }}>NMF Agence</a>
          {process.env.NEXT_PUBLIC_NMF_PHONE ? (
            <> {" · "}<a href={`tel:${process.env.NEXT_PUBLIC_NMF_PHONE.replace(/\s/g, "")}`} style={{ color: "#E8916F", textDecoration: "none", fontWeight: 700 }}>{process.env.NEXT_PUBLIC_NMF_PHONE}</a></>
          ) : ""}
          <br />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Aperçu gratuit et sans engagement — entièrement personnalisable à votre demande.</span>
        </div>
      )}
    </div>
  );
}
