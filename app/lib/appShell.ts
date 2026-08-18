/**
 * Décalage du shell applicatif par rapport aux rails fixes.
 *
 * Le sélecteur porte volontairement sur le conteneur de page complet : plusieurs
 * écrans ont un header sticky placé avant leur <main>. Décaler uniquement main
 * laisserait donc leur barre horizontale sous la navigation verticale.
 */
export function appShellOffsetCss(hasSecondaryNav: boolean): string {
  return `
    .app-shell-content { padding-bottom: 96px; }
    @media (min-width: 900px) {
      .app-shell-content { padding-left: 84px; padding-bottom: 0; }
    }
    ${hasSecondaryNav ? `@media (min-width: 1200px) { .app-shell-content { padding-left: 280px; } }` : ""}
  `;
}
