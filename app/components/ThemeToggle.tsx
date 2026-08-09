"use client";

// Le contrôle de thème — Système / Sombre / Clair.
//
// Trois positions et pas deux : « système » est le défaut de la DA, et c'est le
// seul choix qui suit l'utilisateur quand son téléphone bascule en sombre le
// soir. Un simple interrupteur force un choix définitif dès le premier clic et
// coupe ce lien pour toujours.
//
// L'état vit dans le DOM (`data-theme` + classe `.dark`) et dans
// `localStorage` ; le composant ne fait que l'écrire — c'est le script du
// `<head>` qui le résout au chargement, avant le premier pixel.

import { useCallback, useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Pref = "system" | "dark" | "light";

const ORDRE: Pref[] = ["system", "dark", "light"];

const LIBELLE: Record<Pref, string> = {
  system: "Thème : système",
  dark: "Thème : sombre",
  light: "Thème : clair",
};

/** Ce que la préférence donne À L'ÉCRAN, une fois le système consulté. */
function resolu(p: Pref): boolean {
  if (p === "dark") return true;
  if (p === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function appliquer(p: Pref) {
  const sombre = resolu(p);
  const r = document.documentElement;
  r.classList.toggle("dark", sombre);
  r.setAttribute("data-theme", sombre ? "dark" : "light");
}

export default function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("system");
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const stocke = (localStorage.getItem("theme") as Pref | null) ?? "system";
    const p: Pref = ORDRE.includes(stocke) ? stocke : "system";
    setPref(p);
    appliquer(p);
    setMonte(true);
  }, []);

  // En mode « système », l'app suit l'OS EN DIRECT : rebasculer le téléphone en
  // sombre à 21 h doit changer l'écran ouvert, pas le prochain chargement.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const suivre = () => appliquer("system");
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, [pref]);

  const suivant = useCallback(() => {
    const p = ORDRE[(ORDRE.indexOf(pref) + 1) % ORDRE.length];
    setPref(p);
    appliquer(p);
    localStorage.setItem("theme", p);
  }, [pref]);

  if (!monte) return null;

  const Icone = pref === "system" ? Monitor : pref === "dark" ? Moon : Sun;

  return (
    <button
      onClick={suivant}
      aria-label={`${LIBELLE[pref]} — changer`}
      title={LIBELLE[pref]}
      style={{ position: "fixed", bottom: 16, right: 16, zIndex: 60 }}
      className="w-10 h-10 grid place-items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-solid)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/50 active:scale-[0.97] transition-[color,border-color,transform] duration-200"
    >
      <Icone className="w-[18px] h-[18px]" />
    </button>
  );
}
