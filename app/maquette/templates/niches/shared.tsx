import type { OfferKind } from "../nicheKits";

/**
 * Ce dont le bloc d'offre a besoin, et rien de plus.
 *
 * Volontairement structurel : `NicheKit` comme `ArtisanKit` le satisfont sans
 * rien déclarer. C'est ce qui permet à une maquette de plombier et à une
 * maquette de coiffeur de partager le même bloc de prix sans partager leur
 * modèle de contenu, qui n'a aucune raison d'être le même.
 */
export interface OfferKit {
  offer: OfferKind;
  /** Nom du module de réservation dans la langue du métier. */
  bookingWord: string;
}

/* ──────────────────────────────────────────────────────────────
 * Pièces communes aux maquettes de niche.
 *
 * Ce qui est ici est ce qui doit rester IDENTIQUE d'un métier à l'autre : le
 * bandeau de démo, l'offre NMF, le crédit d'agence. Tout le reste — mise en
 * page, typographie, couleurs, module de réservation — appartient au métier et
 * vit dans son propre composant.
 *
 * L'offre est donc « thémée » plutôt que dupliquée : le message et le prix ne
 * bougent pas, l'habillage épouse la direction artistique de la page. Sinon on
 * recolle un bloc violet NMF en bas d'une page sable, et la maquette perd d'un
 * coup ce qu'elle venait de gagner.
 * ────────────────────────────────────────────────────────────── */

export interface OfferTheme {
  /** Fond de la section. */
  bg: string;
  /** Fond des cartes posées sur la section. */
  panel: string;
  ink: string;
  inkSoft: string;
  accent: string;
  /** Couleur du texte posé SUR l'accent. */
  onAccent: string;
  radius: number;
  border: string;
  shadow: string;
  /** Police des chiffres et titres. */
  display: string;
  /** Police des petites capitales / libellés. */
  meta: string;
  /** Interlettrage des libellés (les display condensés n'en veulent pas). */
  metaSpacing: string;
}

/** Prix de l'offre, en euros HT — cf. vault Agence : 300 vitrine / 500 réservation. */
export const OFFER_PRICE = { vitrine: 300, booking: 500 } as const;

/**
 * Récurrent mensuel annoncé avec chaque maquette, en euros HT.
 *
 * Il fait partie du prix au même titre que les 300 / 500 € : partout où on
 * annonce l'offre, on annonce les deux. Un montant unique ici évite que la
 * planche de contact et le bloc d'offre finissent par raconter deux choses.
 */
export const MAINTENANCE_PRICE = 29;

const MONTHLY = `puis ${MAINTENANCE_PRICE} €/mois — hébergement, maintenance et mises à jour inclus.`;

/* ── Aides de rendu ─────────────────────────────────────────── */

/** Empreinte stable d'une chaîne : mêmes créneaux affichés à chaque ouverture. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface Slot {
  time: string;
  taken: boolean;
}

/**
 * Créneaux plausibles d'une journée. Quelques-uns sont pris — un agenda
 * entièrement libre affiché sur la page d'un vrai commerce dit « personne ne
 * vient ici », c'est l'inverse de l'effet recherché.
 */
export function daySlots(seed: number, from = 9, to = 18, step = 45): Slot[] {
  const out: Slot[] = [];
  let minutes = from * 60;
  let i = 0;
  while (minutes <= to * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    out.push({
      time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      taken: ((seed >> (i % 12)) & 3) === 0,
    });
    minutes += step;
    i++;
  }
  return out;
}

/** Les 5 prochains jours ouvrés, libellés courts. */
export function nextDays(count = 5): Array<{ label: string; num: number; today: boolean }> {
  const NAMES = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const out = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const day = new Date(d.getTime() + i * 86_400_000);
    out.push({ label: NAMES[day.getDay()], num: day.getDate(), today: i === 0 });
  }
  return out;
}

export function priceLabel(price: number, from?: boolean): string {
  if (price === 0) return "Offert";
  return `${from ? "dès " : ""}${price} €`;
}

/* ── Étoiles ────────────────────────────────────────────────── */

