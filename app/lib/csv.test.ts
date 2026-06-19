import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv";

interface Row {
  name: string;
  note: string;
  n: number | null;
}

const cols = [
  { header: "Nom", value: (r: Row) => r.name },
  { header: "Note", value: (r: Row) => r.note },
  { header: "N", value: (r: Row) => r.n },
];

test("toCsv: BOM UTF-8, séparateur ; et en-tête", () => {
  const csv = toCsv(cols, [{ name: "Jean", note: "ok", n: 3 }]);
  assert.ok(csv.startsWith("﻿"), "doit commencer par le BOM");
  assert.match(csv, /Nom;Note;N\r\n/);
  assert.match(csv, /Jean;ok;3\r\n/);
});

test("toCsv: échappe ; , et guillemets ; aplati les sauts de ligne", () => {
  const csv = toCsv(cols, [{ name: 'a;b', note: 'dit "bonjour"', n: null }]);
  assert.match(csv, /"a;b";"dit ""bonjour""";\r\n/);
  const csv2 = toCsv(cols, [{ name: "ligne1\nligne2", note: "", n: 0 }]);
  assert.match(csv2, /ligne1 ligne2;;0/);
});

test("toCsv: null/undefined → cellule vide", () => {
  const csv = toCsv(cols, [{ name: "", note: "", n: null }]);
  assert.match(csv, /\r\n;;\r\n/);
});
