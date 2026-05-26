import type { TemplateProps } from "./data";
import { getServices, metierLabel } from "./data";

export default function CorporateTemplate({ name, metier, ville, phone, rating, reviews, address }: TemplateProps) {
  const services = getServices(metier);
  const label = metierLabel(metier);
  const blue = "#206fbc";

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1a1a2e", margin: 0, background: "#fff" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: blue }}>{name}</div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <a href="#services" style={{ color: "#374151", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>Nos services</a>
          <a href="#avis" style={{ color: "#374151", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>Avis</a>
          <a href="#contact" style={{ color: "#374151", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>Contact</a>
          <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ background: blue, color: "#fff", padding: "10px 24px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>
            {phone}
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: `linear-gradient(135deg, ${blue}ee, #1a1a2eee), url('https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1400&q=80') center/cover`,
        minHeight: 480,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 60px",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 650 }}>
          <div style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16, opacity: 0.8 }}>
            {label} professionnel
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 800, margin: "0 0 20px", lineHeight: 1.15 }}>
            {label} de confiance à {ville}
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.7, opacity: 0.9, margin: "0 0 36px" }}>
            {name} vous accompagne pour tous vos travaux. Plus de {rating ? `${reviews} avis clients` : "10 ans d'expérience"}, devis gratuit et intervention rapide.
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ background: "#fff", color: blue, padding: "16px 32px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 17 }}>
              Devis gratuit
            </a>
            <a href="#services" style={{ border: "2px solid rgba(255,255,255,0.5)", color: "#fff", padding: "16px 32px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 17 }}>
              Nos services
            </a>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section style={{ display: "flex", justifyContent: "center", gap: 0, background: "#fff", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { icon: "✅", title: "100% satisfait", desc: "Garantie de satisfaction" },
          { icon: "🏆", title: "Professionnel certifié", desc: "Qualifié et assuré" },
          { icon: "🛡️", title: "Garantie décennale", desc: "Protection 10 ans" },
        ].map((v, i) => (
          <div key={v.title} style={{ flex: "1 1 250px", textAlign: "center", padding: "36px 24px", borderRight: i < 2 ? "1px solid #e5e7eb" : "none" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{v.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{v.title}</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>{v.desc}</div>
          </div>
        ))}
      </section>

      {/* About */}
      <section style={{ padding: "80px 40px", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ color: blue, fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          À propos
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 800, marginBottom: 20 }}>
          {rating ? `${reviews}+ avis clients` : "Plus de 10 ans"} d'expérience
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.8, color: "#4b5563", maxWidth: 700, margin: "0 auto" }}>
          {name} est votre {label.toLowerCase()} de référence à {ville} et ses environs. Notre équipe met son savoir-faire à votre service pour des travaux de qualité, dans le respect des délais et de votre budget. Devis gratuit et sans engagement.
        </p>
      </section>

      {/* Services */}
      <section id="services" style={{ padding: "80px 40px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ color: blue, fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>
            Nos services
          </div>
          <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: "center", marginBottom: 48 }}>
            Ce que nous proposons
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {services.map((s) => (
              <div key={s.title} style={{ background: "#fff", borderRadius: 12, padding: "32px 24px", border: "1px solid #e5e7eb", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{s.icon}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8, color: "#1a1a2e" }}>{s.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="avis" style={{ padding: "80px 40px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ color: blue, fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>
          Témoignages
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: "center", marginBottom: 12 }}>
          La satisfaction de nos clients
        </h2>
        {rating && (
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: blue }}>{rating}</span>
            <span style={{ fontSize: 20, color: "#6b7280" }}>/5</span>
            <div style={{ color: "#f59e0b", fontSize: 24, marginTop: 4 }}>{"★".repeat(Math.round(rating ?? 0))}</div>
            <div style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>{reviews} avis Google</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {[
            { text: "Travail soigné et professionnel. Devis respecté à la lettre. Je recommande !", author: "Thomas R.", note: "5/5" },
            { text: "Très réactif, intervention dans la journée. Tarifs compétitifs et travail propre.", author: "Isabelle G.", note: "5/5" },
            { text: "Excellente prestation, ponctuel et de bon conseil. Je n'hésiterai pas à refaire appel.", author: "Jean-Marc B.", note: "5/5" },
          ].map((r) => (
            <div key={r.author} style={{ background: "#f8fafc", borderRadius: 12, padding: "24px", border: "1px solid #e5e7eb" }}>
              <div style={{ color: "#f59e0b", fontSize: 16, marginBottom: 10 }}>★★★★★</div>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "#374151", margin: "0 0 12px" }}>&ldquo;{r.text}&rdquo;</p>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#9ca3af" }}>— {r.author}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: "80px 40px", background: blue, color: "#fff", textAlign: "center" }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, marginBottom: 12 }}>Demandez votre devis gratuit</h2>
        <p style={{ fontSize: 18, opacity: 0.9, marginBottom: 36 }}>Sans engagement — Réponse sous 24h</p>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", maxWidth: 500, margin: "0 auto", textAlign: "left", color: "#1a1a2e" }}>
          {[
            { label: "Nom", type: "text", placeholder: "Votre nom" },
            { label: "Téléphone", type: "tel", placeholder: "06 XX XX XX XX" },
            { label: "Email", type: "email", placeholder: "votre@email.fr" },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Description du besoin</label>
            <textarea placeholder="Décrivez votre projet..." rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <button style={{ width: "100%", background: blue, color: "#fff", padding: "14px", borderRadius: 8, border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Envoyer
          </button>
        </div>
        {address && (
          <p style={{ marginTop: 24, opacity: 0.7, fontSize: 15 }}>📍 {address} — {phone}</p>
        )}
      </section>

      {/* Footer */}
      <footer style={{ background: "#111827", color: "#fff", textAlign: "center", padding: "28px 24px" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{name}</div>
        <div style={{ opacity: 0.5, fontSize: 13 }}>{label} à {ville} — © {new Date().getFullYear()}</div>
      </footer>
    </div>
  );
}
