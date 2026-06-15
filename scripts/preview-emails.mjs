// Génère les emails du funnel en fichiers HTML autonomes (à ouvrir au navigateur).
// Usage : node --import tsx scripts/preview-emails.mjs
import { mkdirSync, writeFileSync } from "fs";

const { confirmationEmailHtml, launchEmailHtml } = await import("../app/lib/eligibilite.ts");

const sample = {
  id: "demo",
  first_name: "Jean",
  metier: "plombier",
  ville: "Tours",
  service_cible: "Débouchage canalisation urgence",
  budget_daily: 25,
  budget_monthly: 760,
  calls_per_month: 56,
  revenue_month: 3920,
};

const outDir = new URL("../previews/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const c = confirmationEmailHtml(sample);
const l = launchEmailHtml(sample);

const wrap = (subject, html) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${subject}</title></head>` +
  `<body style="margin:0"><div style="background:#e5e5e5;padding:12px;font:13px Arial;color:#333">` +
  `Objet : <b>${subject}</b></div>${html}</body></html>`;

writeFileSync(new URL("email-1-confirmation.html", outDir), wrap(c.subject, c.html));
writeFileSync(new URL("email-2-lancement.html", outDir), wrap(l.subject, l.html));

console.log("✓ Emails générés dans previews/ :");
console.log("  - previews/email-1-confirmation.html  —", c.subject);
console.log("  - previews/email-2-lancement.html     —", l.subject);
