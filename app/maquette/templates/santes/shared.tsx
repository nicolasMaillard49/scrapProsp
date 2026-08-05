import type { TemplateProps } from "../data";
import {
  SANTE_KITS,
  santeKitFor,
  santeLabel,
  type SanteKey,
  type SanteKit,
  type SanteModule,
} from "../santeKits";
import { SHARED_CSS, daySlots, nextDays, seedOf } from "../niches/shared";

/* ──────────────────────────────────────────────────────────────
 * Pièces communes aux maquettes des professions libérales.
 *
 * Deux choses vivent ici et nulle part ailleurs :
 *
 *   - le sélecteur de créneaux, parce que c'est lui qui fait passer la maquette
 *     de 300 à 500 € et qu'il doit donc être réellement présent sur toutes les
 *     pages de santé — pas suggéré, pas dessiné à moitié ;
 *   - la dérivation du kit, avec le même repli que côté artisan : forcer un
 *     style depuis la télécommande ne doit jamais faire tomber la page.
 *
 * Ce qui n'est PAS ici : les avis. Les professions de santé n'ont pas le droit
 * d'afficher des témoignages de patients, et les avocats comme les notaires
 * s'en abstiennent. Leurs maquettes montrent des informations pratiques et des
 * questions fréquentes à la place — cf. `infos` et `faq` dans le kit.
 * ────────────────────────────────────────────────────────────── */

type ModuleOf<K extends SanteModule["kind"]> = Extract<SanteModule, { kind: K }>;

export interface SanteView<K extends SanteModule["kind"] = SanteModule["kind"]> {
  kit: SanteKit;
  module: ModuleOf<K>;
  label: string;
  tel: string;
  cityLabel: string;
  year: number;
  about: string;
  cats: string[];
  /** Empreinte stable : mêmes créneaux affichés à chaque ouverture. */
  seed: number;
}

export function santeView<K extends SanteModule["kind"]>(
  p: TemplateProps,
  kind: K,
  fallback: SanteKey,
): SanteView<K> {
  const matched = santeKitFor(p.metier);
  const kit = matched.module.kind === kind ? matched : SANTE_KITS[fallback];
  const cityLabel = p.ville && p.ville.trim() ? p.ville : "votre ville";
  const label = kit === matched ? santeLabel(p.metier) : santeLabel(fallback);
  return {
    kit,
    module: kit.module as ModuleOf<K>,
    label,
    tel: p.phone.replace(/\s/g, ""),
    cityLabel,
    year: new Date().getFullYear(),
    about: kit.aboutText.replaceAll("{ville}", cityLabel).replaceAll("{name}", p.name),
    cats: [...new Set(kit.services.map((s) => s.cat))],
    seed: seedOf(p.name + cityLabel),
  };
}

/** Prix d'un acte. Un tarif réglementé ou pris en charge n'est pas « 0 € ». */
export function santePrice(price: number, from?: boolean, unit?: string, label?: string): string {
  if (label) return label;
  if (price === 0) return "Offert";
  const n = Number.isInteger(price) ? price.toLocaleString("fr-FR") : price.toFixed(2).replace(".", ",");
  return `${from ? "dès " : ""}${n} €${unit ?? ""}`;
}

/* ── Le sélecteur de créneaux ───────────────────────────────── */

export interface SlotTheme {
  display: string;
  meta: string;
  metaSpacing: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  onAccent: string;
  panel: string;
  radius: number;
}

/**
 * L'agenda du cabinet.
 *
 * Quelques créneaux sont pris : un praticien dont l'agenda est entièrement vide
 * inquiète plus qu'il ne rassure. Le rendu est statique — c'est une maquette,
 * pas un moteur de réservation — mais il montre exactement ce que la prestation
 * « Site + réservation » installe derrière.
 */
export function SlotPicker({
  theme,
  seed,
  title,
  note,
  from = 9,
  to = 18,
  step = 30,
}: {
  theme: SlotTheme;
  seed: number;
  title: string;
  note: string;
  from?: number;
  to?: number;
  step?: number;
}) {
  const days = nextDays(5);
  const slots = daySlots(seed, from, to, step).slice(0, 12);
  const free = slots.filter((s) => !s.taken).length;

  const meta: React.CSSProperties = {
    fontFamily: theme.meta,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: theme.metaSpacing,
    color: theme.inkSoft,
  };

  return (
    <div
      id="rendez-vous"
      style={{
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        borderRadius: theme.radius,
        padding: 26,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: theme.display, fontSize: 22, color: theme.ink }}>{title}</span>
        <span style={{ ...meta, color: theme.accent }}>{free} créneaux</span>
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 20 }}>
        {days.map((d) => (
          <div
            key={`${d.label}-${d.num}`}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 0 11px",
              borderRadius: Math.min(theme.radius, 10),
              background: d.today ? theme.accent : "transparent",
              color: d.today ? theme.onAccent : theme.ink,
              border: `1px solid ${d.today ? theme.accent : theme.line}`,
            }}
          >
            <div style={{ ...meta, color: d.today ? theme.onAccent : theme.inkSoft, fontSize: 9 }}>{d.label}</div>
            <div style={{ fontFamily: theme.display, fontSize: 19, marginTop: 2 }}>{d.num}</div>
          </div>
        ))}
      </div>

      <div style={{ ...meta, marginTop: 20, marginBottom: 10 }}>Créneaux du jour</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
        {slots.map((s) => (
          <span
            key={s.time}
            className={`sa-slot${s.taken ? " is-taken" : ""}`}
            style={{
              textAlign: "center",
              padding: "10px 0",
              borderRadius: Math.min(theme.radius, 8),
              fontFamily: theme.meta,
              fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${s.taken ? "transparent" : theme.line}`,
              background: s.taken ? theme.line : "transparent",
              color: s.taken ? theme.inkSoft : theme.ink,
              textDecoration: s.taken ? "line-through" : "none",
              cursor: s.taken ? "default" : "pointer",
            }}
          >
            {s.time}
          </span>
        ))}
      </div>

      <p style={{ margin: "18px 0 0", fontFamily: theme.meta, fontSize: 13, lineHeight: 1.6, color: theme.inkSoft }}>
        {note}
      </p>
    </div>
  );
}

/** Média-queries et interactions communes. */
export const SANTE_CSS = `
  ${SHARED_CSS}
  .sa-slot { transition: background .15s ease, border-color .15s ease, color .15s ease; }
  .sa-faq { transition: border-color .15s ease; }
  @media (max-width: 980px) {
    .sa-two { grid-template-columns: 1fr !important; }
    .sa-three { grid-template-columns: 1fr !important; }
    .sa-four { grid-template-columns: 1fr 1fr !important; }
    .sa-nav { display: none !important; }
    .sa-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
`;
