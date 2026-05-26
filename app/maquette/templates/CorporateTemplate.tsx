import type { TemplateProps } from "./data";
import { getServices, metierLabel } from "./data";

/* ── EP Renov design — dark brutalist, amber accent ── */

const C = {
  bg: "#0a0a0a",
  bgAlt: "#171717",
  border: "#262626",
  borderLight: "#404040",
  accent: "#f59e0b",
  accentBg: "rgba(245,158,11,0.1)",
  accentBorder: "rgba(245,158,11,0.2)",
  text: "#fafafa",
  muted: "#a3a3a3",
  dim: "#737373",
  subtle: "#d4d4d4",
} as const;

const mono: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.3em",
  color: C.accent,
};

export default function CorporateTemplate({ name, metier, ville, phone, rating, reviews, address }: TemplateProps) {
  const services = getServices(metier);
  const label = metierLabel(metier);
  const mainIcon = services[0]?.icon || "🔧";

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: C.text, margin: 0, background: C.bg }}>

      {/* ── Nav ── */}
      <nav style={{
        background: `${C.bg}f2`,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.accentBorder}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, background: C.accent, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {mainIcon}
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em" }}>{name.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {["Services", "A propos", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, "")}`} style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
                color: C.muted,
                textDecoration: "none",
              }}>{l}</a>
            ))}
            <a href={`tel:${phone.replace(/\s/g, "")}`} style={{
              background: C.accent,
              color: C.bg,
              fontWeight: 700,
              padding: "10px 20px",
              borderRadius: 2,
              textDecoration: "none",
              fontSize: 14,
              letterSpacing: "0.05em",
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
          src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&q=80"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0a0a0a, rgba(10,10,10,0.6), transparent)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 128, background: "linear-gradient(to top, #0a0a0a, transparent)" }} />

        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "176px 24px 128px", textAlign: "center", width: "100%" }}>
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
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ade80" }}>Disponible</span>
          </div>

          <h1 style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, marginBottom: 24, letterSpacing: "-0.04em", margin: "0 0 24px" }}>
            {name.toUpperCase()}
          </h1>

          {/* Decorative amber line + label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 32 }}>
            <div style={{ height: 1, width: 64, background: C.accent }} />
            <span style={{ ...mono, fontSize: 14 }}>{label}</span>
            <div style={{ height: 1, width: 64, background: C.accent }} />
          </div>

          <p style={{ fontSize: 24, color: C.subtle, fontWeight: 500, margin: "0 0 8px" }}>
            {label} professionnel
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 14, letterSpacing: "0.05em", margin: "0 0 56px" }}>
            {ville}
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <a href="#contact" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: C.accent,
              color: C.bg,
              fontWeight: 700,
              padding: "16px 40px",
              borderRadius: 2,
              textDecoration: "none",
              fontSize: 18,
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
      <section id="services" style={{ padding: "96px 24px", background: C.bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <span style={{ ...mono, display: "block", marginBottom: 16 }}>Ce que nous faisons</span>
            <h2 style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", margin: 0 }}>Nos Services</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {services.map((s) => (
              <div key={s.title} style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 2,
                background: C.bgAlt,
                border: `1px solid ${C.border}`,
                padding: "32px 24px",
              }}>
                <div style={{ width: 32, height: 2, background: C.accent, marginBottom: 16 }} />
                <div style={{ fontSize: 40, marginBottom: 16 }}>{s.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="apropos" style={{ padding: "96px 24px", background: C.bgAlt }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            {/* Image placeholder with stat badge */}
            <div style={{ position: "relative" }}>
              <div style={{
                aspectRatio: "4/5",
                background: `linear-gradient(135deg, ${C.border}, ${C.bg})`,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                color: C.dim,
                overflow: "hidden",
              }}>
                <img
                  src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80"
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
                />
              </div>
              <div style={{
                position: "absolute",
                bottom: -24,
                right: -24,
                background: C.accent,
                color: C.bg,
                fontWeight: 900,
                fontSize: 36,
                padding: "24px 32px",
                borderRadius: 2,
              }}>7j/7</div>
            </div>

            {/* Text */}
            <div>
              <span style={{ ...mono, display: "block", marginBottom: 16 }}>A propos</span>
              <h2 style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 32px" }}>
                Votre {label.toLowerCase()}<br />de confiance
              </h2>
              <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, margin: "0 0 24px" }}>
                {name} est votre {label.toLowerCase()} de référence à {ville} et ses environs. Nous intervenons rapidement pour tous vos besoins.
              </p>
              <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, margin: "0 0 40px" }}>
                Notre priorité : un travail soigné, dans le respect des normes en vigueur, avec des tarifs transparents et sans surprise.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 24 }}>
                  <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>Devis</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gratuit</div>
                </div>
                <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 24 }}>
                  <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>{rating ?? "5.0"}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{reviews ?? 0} avis</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" style={{ padding: "96px 24px", background: C.bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <span style={{ ...mono, display: "block", marginBottom: 16 }}>Contact</span>
            <h2 style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.025em", margin: 0 }}>Demandez votre devis</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
            {/* Form */}
            <div style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 2, padding: "40px" }}>
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
                color: C.bg,
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

      {/* ── Footer ── */}
      <footer style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "40px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
