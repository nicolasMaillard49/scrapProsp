const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["appUrl", "extToken", "links"]).then(({ appUrl, extToken, links }) => {
  if (appUrl) $("appUrl").value = appUrl;
  if (extToken) $("extToken").value = extToken;
  // Champ vide = liste par défaut : on la montre telle quelle, sinon on croit
  // n'avoir aucun lien et on repart de zéro.
  const list = Array.isArray(links) && links.length ? links : NMFUtil.DEFAULT_LINKS;
  $("links").value = NMFUtil.serializeLinks(list);
});

$("save").addEventListener("click", async () => {
  const appUrl = $("appUrl").value.trim().replace(/\/$/, "");
  const extToken = $("extToken").value.trim();
  const raw = $("links").value;
  const links = NMFUtil.parseLinks(raw);

  // Une ligne écartée est SIGNALÉE : un lien tronqué, on ne s'en aperçoit
  // qu'une fois qu'il est collé dans un DM parti.
  const written = raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#")).length;
  $("linksHint").textContent =
    written > links.length ? `${written - links.length} ligne(s) ignorée(s) — il faut une URL en https://` : "";

  await chrome.storage.local.set({ appUrl, extToken, links });
  $("status").textContent = "Enregistré ✓";
  setTimeout(() => ($("status").textContent = ""), 1500);
});
