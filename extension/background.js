// Chrome : le clic sur l'icône ouvre le side panel. Gardé : Firefox n'a pas
// chrome.sidePanel (il a sidebar_action, déclaratif, rien à faire ici).
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
