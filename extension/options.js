const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["appUrl", "extToken"]).then(({ appUrl, extToken }) => {
  if (appUrl) $("appUrl").value = appUrl;
  if (extToken) $("extToken").value = extToken;
});

$("save").addEventListener("click", async () => {
  const appUrl = $("appUrl").value.trim().replace(/\/$/, "");
  const extToken = $("extToken").value.trim();
  await chrome.storage.local.set({ appUrl, extToken });
  $("status").textContent = "Enregistré ✓";
  setTimeout(() => ($("status").textContent = ""), 1500);
});