export function Stars({
  value,
  color,
  stroke,
  size = 14,
}: {
  value: number;
  color: string;
  stroke?: string;
  size?: number;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? color : "none"}
          stroke={stroke ?? color}
          strokeWidth={1.5}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

/* ── Bandeau « c'est une démo » ─────────────────────────────── */

export function DemoBanner({ theme }: { theme: OfferTheme }) {
  return (
    <div
      style={{
        background: theme.ink,
        color: theme.panel,
        textAlign: "center",
        padding: "11px 24px",
        fontFamily: theme.meta,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      ✨ Démo gratuite — ce site est{" "}
      <strong style={{ color: theme.accent }}>entièrement modifiable à votre demande</strong> (textes,
      photos, couleurs). Dites-nous ce qu&apos;on change.
    </div>
  );
}

/* ── L'offre NMF ────────────────────────────────────────────── */

interface OfferProps {
  theme: OfferTheme;
  kit: OfferKit;
  /** Libellé métier ("Coiffeur") — sert à formuler la recherche Google. */
  label: string;
  ville: string;
}

/**
 * Le bloc de prix, en bas des démos publiques (nmfCredit).
 *
 * Le prix suit ce que la maquette MONTRE, pas le métier : une page avec module
 * de réservation s'annonce à 500 €, une vitrine à 300 €. C'est la règle qui
 * évite de découvrir l'écart au moment de facturer.
 */
export function OfferBlock({ theme, kit, label, ville }: OfferProps) {
  const booking = kit.offer === "booking";
  const price = booking ? OFFER_PRICE.booking : OFFER_PRICE.vitrine;

  const meta: React.CSSProperties = {
    fontFamily: theme.meta,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: theme.metaSpacing,
    color: theme.inkSoft,
  };

  const lead = booking
    ? `Le module que vous venez de voir, branché sur ${kit.bookingWord} : vos clients réservent seuls, à toute heure, et vous ne décrochez plus pour caler un créneau.`
    : `Vos photos, vos avis, vos horaires et votre téléphone à un clic — la page que les gens trouvent quand ils cherchent « ${label.toLowerCase()} ${ville} » sur Google.`;

  const proofs = booking
    ? [
        { k: "24 h/24", v: "des réservations pendant que vous travaillez" },
        { k: "−50 %", v: "de rendez-vous oubliés grâce aux rappels" },
        { k: "1 sem.", v: "de la commande à la mise en ligne" },
      ]
    : [
        { k: "24 h/24", v: "visible même quand c'est fermé" },
        { k: "+30 %", v: "de nouveaux clients via Google en moyenne" },
        { k: "48 h", v: "de la commande à la mise en ligne" },
      ];

  return (
    <section style={{ background: theme.bg, padding: "96px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ ...meta, marginBottom: 14 }}>Pourquoi ce site change quelque chose</div>
          <h2
            style={{
              fontFamily: theme.display,
              fontSize: 44,
              lineHeight: 1.1,
              margin: 0,
              color: theme.ink,
              fontWeight: 500,
            }}
          >
            {booking ? (
              <>
                Un carnet qui se remplit
                <br />
                sans vous interrompre.
              </>
            ) : (
              <>
                Une adresse qu&apos;on trouve,
                <br />
                des clients qui reviennent.
              </>
            )}
          </h2>
        </div>

        <div
          className="offer-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 44 }}
        >
          {proofs.map((p) => (
            <div
              key={p.k}
              style={{
                background: theme.panel,
                border: theme.border,
                borderRadius: theme.radius,
                boxShadow: theme.shadow,
                padding: "34px 26px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: theme.display,
                  fontSize: 44,
                  lineHeight: 1,
                  color: theme.accent,
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                {p.k}
              </div>
              <div style={{ color: theme.inkSoft, fontSize: 15, lineHeight: 1.55 }}>{p.v}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: theme.panel,
            border: theme.border,
            borderRadius: theme.radius,
            boxShadow: theme.shadow,
            padding: "40px 36px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 28,
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 260 }}>
            <div style={{ ...meta, color: theme.accent, marginBottom: 10 }}>
              {booking ? "Site + réservation en ligne" : "Site vitrine clé en main"}
            </div>
            <p style={{ margin: 0, color: theme.inkSoft, fontSize: 16, lineHeight: 1.65, maxWidth: 520 }}>
              {lead}
            </p>
          </div>
          <div className="offer-price" style={{ textAlign: "right", flex: "0 1 auto", minWidth: 0 }}>
            <div style={{ ...meta, marginBottom: 4 }}>À partir de</div>
            <div
              style={{
                fontFamily: theme.display,
                fontSize: 60,
                lineHeight: 1,
                color: theme.ink,
                fontWeight: 600,
              }}
            >
              {price}
              <span style={{ fontSize: 26, marginLeft: 4 }}>€ HT</span>
            </div>
            <div style={{ ...meta, marginTop: 10, textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
              {MONTHLY}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Crédit NMF ─────────────────────────────────────────────── */

export function NmfCredit() {
  const phone = process.env.NEXT_PUBLIC_NMF_PHONE;
  return (
    <div
      style={{
        background: "#000",
        padding: "14px 24px",
        textAlign: "center",
        fontFamily: "'Space Mono', monospace",
        fontSize: 12,
        color: "rgba(255,255,255,0.55)",
        lineHeight: 1.7,
      }}
    >
      Démo créée par{" "}
      <a
        href="https://www.nmf-agence.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#E8916F", textDecoration: "none", fontWeight: 700 }}
      >
        NMF Agence
      </a>
      {phone ? (
        <>
          {" · "}
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            style={{ color: "#E8916F", textDecoration: "none", fontWeight: 700 }}
          >
            {phone}
          </a>
        </>
      ) : null}
      <br />
      <span style={{ color: "rgba(255,255,255,0.4)" }}>
        Aperçu gratuit et sans engagement — entièrement personnalisable à votre demande.
      </span>
    </div>
  );
}

/** Média-queries partagées par les maquettes de niche (grilles → 1 colonne). */
export const SHARED_CSS = `
  .offer-grid { }
  @media (max-width: 860px) {
    .offer-grid { grid-template-columns: 1fr !important; }
    /* Empilé sous le texte : le prix se relit à gauche, comme le reste de la carte. */
    .offer-price { text-align: left !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }
`;
