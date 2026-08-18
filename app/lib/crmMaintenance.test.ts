import test from "node:test";
import assert from "node:assert/strict";
import { maintenancesDues, maintenanceReminderEmail } from "./crmMaintenance";

const clients = [
  { id: "a", nom: "Alpha", maintenance_ht: 29, maintenance_day: 18 },
  { id: "b", nom: "Bravo", maintenance_ht: "49", maintenance_day: 18 },
  { id: "c", nom: "Charlie", maintenance_ht: 0, maintenance_day: 18 },
  { id: "d", nom: "Delta", maintenance_ht: 79, maintenance_day: 20 },
];

test("maintenancesDues sélectionne seulement les maintenances dues aujourd'hui à Paris", () => {
  const dues = maintenancesDues(clients, new Date("2026-08-18T06:00:00Z"));
  assert.deepEqual(dues.map((c) => c.id), ["a", "b"]);
  assert.equal(dues[0].due_date, "2026-08-18");
});

test("maintenancesDues rabat le 31 au dernier jour du mois", () => {
  const dues = maintenancesDues(
    [{ id: "x", nom: "Février", maintenance_ht: 29, maintenance_day: 31 }],
    new Date("2026-02-28T08:00:00Z"),
  );
  assert.equal(dues.length, 1);
});

test("maintenanceReminderEmail agrège les clients dans un seul rappel interne", () => {
  const email = maintenanceReminderEmail(maintenancesDues(clients, new Date("2026-08-18T06:00:00Z")));
  assert.match(email.subject, /2 maintenances/);
  assert.match(email.html, /Alpha/);
  assert.match(email.html, /29/);
  assert.match(email.html, /Bravo/);
});
