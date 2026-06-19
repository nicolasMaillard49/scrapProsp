// Génération CSV — PUR (testable). Conventions Excel FR : séparateur `;` + BOM UTF-8
// (sinon Excel casse les accents). Échappement RFC 4180 (guillemets doublés).

function escapeCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Normalise les retours de ligne internes en espace (Excel gère mal le multi-ligne en cellule).
  s = s.replace(/\r?\n/g, " ").trim();
  if (s.includes('"') || s.includes(";") || s.includes(",")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/**
 * Construit un CSV (string) prêt à télécharger. `﻿` = BOM UTF-8 pour Excel FR.
 */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(";");
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(";"));
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}
