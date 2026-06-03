import type { TemplateProps } from "./data";
import { getServices, metierLabel, getAboutImage } from "./data";

export interface TemplateTheme {
  bg: string;
  bgAlt: string;
  border: string;
  borderLight: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  text: string;
  muted: string;
  dim: string;
  subtle: string;
  /** Color used on accent-background text (e.g. buttons). Some themes use white, some use bg. */
  accentFg: string;
  heroImage: string;
  heroOverlay: string;
  heroFade: string;
}

const mono = (accent: string): React.CSSProperties => ({
  fontFamily: "'Space Mono', monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.3em",
  color: accent,
});

/** Render the hero name: each word on its own line for 2–3 words, generous word-spacing for 4+. */
function HeroName({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 3) {
    return (
      <>
        {words.map((w, i) => (
          <span key={i} style={{ display: "block" }}>
            {w.toUpperCase()}
          </span>
        ))}
      </>
    );
  }
  return <>{name.toUpperCase()}</>;
}

export default function BaseTemplate({
  name,
  metier,
  ville,
  phone,
  rating,
  reviews,
  address,
  theme: C,
  nmfCredit = false,
}: TemplateProps & { theme: TemplateTheme; nmfCredit?: boolean }) {
  const services = getServices(metier);
  const label = metierLabel(metier);
  const mainIcon = services[0]?.icon || "🔧";
  const monoStyle = mono(C.accent);
  const nameWords = name.trim().split(/\s+/);

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: C.text, margin: 0, background: C.bg }}>

      {/* Animations for hero polish + responsive overrides (mobile-first phones) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hero-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes hero-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @media (max-width: 768px) {
          .nav-inner { padding: 12px 16px !important; }
          .nav-menu { display: none !important; }
          .nav-brand { font-size: 15px !important; }
          .nav-cta { padding: 8px 14px !important; font-size: 13px !important; }
          .hero-inner { padding: 116px 20px 72px !important; }
          .hero-title { font-size: 42px !important; }
          .hero-sub { font-size: 18px !important; }
          .hero-cta-row { flex-direction: column !important; gap: 12px !important; }
          .hero-cta-row a { width: 100% !important; justify-content: center !important; padding: 14px 24px !important; box-sizing: border-box !important; }
          .section-pad { padding: 56px 20px !important; }
          .section-head { margin-bottom: 40px !important; }
          .section-h2 { font-size: 30px !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .about-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .about-badge { position: static !important; display: inline-block !important; margin-top: 16px !important; font-size: 22px !important; padding: 12px 18px !important; }
          .about-stats { gap: 20px !important; }
          .contact-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .contact-form { padding: 24px !important; }
          .footer-inner { flex-direction: column !important; gap: 14px !important; text-align: center !important; }
          .demo-banner { font-size: 11px !important; padding: 9px 16px !important; letter-spacing: 0 !important; }
          .demo-why-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .demo-watermark { display: none !important; }
        }
        @media (max-width: 420px) {
          .hero-title { font-size: 34px !important; }
          .section-h2 { font-size: 26px !important; }
        }
      `}} />

      {/* ── Bandeau démo (démos publiques uniquement) ── */}
      {nmfCredit && (
        <div className="demo-banner" style={{
          background: "#000",
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          padding: "11px 24px",
          fontFamily: "'Space Mono', monospace",
          fontSize: 13,
          letterSpacing: "0.02em",
          lineHeight: 1.5,
        }}>
          ✨ Démo gratuite — ce site est{" "}
          <strong style={{ color: "#a78bfa" }}>entièrement modifiable à votre demande</strong>{" "}
          (textes, photos, couleurs). Dites-nous ce qu&apos;on change.
        </div>
      )}

      {/* ── Watermark démo (fixe, n'intercepte pas les clics) ── */}
      {nmfCredit && (
        <div className="demo-watermark" style={{
          position: "fixed",
          bottom: 18,
          left: 18,
          zIndex: 60,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(167,139,250,0.4)",
          borderRadius: 999,
          padding: "7px 14px",
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.75)",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
          Démo · personnalisable
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{
        background: `${C.bg}f2`,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.accentBorder}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div className="nav-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, background: C.accent, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              {mainIcon}
            </div>
            <span className="nav-brand" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em" }}>{name.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div className="nav-menu" style={{ display: "flex", alignItems: "center", gap: 32 }}>
              {["Services", "À propos", "Contact"].map((l) => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, "")}`} style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  color: C.muted,
                  textDecoration: "none",
                }}>{l}</a>
              ))}
            </div>
            <a className="nav-cta" href={`tel:${phone.replace(/\s/g, "")}`} style={{
              background: C.accent,
              color: C.accentFg,
              fontWeight: 700,
              padding: "10px 20px",
              borderRadius: 2,
              textDecoration: "none",
              fontSize: 14,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap" as const,
            }}>{phone}</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: C.bg,
      }}>
        <img
          src={C.heroImage}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }}
        />
        <div style={{ position: "absolute", inset: 0, background: C.heroOverlay }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 128, background: C.heroFade }} />

        <div className="hero-inner" style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "176px 24px 128px", textAlign: "center", width: "100%", boxSizing: "border-box" }}>
          {/* Status badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 2,
            padding: "6px 16px",
            marginBottom: 32,
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.3)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "hero-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ade80" }}>Disponible</span>
          </div>

          <h1 className="hero-title" style={{
            fontSize: 80,
            fontWeight: 900,
            lineHeight: 1,
            margin: "0 0 24px",
            letterSpacing: "-0.04em",
            wordSpacing: nameWords.length > 3 ? "0.15em" : undefined,
            wordBreak: "break-word" as const,
            overflowWrap: "break-word" as const,
            textShadow: "0 2px 30px rgba(0,0,0,0.3)",
          }}>
            <HeroName name={name} />
          </h1>

          {/* Decorative line + label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 32 }}>
            <div style={{ height: 1, width: 64, background: C.accent }} />
            <span style={{ ...monoStyle, fontSize: 14, color: C.accent, fontWeight: 700, textShadow: `0 0 20px ${C.accent}40` }}>{label}</span>
            <div style={{ height: 1, width: 64, background: C.accent }} />
          </div>

          <p className="hero-sub" style={{ fontSize: 24, color: C.subtle, fontWeight: 500, margin: "0 0 8px" }}>
            {label} professionnel
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 14, letterSpacing: "0.05em", margin: "0 0 56px" }}>
            {ville}
          </p>

          <div className="hero-cta-row" style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <a href="#contact" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: `linear-gradient(110deg, ${C.accent} 30%, ${C.accent}cc 50%, ${C.accent} 70%)`,
              backgroundSize: "200% 100%",
              animation: "hero-shimmer 3s ease-in-out infinite",
              color: C.accentFg,
              fontWeight: 700,
              padding: "16px 40px",
              borderRadius: 2,
              textDecoration: "none",
              fontSize: 18,
              boxShadow: `0 4px 24px ${C.accent}40`,
            }}>Devis gratuit</a>
            <a href={`tel:${phone.replace(/\s/g, "")}`} style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${C.dim}`,
              color: C.text,
              fontWeight: 600,
              padding: "16px 40px",
              borderRadius: 2,
              textDecoration: "none",
              fontSize: 18,
            }}>{phone}</a>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="section-pad" style={{ padding: "96px 24px", background: C.bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="section-head" style={{ textAlign: "center", marginBottom: 80 }}>
            <span style={{ ...monoStyle, display: "block", marginBottom: 16 }}>Ce que nous faisons</span>
            <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", margin: 0 }}>Nos Services</h2>
          </div>

          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {services.map((s) => (
              <div key={s.title} style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 2,
                background: C.bgAlt,
                border: `1px solid ${C.border}`,
              }}>
                {/* Service image */}
                <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
                  <img
                    src={s.image}
                    alt={s.title}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    background: `linear-gradient(to top, ${C.bgAlt}, transparent)`,
                  }} />
                  <div style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    width: 40,
                    height: 40,
                    background: `${C.accent}dd`,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}>{s.icon}</div>
                </div>
                {/* Card content */}
                <div style={{ padding: "16px 24px 28px" }}>
                  <div style={{ width: 32, height: 2, background: C.accent, marginBottom: 12 }} />
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{s.title}</h3>
                  <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="apropos" className="section-pad" style={{ padding: "96px 24px", background: C.bgAlt }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            {/* About image — adapted to prospect's métier */}
            <div style={{ position: "relative" }}>
              <div style={{
                aspectRatio: "4/5",
                background: `linear-gradient(135deg, ${C.border}, ${C.bg})`,
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <img
                  src={getAboutImage(metier)}
                  alt={`${label} professionnel à ${ville}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
                />
              </div>
              <div className="about-badge" style={{
                position: "absolute",
                bottom: -24,
                right: -24,
                background: C.accent,
                color: C.accentFg,
                fontWeight: 900,
                fontSize: 36,
                padding: "24px 32px",
                borderRadius: 2,
              }}>7j/7</div>
            </div>

            {/* Text */}
            <div>
              <span style={{ ...monoStyle, display: "block", marginBottom: 16 }}>À propos</span>
              <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 32px" }}>
                Votre {label.toLowerCase()}<br />de confiance
              </h2>
              <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, margin: "0 0 24px" }}>
                {name} est votre {label.toLowerCase()} de référence à {ville} et ses environs. Nous intervenons rapidement pour tous vos besoins.
              </p>
              <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, margin: "0 0 40px" }}>
                Notre priorité : un travail soigné, dans le respect des normes en vigueur, avec des tarifs transparents et sans surprise.
              </p>

              <div className="about-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 24 }}>
                  <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>Devis</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gratuit</div>
                </div>
                {rating != null ? (
                  <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 24 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>{rating}</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{reviews ?? 0} avis</div>
                  </div>
                ) : (
                  <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 24 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>Pro</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Certifié</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="section-pad" style={{ padding: "96px 24px", background: C.bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="section-head" style={{ textAlign: "center", marginBottom: 80 }}>
            <span style={{ ...monoStyle, display: "block", marginBottom: 16 }}>Contact</span>
            <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", margin: 0 }}>Demandez votre devis</h2>
          </div>

          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
            {/* Form */}
            <div className="contact-form" style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 2, padding: 40 }}>
              {[
                { label: "Nom complet", type: "text", placeholder: "Votre nom" },
                { label: "Email", type: "email", placeholder: "votre@email.fr" },
                { label: "Téléphone", type: "tel", placeholder: "06 00 00 00 00" },
              ].map((f) => (
                <div key={f.label} style={{ marginBottom: 24 }}>
                  <label style={{
                    display: "block",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.1em",
                    color: C.dim,
                    marginBottom: 8,
                  }}>{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: C.border,
                      border: `1px solid ${C.borderLight}`,
                      borderRadius: 2,
                      color: C.text,
                      fontSize: 16,
                      boxSizing: "border-box" as const,
                      outline: "none",
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: "block",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  color: C.dim,
                  marginBottom: 8,
                }}>Message</label>
                <textarea
                  rows={4}
                  placeholder="Décrivez votre besoin..."
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: C.border,
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: 2,
                    color: C.text,
                    fontSize: 16,
                    boxSizing: "border-box" as const,
                    outline: "none",
                    resize: "none" as const,
                    fontFamily: "'Outfit', sans-serif",
                  }}
                />
              </div>
              <button style={{
                width: "100%",
                background: C.accent,
                color: C.accentFg,
                fontWeight: 700,
                padding: 16,
                borderRadius: 2,
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
              }}>Envoyer ma demande</button>
            </div>

            {/* Info sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { icon: "📍", title: "Zone d'intervention", text: `${ville} et environs` },
                { icon: "📞", title: "Téléphone", text: phone, highlight: true },
                { icon: "⏰", title: "Disponibilité", text: "Lun-Ven 8h-18h" },
              ].map((info) => (
                <div key={info.title} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    background: C.accentBg,
                    border: `1px solid ${C.accentBorder}`,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}>{info.icon}</div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 18, margin: "0 0 4px" }}>{info.title}</h3>
                    <p style={{ color: info.highlight ? C.accent : C.muted, fontSize: 16, margin: 0 }}>{info.text}</p>
                  </div>
                </div>
              ))}

              {/* Schedule card */}
              <div style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 2, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    background: C.accentBg,
                    border: `1px solid ${C.accentBorder}`,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}>🕐</div>
                  <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>Horaires</h3>
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
                  {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((day, i) => (
                    <div key={day} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      color: i === new Date().getDay() - 1 || (i === 6 && new Date().getDay() === 0) ? C.accent : C.muted,
                    }}>
                      <span>{day}</span>
                      <span>{i < 5 ? "08:00 – 18:00" : i === 5 ? "09:00 – 13:00" : "Fermé"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {address && (
                <div style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 2, padding: 24, color: C.muted, fontSize: 14 }}>
                  📍 {address}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pourquoi un site est important (démos publiques uniquement) ── */}
      {nmfCredit && (
        <section className="section-pad" style={{ padding: "96px 24px", background: C.bgAlt, borderTop: `1px solid ${C.accentBorder}` }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="section-head" style={{ textAlign: "center", marginBottom: 56 }}>
              <span style={{ ...monoStyle, display: "block", marginBottom: 16 }}>Pourquoi un site est important</span>
              <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>
                Un site qui travaille<br />pour vous, jour et nuit
              </h2>
            </div>

            <div className="demo-why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, marginBottom: 48 }}>
              {[
                { num: "~200", label: "visites par mois en moyenne" },
                { num: "+3", label: "demandes de devis supplémentaires / mois minimum" },
                { num: "1", label: "seul chantier suffit à le rentabiliser" },
              ].map((stat) => (
                <div key={stat.label} style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 2,
                  padding: "36px 28px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 56, fontWeight: 900, color: C.accent, lineHeight: 1, marginBottom: 12, textShadow: `0 0 24px ${C.accent}30` }}>{stat.num}</div>
                  <div style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <p style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", color: C.subtle, fontSize: 18, lineHeight: 1.7 }}>
              Sur les artisans que NMF Agence a accompagnés, un site bien référencé attire en moyenne
              près de <strong style={{ color: C.text }}>200 visites par mois</strong> et génère au minimum
              <strong style={{ color: C.text }}> 3 demandes de devis supplémentaires</strong>. Autrement dit :
              il est <strong style={{ color: C.accent }}>rentabilisé dès le premier chantier signé</strong>.
            </p>

            {/* Offre / prix NMF */}
            <div style={{ marginTop: 48, display: "flex", justifyContent: "center" }}>
              <div style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                background: C.accentBg,
                border: `1px solid ${C.accentBorder}`,
                borderRadius: 4,
                padding: "32px 48px",
                textAlign: "center",
              }}>
                <span style={{ ...monoStyle, color: C.accent }}>Votre site clé en main</span>
                <div style={{ fontSize: 46, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>
                  à partir de 299€
                </div>
                <div style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>
                  puis 29€/mois — hébergement, maintenance &amp; mises à jour incluses
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "40px 24px" }}>
        <div className="footer-inner" style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              {mainIcon}
            </div>
            <span style={{ fontWeight: 700 }}>{name.toUpperCase()}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 12 }}>/ {label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontFamily: "'Space Mono', monospace", fontSize: 14, color: C.dim }}>
            <span>{phone}</span>
            <span style={{ color: C.border }}>|</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* ── Crédit NMF Agence (démos publiques uniquement) ── */}
      {nmfCredit && (
        <div style={{ background: "#000", padding: "14px 24px", textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Démo créée par{" "}
          <a href="https://www.nmf-agence.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 700 }}>
            NMF Agence
          </a>
          {process.env.NEXT_PUBLIC_NMF_PHONE ? (
            <>
              {" · "}
              <a href={`tel:${process.env.NEXT_PUBLIC_NMF_PHONE.replace(/\s/g, "")}`} style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 700 }}>
                {process.env.NEXT_PUBLIC_NMF_PHONE}
              </a>
            </>
          ) : ""}
          <br />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>
            Aperçu gratuit et sans engagement — entièrement personnalisable à votre demande.
          </span>
        </div>
      )}
    </div>
  );
}
