/* ──────────────────────────────────────────────────────────────
 * Le portrait du professionnel.
 *
 * Sur ces métiers, on choisit d'abord une personne. Une maquette qui ne montre
 * que des chantiers ou des salles d'attente laisse le prospect se demander à
 * qui il va parler — et c'est exactement l'objection qui le fait raccrocher.
 *
 * Les portraits sont des images de synthèse, servies depuis /public/templates.
 * C'est assumé : ce sont des placeholders de maquette, au même titre que les
 * photos de banque d'images du reste de la page, et le bandeau de démo annonce
 * que tout est remplaçable. La légende ne prétend jamais qu'il s'agit du vrai
 * gérant : elle nomme le rôle, pas l'individu.
 * ────────────────────────────────────────────────────────────── */

export interface PortraitTheme {
  display: string;
  meta: string;
  metaSpacing: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  panel: string;
  /** Rayon du cadre. Un rond n'est pas toujours cohérent avec la DA. */
  radius: number;
}

/**
 * La photo du lieu, avec le portrait posé dessus.
 *
 * Première version : un médaillon de 78 px sous le paragraphe. Invisible —
 * personne ne descend jusque-là, et à cette taille un visage ne pèse rien. Le
 * portrait déborde donc maintenant de la photo de contexte, en 150 px, avec sa
 * légende dans le débord. On garde les deux images : le lieu situe, le visage
 * engage.
 */
export function AboutVisual({
  about,
  portrait,
  alt,
  name,
  role,
  theme,
  ratio = "4/3",
}: {
  about: string;
  portrait?: string;
  alt: string;
  name: string;
  role: string;
  theme: PortraitTheme;
  ratio?: string;
}) {
  const r = theme.radius > 40 ? 20 : Math.max(2, theme.radius);
  return (
    <figure style={{ margin: 0, position: "relative", paddingBottom: portrait ? 54 : 0 }}>
      <div style={{ borderRadius: r, overflow: "hidden", aspectRatio: ratio, background: theme.panel }}>
        <img src={about} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {portrait && (
        <div style={{ position: "absolute", left: 22, bottom: 0, display: "flex", alignItems: "flex-end", gap: 16 }}>
          <img
            src={portrait}
            alt={`${role} — ${name}`}
            width={150}
            height={188}
            loading="lazy"
            style={{
              width: 150,
              height: 188,
              objectFit: "cover",
              objectPosition: "50% 20%",
              borderRadius: r,
              border: `5px solid ${theme.panel}`,
              boxShadow: "0 18px 36px -22px rgba(0,0,0,0.55)",
              display: "block",
            }}
          />
          <figcaption style={{ paddingBottom: 12, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.meta,
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: theme.metaSpacing,
                color: theme.accent,
                marginBottom: 4,
              }}
            >
              Votre interlocuteur
            </div>
            <div style={{ fontFamily: theme.display, fontSize: 19, color: theme.ink, lineHeight: 1.2 }}>{name}</div>
            <div style={{ fontFamily: theme.meta, fontSize: 13.5, color: theme.inkSoft, marginTop: 2 }}>{role}</div>
          </figcaption>
        </div>
      )}
    </figure>
  );
}

export function PortraitCard({
  src,
  name,
  role,
  theme,
  /** Ligne de légende. Par défaut, le rôle suffit. */
  caption,
}: {
  src?: string;
  name: string;
  role: string;
  theme: PortraitTheme;
  caption?: string;
}) {
  if (!src) return null;
  return (
    <figure
      style={{
        margin: "28px 0 0",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 20px 16px 16px",
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        borderRadius: theme.radius,
      }}
    >
      <img
        src={src}
        alt={`${role} — ${name}`}
        width={78}
        height={78}
        loading="lazy"
        style={{
          width: 78,
          height: 78,
          objectFit: "cover",
          objectPosition: "50% 22%",
          borderRadius: theme.radius > 40 ? "50%" : Math.max(4, theme.radius - 4),
          flex: "0 0 auto",
        }}
      />
      <figcaption style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.meta,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: theme.metaSpacing,
            color: theme.accent,
            marginBottom: 5,
          }}
        >
          {caption ?? "Votre interlocuteur"}
        </div>
        <div style={{ fontFamily: theme.display, fontSize: 20, color: theme.ink, lineHeight: 1.2 }}>{name}</div>
        <div style={{ fontFamily: theme.meta, fontSize: 14, color: theme.inkSoft, marginTop: 3 }}>{role}</div>
      </figcaption>
    </figure>
  );
}
