import type { TemplateProps } from "../data";
import { metierLabel } from "../data";
import {
  ARTISAN_KITS,
  artisanKitFor,
  type ArtisanKey,
  type ArtisanKit,
  type ArtisanModule,
} from "../artisanKits";
import { SHARED_CSS } from "../niches/shared";

/* ──────────────────────────────────────────────────────────────
 * Pièces communes aux maquettes artisan.
 *
 * Volontairement maigre : ce qui est ici, c'est ce qu'AUCUNE direction
 * artistique n'a de raison de faire différemment (dériver le libellé métier,
 * remplacer les placeholders, formater un prix). La mise en page, elle, reste
 * entière dans chaque composant — c'est tout l'intérêt d'avoir une DA par
 * métier plutôt qu'un gabarit repeint.
 * ────────────────────────────────────────────────────────────── */

type ModuleOf<K extends ArtisanModule["kind"]> = Extract<ArtisanModule, { kind: K }>;

export interface ArtisanView<K extends ArtisanModule["kind"] = ArtisanModule["kind"]> {
  kit: ArtisanKit;
  /** Le module de la DA, déjà réduit au bon variant. */
  module: ModuleOf<K>;
  /** Libellé métier affichable ("Plombier"). */
  label: string;
  /** Téléphone sans espaces, pour href="tel:". */
  tel: string;
  cityLabel: string;
  year: number;
  avg: number;
  reviewCount: number;
  /** Paragraphe à-propos, placeholders remplacés. */
  about: string;
  /** Catégories de prestations, dans l'ordre d'apparition. */
  cats: string[];
}

/**
 * Dérive tout ce que les maquettes artisan recalculeraient sinon à l'identique.
 *
 * `kind` est le module attendu par la direction artistique appelante. Si le
 * métier du prospect n'a pas ce module — ce qui arrive dès qu'on force un style
 * depuis la télécommande pendant un appel, par exemple un menuisier affiché sur
 * la fiche d'un coiffeur —, on retombe sur le kit de référence de la DA plutôt
 * que d'échouer : une maquette qui plante en plein rendez-vous coûte plus cher
 * qu'une maquette qui montre le mauvais métier.
 */
export function artisanView<K extends ArtisanModule["kind"]>(
  p: TemplateProps,
  kind: K,
  fallback: ArtisanKey,
): ArtisanView<K> {
  const matched = artisanKitFor(p.metier);
  const kit = matched.module.kind === kind ? matched : ARTISAN_KITS[fallback];
  const fallbackLabel = metierLabel(fallback);
  const cityLabel = p.ville && p.ville.trim() ? p.ville : "votre ville";
  return {
    kit,
    module: kit.module as ModuleOf<K>,
    label: metierLabel(p.metier || fallbackLabel),
    tel: p.phone.replace(/\s/g, ""),
    cityLabel,
    year: new Date().getFullYear(),
    avg: p.rating ?? 4.8,
    reviewCount: p.reviews ?? 74,
    about: kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", p.name),
    cats: [...new Set(kit.services.map((s) => s.cat))],
  };
}

/**
 * Prix d'une prestation artisan.
 *
 * Le 0 vaut « Offert » — un devis gratuit affiché « 0 € » se lit comme une
 * erreur de saisie, pas comme un argument.
 */
export function artisanPrice(price: number, from?: boolean, unit?: string): string {
  if (price === 0) return "Offert";
  return `${from ? "dès " : ""}${price.toLocaleString("fr-FR")} €${unit ?? ""}`;
}

/* ── Le numéro ──────────────────────────────────────────────────
 *
 * Un artisan ne se choisit pas par formulaire : on l'appelle. Le numéro est
 * donc le seul élément présent trois fois sur la page — dans l'en-tête, en
 * grand dans le hero, et sur une barre qui ne quitte jamais le bas de l'écran.
 * C'est le contraire des sites d'artisan habituels, où il faut scroller
 * jusqu'au pied de page pour le trouver.
 * ────────────────────────────────────────────────────────────── */

export interface CallTheme {
  /** Police des chiffres. */
  display: string;
  /** Police des libellés. */
  meta: string;
  accent: string;
  /** Texte posé sur l'accent. */
  onAccent: string;
  /** Interlettrage des libellés. */
  metaSpacing?: string;
  /** Couleur du bloc du hero (bordure + libellé). */
  line: string;
  ink: string;
  inkSoft: string;
  radius: number;
}

/** Le numéro en grand, à placer dans le hero à côté du bouton principal. */
export function HeroCall({
  phone,
  tel,
  theme,
  label = "Appelez maintenant",
}: {
  phone: string;
  tel: string;
  theme: CallTheme;
  label?: string;
}) {
  if (!phone) return null;
  return (
    <a
      href={`tel:${tel}`}
      className="ar-herocall"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        border: `1px solid ${theme.line}`,
        borderRadius: theme.radius,
        padding: "10px 20px 12px",
        textDecoration: "none",
        color: theme.ink,
      }}
    >
      <span
        style={{
          fontFamily: theme.meta,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: theme.metaSpacing ?? "0.16em",
          color: theme.inkSoft,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: theme.display,
          fontSize: 34,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: theme.accent,
          whiteSpace: "nowrap",
        }}
      >
        {phone}
      </span>
    </a>
  );
}

/**
 * La barre d'appel collée en bas de l'écran.
 *
 * Elle reste visible sur toute la page, sur mobile comme sur ordinateur : le
 * moment où quelqu'un décide d'appeler n'est jamais le moment où il est en haut
 * de la page. Le `paddingBottom` du document (cf. ARTISAN_CSS) réserve sa
 * hauteur pour qu'elle ne recouvre pas le pied de page.
 */
export function StickyCall({
  phone,
  tel,
  theme,
  note,
}: {
  phone: string;
  tel: string;
  theme: CallTheme;
  /** Argument court à droite du numéro (délai, gratuité du devis…). */
  note?: string;
}) {
  if (!phone) return null;
  return (
    <a
      href={`tel:${tel}`}
      className="ar-stickycall"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        flexWrap: "wrap",
        background: theme.accent,
        color: theme.onAccent,
        padding: "12px 20px",
        textDecoration: "none",
        boxShadow: "0 -10px 30px -18px rgba(0,0,0,0.6)",
      }}
    >
      <span
        style={{
          fontFamily: theme.meta,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: theme.metaSpacing ?? "0.16em",
          opacity: 0.85,
        }}
      >
        Appelez maintenant
      </span>
      <span
        style={{
          fontFamily: theme.display,
          fontSize: 30,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {phone}
      </span>
      {note && (
        <span className="ar-callnote" style={{ fontFamily: theme.meta, fontSize: 14, opacity: 0.9 }}>
          {note}
        </span>
      )}
    </a>
  );
}

/** Média-queries communes (les grilles retombent en une colonne). */
export const ARTISAN_CSS = `
  ${SHARED_CSS}
  .ar-stickycall { transition: filter .15s ease; }
  .ar-stickycall:hover { filter: brightness(1.08); }
  .ar-herocall { transition: border-color .15s ease, transform .15s ease; }
  .ar-herocall:hover { transform: translateY(-2px); }
  @media (max-width: 980px) {
    .ar-two { grid-template-columns: 1fr !important; }
    .ar-three { grid-template-columns: 1fr !important; }
    .ar-four { grid-template-columns: 1fr 1fr !important; }
    .ar-nav { display: none !important; }
    .ar-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .ar-callnote { display: none !important; }
  }
`;
