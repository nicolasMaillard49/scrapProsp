import { User, Users, Scale, BadgeCheck, Building2, CalendarDays } from "lucide-react";
import type { Prospect } from "../lib/types";

/** Codes catégorie juridique INSEE les plus fréquents chez les artisans. */
const NATURE_JURIDIQUE: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC",
  "5410": "SARL (éco. mixte)",
  "5485": "SELARL",
  "5499": "SARL",
  "5710": "SAS",
  "5720": "SASU",
  "6540": "SCI",
};

function natureLabel(code: string | null): string | null {
  if (!code) return null;
  return NATURE_JURIDIQUE[code] ?? `Forme ${code}`;
}

function formatDateFr(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

/** Bloc « Société » — identité légale du prospect (données SIRENE enrichies). */
export default function CompanyInfo({
  prospect,
  nowYear = new Date().getFullYear(),
}: {
  prospect: Prospect;
  nowYear?: number;
}) {
  const owner = [prospect.dirigeant_prenom, prospect.dirigeant_nom]
    .filter(Boolean)
    .join(" ")
    .trim();
  const ownerAge =
    prospect.dirigeant_annee_naissance != null
      ? nowYear - prospect.dirigeant_annee_naissance
      : null;
  const nature = natureLabel(prospect.nature_juridique);
  const created = formatDateFr(prospect.company_created_at);

  const hasAny =
    owner ||
    prospect.effectif_label ||
    prospect.categorie ||
    nature ||
    prospect.est_rge ||
    created;

  if (!hasAny) {
    return (
      <div className="mb-4 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/30 text-[11px] text-neutral-500">
        Société non identifiée dans la base SIRENE.
      </div>
    );
  }

  const formeLine = [nature, prospect.categorie].filter(Boolean).join(" · ");

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/60">
        <Building2 className="w-3.5 h-3.5 text-violet-300 shrink-0" />
        <span className="text-[12px] font-medium text-neutral-200">Société</span>
        <span className="text-[10px] text-neutral-500">· SIRENE</span>
        {prospect.est_rge === true && (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300">
            <BadgeCheck className="w-3 h-3" /> RGE
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-1.5 text-[12px]">
        {owner && (
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="text-neutral-200 font-medium">{owner}</span>
            {ownerAge != null && ownerAge > 0 && ownerAge < 110 && (
              <span
                className={`text-[11px] ${ownerAge >= 60 ? "text-amber-400" : "text-neutral-500"}`}
                title={ownerAge >= 60 ? "Dirigeant proche retraite — transmission possible" : undefined}
              >
                {ownerAge} ans{ownerAge >= 60 ? " ⚠" : ""}
              </span>
            )}
            <span className="text-[10px] text-neutral-600 ml-auto">dirigeant</span>
          </div>
        )}

        {prospect.effectif_label && (
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="text-neutral-300">{prospect.effectif_label}</span>
          </div>
        )}

        {formeLine && (
          <div className="flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="text-neutral-300">{formeLine}</span>
          </div>
        )}

        {created && (
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="text-neutral-300">Créée en {created}</span>
          </div>
        )}

        {prospect.siret && (
          <div className="text-[10px] text-neutral-600 font-mono pt-0.5">
            SIRET {prospect.siret}
          </div>
        )}
      </div>
    </div>
  );
}
