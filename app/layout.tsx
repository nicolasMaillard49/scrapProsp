import "./globals.css";
import type { Metadata, Viewport } from "next";
import ThemeToggle from "./components/ThemeToggle";
import AppRail from "./components/nmf/AppRail";

// Aucune police chargée : la DA Atelier NMF impose UNE famille, Helvetica Neue,
// avec un repli métriquement compatible (Arial, Liberation Sans). Une police
// distante, c'est un aller-retour réseau et un flash de texte pour un résultat
// que le système rend déjà — et une seconde famille est interdite par la DA.
// La pile exacte vit dans `globals.css` (`--font-sans`).

export const metadata: Metadata = {
  title: "Prospects Tracker",
  description: "Suivi des appels de prospection",
  manifest: "/manifest.webmanifest",
  // Sans `apple-icon.png` (émis par app/apple-icon.png), l'ajout à l'écran
  // d'accueil iPhone retombe sur la première lettre du titre — le « P ».
  appleWebApp: { capable: true, title: "Prospects" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Passe sous l'encoche / les coins arrondis des téléphones (couplé aux
  // paddings env(safe-area-inset-*) dans globals.css).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6ebf2" },
    { media: "(prefers-color-scheme: dark)", color: "#080817" },
  ],
};

/**
 * Le thème est résolu AVANT le rendu, dans le `<head>`.
 *
 * Trois valeurs possibles — `system`, `dark`, `light` — dont `system` par
 * défaut. Poser la classe après l'hydratation ferait clignoter l'app en clair
 * pendant un instant à chaque chargement ; c'est le seul flash que l'utilisateur
 * remarque vraiment.
 *
 * On pose À LA FOIS `data-theme` (le contrat de la DA) et la classe `.dark`
 * (dont dépend le variant `dark:` de Tailwind dans toute l'app) : les deux
 * décrivent le même état, en retirer une casserait la moitié des écrans.
 */
const BOOT_THEME = `(function(){try{
var p=localStorage.getItem("theme")||"system";
var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme:dark)").matches);
var r=document.documentElement;
r.classList.toggle("dark",d);
r.setAttribute("data-theme",d?"dark":"light");
}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_THEME }} />
      </head>
      <body>
        <a href="#contenu" className="skip-link">Aller au contenu</a>
        <AppRail />
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
