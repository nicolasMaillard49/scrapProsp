"use client";

// LE SHELL — rail vertical sur desktop, barre basse sur mobile.
//
// Avant, chaque écran portait sa propre barre de liens : la navigation
// changeait de forme et de place selon la page, et deux écrans n'exposaient pas
// les mêmes destinations. Un shell unique règle les deux problèmes d'un coup et
// libère le haut de chaque page pour ce qu'elle a vraiment à dire.
//
// Il se monte une fois, depuis le layout racine, et se retire lui-même des
// pages PUBLIQUES : le funnel, les maquettes clients et l'écran de connexion ne
// sont pas l'atelier, ils sont ce que le prospect voit. Y afficher la
// navigation interne serait une fuite.

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ListChecks, Map, CalendarDays, Users, MessageSquare, Filter, BarChart3,
} from "lucide-react";
// `lucide-react` v1 ne fournit plus les logos de marques : pas d'icône
// Instagram. On réutilise le glyphe maison plutôt que d'en faire une troisième
// copie dans le projet.
import { IgIcon } from "@/app/crm/ui";
import { appShellOffsetCss } from "@/app/lib/appShell";

/** Les espaces de travail. Cinq, pas douze : au-delà on ne choisit plus, on cherche. */
const ESPACES = [
  { href: "/", label: "Prospects", Icone: ListChecks, actif: (p: string) => p === "/" },
  { href: "/instagram", label: "Instagram", Icone: IgIcon, actif: (p: string) => p.startsWith("/instagram") },
  { href: "/crm", label: "Clients", Icone: Users, actif: (p: string) => p.startsWith("/crm") },
  { href: "/agenda", label: "Agenda", Icone: CalendarDays, actif: (p: string) => p.startsWith("/agenda") },
  { href: "/admin/funnel", label: "Funnel", Icone: Filter, actif: (p: string) => p.startsWith("/admin/funnel") },
] as const;

/** Destinations secondaires du rail contextuel — dépendent de l'espace courant. */
const CONTEXTE: Record<string, { href: string; label: string; Icone: typeof Map }[]> = {
  "/": [
    { href: "/carte", label: "Carte", Icone: Map },
    { href: "/vues", label: "Vues", Icone: BarChart3 },
    { href: "/sms", label: "SMS", Icone: MessageSquare },
  ],
  "/instagram": [
    { href: "/instagram/kpi", label: "KPI", Icone: BarChart3 },
    { href: "/instagram/prospection", label: "Prospection", Icone: ListChecks },
    { href: "/instagram/stats", label: "Stats", Icone: BarChart3 },
  ],
};

/** Les surfaces vues par un PROSPECT : jamais de navigation interne dessus. */
const PUBLIQUES = [
  /^\/login/,
  /^\/di\//,
  /^\/d\//,
  /^\/demo/,
  /^\/maquette/,
  /^\/eligibilite/,
  // Qualification d'un devis par l'artisan, ouverte depuis sa notification.
  // Il n'a rien à voir de notre outil interne.
  /^\/q\//,
  /^\/admin\/funnel\/live/,
];

export default function AppRail() {
  const path = usePathname() || "/";
  const publique = PUBLIQUES.some((r) => r.test(path));

  const espace = ESPACES.find((e) => e.actif(path));
  const secondaires = CONTEXTE[espace?.href ?? ""] ?? [];

  if (publique) return null;

  const decalage = appShellOffsetCss(secondaires.length > 0);

  return (
    <>
      {/* Le décalage de la PAGE ENTIÈRE voyage avec le rail. Il englobe aussi
          les headers sticky placés avant leur <main> (Instagram, KPI, Stats),
          qui sinon passeraient sous la navigation verticale. */}
      <style>{decalage}</style>

      {/* ── Desktop : rail fixe de 64 px ── */}
      <nav
        aria-label="Navigation principale"
        className="hidden min-[900px]:flex fixed left-0 top-0 bottom-0 z-40 w-16 flex-col items-center gap-1 py-3 border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-canvas-recessed)_88%,transparent)]"
      >
        <Link
          href="/"
          aria-label="Prospects Tracker — accueil"
          className="w-11 h-11 grid place-items-center rounded-[var(--radius-control)] mb-2"
        >
          {/* Le vrai logo de l'app, jamais une marque typographique de
              remplacement. Servi depuis `public/` : `app/icon.svg` est publié
              par Next avec une empreinte dans l'URL, donc introuvable à
              `/icon.svg` — le rail affichait une image cassée. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nmf.svg" alt="" className="w-9 h-9 object-contain" />
        </Link>

        {ESPACES.map(({ href, label, Icone, actif }) => {
          const ici = actif(path);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={ici ? "page" : undefined}
              className={`relative w-11 h-11 grid place-items-center rounded-[var(--radius-control)] transition-colors duration-200 ${
                ici
                  ? "text-[var(--color-accent-text)] bg-[var(--color-accent-soft)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              {/* L'état actif est porté par un indicateur ET une couleur : jamais
                  par la couleur seule. */}
              {ici && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[var(--color-accent)]" />}
              <Icone className="w-[18px] h-[18px]" />
            </Link>
          );
        })}
      </nav>

      {/* ── Desktop : rail contextuel, seulement là où il y a de quoi le remplir ── */}
      {secondaires.length > 0 && (
        <nav
          aria-label={`Navigation ${espace?.label}`}
          className="hidden min-[1200px]:flex fixed left-16 top-0 bottom-0 z-30 w-48 flex-col gap-1 p-3 border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] backdrop-blur-sm"
        >
          <div className="nmf-label px-2 py-2">{espace?.label}</div>
          {secondaires.map(({ href, label, Icone }) => {
            const ici = path === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={ici ? "page" : undefined}
                className={`flex items-center gap-2.5 min-h-11 px-3 rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-200 ${
                  ici
                    ? "text-[var(--color-accent-text)] bg-[var(--color-accent-soft)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                }`}
              >
                <Icone className="w-[17px] h-[17px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── Mobile : barre basse ── */}
      <nav
        aria-label="Navigation principale"
        className="min-[900px]:hidden fixed left-3 right-3 bottom-3 z-40 grid grid-cols-5 gap-1 p-1.5 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-solid)] safe-b"
        style={{ boxShadow: "var(--shadow-raised)" }}
      >
        {ESPACES.map(({ href, label, Icone, actif }) => {
          const ici = actif(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={ici ? "page" : undefined}
              className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-[16px] transition-colors duration-200 ${
                ici
                  ? "text-[var(--color-accent-text)] bg-[var(--color-accent-soft)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              <Icone className="w-[18px] h-[18px]" />
              <span className="text-[9.92px] font-semibold leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
