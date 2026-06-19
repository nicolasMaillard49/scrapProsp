/**
 * Message lisible depuis une erreur google-ads-api. La lib lève souvent un objet
 * (non-Error) de forme { errors: [{ message, error_code }] } → String() donnait
 * "[object Object]". On extrait le détail exploitable.
 *
 * Un mutateResources atomique renvoie souvent 1 vraie erreur + N « Resource was
 * not found » (cascade des resource names temporaires). On indexe par opération
 * + champ, on dédoublonne, et on remonte la vraie cause en tête.
 */
export function describeAdsError(e: unknown): string {
  const x = e as {
    errors?: Array<{
      message?: string;
      error_code?: unknown;
      location?: {
        operation_index?: number | string;
        field_path_elements?: Array<{ field_name?: string; index?: number | string }>;
      };
    }>;
    message?: string;
  };
  if (Array.isArray(x?.errors) && x.errors.length) {
    const seen = new Map<string, { label: string; count: number }>();
    for (const er of x.errors) {
      const loc = er.location;
      const opIdx =
        loc?.operation_index ??
        loc?.field_path_elements?.find((f) => f.field_name === "operations")?.index;
      const fields = (loc?.field_path_elements ?? [])
        .filter((f) => f.field_name && f.field_name !== "operations")
        .map((f) => f.field_name)
        .join(".");
      const base = er.message || (er.error_code ? JSON.stringify(er.error_code) : JSON.stringify(er));
      const label = `${opIdx != null ? `op#${opIdx} ` : ""}${fields ? `${fields}: ` : ""}${base}`;
      const key = `${base}|${fields}`;
      const prev = seen.get(key);
      if (prev) prev.count++;
      else seen.set(key, { label, count: 1 });
    }
    return [...seen.values()]
      .sort((a, b) => (/not found|introuv/i.test(a.label) ? 1 : 0) - (/not found|introuv/i.test(b.label) ? 1 : 0))
      .map((en) => (en.count > 1 ? `${en.label} (×${en.count})` : en.label))
      .join(" | ");
  }
  if (e instanceof Error) return e.message;
  if (x?.message) return x.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
