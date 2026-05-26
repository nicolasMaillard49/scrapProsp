import type { TemplateProps } from "./data";
import { getServices, metierLabel } from "./data";

export default function ProTemplate({ name, metier, ville, phone, rating, reviews, address }: TemplateProps) {
  const services = getServices(metier);
  const label = metierLabel(metier);
  const stars = rating ? "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating)) : "";

  return (
    <div style={{ fontFamily: "'Rubik', 'Segoe UI', sans-serif", color: "#1f2933", margin: 0, background: "#fff" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px", background: "#1f2933", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#e47b02" }}>{name}</div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <a href="#services" style={{ color: "#fff", textDecoration: "none", fontSize: 15 }}>Services</a>
          <a href="#avis" style={{ color: "#fff", textDecoration: "none", fontSize: 15 }}>Avis</a>
          <a href="#contact" style={{ color: "#fff", textDecoration: "none", fontSize: 15 }}>Contact</a>
          <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ background: "#e47b02", color: "#fff", padding: "10px 24px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>
            📞 {phone}
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, rgba(31,41,51,0.85), rgba(228,123,2,0.7)), url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80') center/cover",
        minHeight: 500,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "80px 24px",
        color: "#fff",
      }}>
        <div style={{ fontSize: 18, textTransform: "uppercase", letterSpacing: 3, marginBottom: 16, opacity: 0.9 }}>
          {label} à {ville}
        </div>
        <h1 style={{ fontFamily: "'Roboto Slab', Georgia, serif", fontSize: 52, fontWeight: 700, margin: "0 0 20px", lineHeight: 1.2, maxWidth: 700 }}>
          {name}
        </h1>
        <p style={{ fontSize: 20, maxWidth: 600, lineHeight: 1.6, opacity: 0.9, margin: "0 0 32px" }}>
          Votre {label.toLowerCase()} de confiance à {ville} et ses environs. Devis gratuit, intervention rapide.
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ background: "#e47b02", color: "#fff", padding: "16px 36px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 18, boxShadow: "0 4px 20px rgba(228,123,2,0.4)" }}>
            Appeler maintenant
          </a>
          <a href="#contact" style={{ border: "2px solid #fff", color: "#fff", padding: "16px 36px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 18 }}>
            Devis gratuit
          </a>
        </div>
      </section>

      {/* Trust badges */}
      <section style={{ display: "flex", justifyContent: "center", gap: 48, padding: "40px 24px", background: "#f6f8f9", flexWrap: "wrap" }}>
        {[
          { value: rating ? `${rating}/5` : "5/5", label: "Note Google" },
          { value: reviews ? `${reviews}+` : "—", label: "Avis clients" },
          { value: "7j/7", label: "Disponibilité" },
          { value: "Gratuit", label: "Devis" },
        ].map((b) => (
          <div key={b.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#e47b02" }}>{b.value}</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{b.label}</div>
          </div>
        ))}
      </section>

      {/* Services */}
      <section id="services" style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Roboto Slab', Georgia, serif", fontSize: 36, textAlign: "center", marginBottom: 12 }}>Nos Services</h2>
        <p style={{ textAlign: "center", color: "#6b7280", fontSize: 17, marginBottom: 48 }}>
          Des prestations professionnelles adaptées à tous vos besoins
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
          {services.map((s) => (
            <div key={s.title} style={{ background: "#f6f8f9", borderRadius: 12, padding: "32px 24px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{s.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section id="avis" style={{ padding: "80px 40px", background: "#1f2933", color: "#fff" }}>
        <h2 style={{ fontFamily: "'Roboto Slab', Georgia, serif", fontSize: 36, textAlign: "center", marginBottom: 12 }}>
          Ce que disent nos clients
        </h2>
        {rating && (
          <div style={{ textAlign: "center", fontSize: 28, color: "#e47b02", marginBottom: 8 }}>{stars}</div>
        )}
        <p style={{ textAlign: "center", opacity: 0.7, marginBottom: 48 }}>
          {rating ? `${rating}/5 basé sur ${reviews ?? 0} avis Google` : "Avis clients"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, maxWidth: 900, margin: "0 auto" }}>
          {[
            { text: "Intervention rapide et professionnelle. Je recommande vivement !", author: "Marie D." },
            { text: "Très bon travail, propre et soigné. Tarifs honnêtes et devis respecté.", author: "Pierre L." },
            { text: "Disponible rapidement, à l'écoute et de bon conseil. Je referai appel à eux.", author: "Sophie M." },
          ].map((r) => (
            <div key={r.author} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "28px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "#e47b02", fontSize: 18, marginBottom: 12 }}>★★★★★</div>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.9 }}>&ldquo;{r.text}&rdquo;</p>
              <div style={{ marginTop: 12, fontWeight: 600, fontSize: 14, opacity: 0.7 }}>— {r.author}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: "80px 40px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Roboto Slab', Georgia, serif", fontSize: 36, marginBottom: 12 }}>Contactez-nous</h2>
        <p style={{ color: "#6b7280", fontSize: 17, marginBottom: 40 }}>
          Demandez votre devis gratuit et sans engagement
        </p>
        <div style={{ background: "#f6f8f9", borderRadius: 16, padding: "40px 32px", textAlign: "left" }}>
          {[
            { label: "Nom", type: "text", placeholder: "Votre nom" },
            { label: "Téléphone", type: "tel", placeholder: "06 XX XX XX XX" },
            { label: "Email", type: "email", placeholder: "votre@email.fr" },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} style={{ width: "100%", padding: "14px 16px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Message</label>
            <textarea placeholder="Décrivez votre besoin..." rows={4} style={{ width: "100%", padding: "14px 16px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <button style={{ width: "100%", background: "#e47b02", color: "#fff", padding: "16px", borderRadius: 8, border: "none", fontSize: 17, fontWeight: 700, cursor: "pointer" }}>
            Envoyer ma demande
          </button>
        </div>
        {address && (
          <p style={{ marginTop: 24, color: "#6b7280", fontSize: 15 }}>📍 {address}</p>
        )}
      </section>

      {/* Footer */}
      <footer style={{ background: "#1f2933", color: "#fff", textAlign: "center", padding: "32px 24px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e47b02", marginBottom: 8 }}>{name}</div>
        <div style={{ opacity: 0.6, fontSize: 14 }}>
          {label} à {ville} — {phone}
        </div>
        <div style={{ opacity: 0.4, fontSize: 12, marginTop: 12 }}>© {new Date().getFullYear()} {name}. Tous droits réservés.</div>
      </footer>
    </div>
  );
}
