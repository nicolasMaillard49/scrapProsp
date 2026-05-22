import { ageBadge } from "../lib/sirene";
import type { Prospect } from "../lib/types";

type Size = "xs" | "sm" | "md";

const sizeCls: Record<Size, string> = {
  xs: "text-[10px] uppercase tracking-wider px-1.5 py-0.5",
  sm: "text-[11px] px-2 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export default function AgeBadge({
  prospect,
  size = "sm",
  showSiret = false,
}: {
  prospect: Prospect;
  size?: Size;
  showSiret?: boolean;
}) {
  const b = ageBadge(prospect);
  if (!b) return null;

  const title = prospect.created_at
    ? `Créée le ${prospect.created_at}${showSiret && prospect.siret ? ` · SIRET ${prospect.siret}` : ""}`
    : undefined;

  return (
    <span className={`rounded ${sizeCls[size]} ${b.cls}`} title={title}>
      {b.emoji ? <span className="mr-1">{b.emoji}</span> : null}
      {b.label}
    </span>
  );
}
