/**
 * Re-consentement OAuth Google : produit un refresh token portant À LA FOIS
 * `adwords` et `datamanager`.
 *
 * Pourquoi. Depuis le 15/06/2026, l'import des conversions hors ligne passe par
 * la Data Manager API, qui exige le scope `datamanager`. Le jeton d'origine ne
 * portait que `adwords` — l'appel repart en 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT.
 * `adwords` reste nécessaire : campaign.ts et create.ts s'en servent toujours.
 * Un seul jeton pour les deux, plutôt qu'une deuxième variable à faire vivre.
 *
 *   node --env-file=.env.local scripts/google-oauth-consent.mjs
 *
 * Le script ouvre un serveur local sur http://localhost:8765, imprime l'URL de
 * consentement, puis ÉCRIT LUI-MÊME le jeton obtenu dans les deux endroits qui
 * le gardent :
 *   · D:\projets\scrapProsp\.env.local
 *   · D:\obsidian\MonCerveau\Credentials.md (le miroir du .env.local)
 *
 * Il ne l'affiche jamais en clair : un secret imprimé au terminal finit dans un
 * historique, un scrollback ou une transcription. Reste Vercel, à faire à la
 * main — la valeur est dans le vault, à recopier de là.
 *
 * PRÉALABLE, une fois pour toutes, dans la console Google Cloud du projet qui
 * porte GOOGLE_ADS_CLIENT_ID :
 *   1. activer l'API « Data Manager API » ;
 *   2. ajouter http://localhost:8765/oauth2callback aux URI de redirection
 *      autorisées du client OAuth.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const CIBLES = [
  "D:\\projets\\scrapProsp\\.env.local",
  "D:\\obsidian\\MonCerveau\\Credentials.md",
];

/**
 * Remplace la valeur de GOOGLE_ADS_REFRESH_TOKEN là où elle est déjà écrite.
 * On ne crée jamais la ligne : si elle manque, c'est que le fichier n'est pas
 * celui qu'on croit, et écrire à l'aveugle serait pire que de le dire.
 */
function poserJeton(chemin, jeton) {
  let contenu;
  try {
    contenu = readFileSync(chemin, "utf8");
  } catch {
    return `introuvable : ${chemin}`;
  }
  const motif = /^(GOOGLE_ADS_REFRESH_TOKEN=).*$/m;
  if (!motif.test(contenu)) return `aucune ligne GOOGLE_ADS_REFRESH_TOKEN dans ${chemin}`;
  writeFileSync(chemin, contenu.replace(motif, `$1${jeton}`));
  return null;
}

const REDIRECT = "http://localhost:8765/oauth2callback";
const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/datamanager",
];

const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET absents de l'environnement.");
  process.exit(1);
}

const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    /* `consent` force Google à réémettre un refresh token même si le compte a
     * déjà autorisé l'application — sans lui, on ne récupère qu'un access token
     * et le jeton périmé reste en place. */
    access_type: "offline",
    prompt: "consent",
  });

console.log("\nOuvre cette adresse dans le navigateur, connecté au compte qui gère le MCC :\n");
console.log(url);
console.log("\nEn attente du retour sur", REDIRECT, "…\n");

const server = createServer(async (req, res) => {
  const recu = new URL(req.url, "http://localhost:8765");
  if (recu.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }

  const erreur = recu.searchParams.get("error");
  if (erreur) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end(`Refusé : ${erreur}`);
    console.error("Consentement refusé :", erreur);
    server.close();
    process.exitCode = 1;
    return;
  }

  const code = recu.searchParams.get("code");
  const echange = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const jeton = await echange.json();

  if (!echange.ok || !jeton.refresh_token) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("Échec — voir le terminal.");
    console.error("Échange refusé :", JSON.stringify(jeton, null, 2));
    server.close();
    process.exitCode = 1;
    return;
  }

  res
    .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
    .end("C'est bon. Reviens au terminal, tu peux fermer cet onglet.");

  console.log("=== Scopes accordés ===");
  console.log((jeton.scope || "").split(" ").join("\n"));

  const manquant = ["https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/datamanager"]
    .filter((s) => !(jeton.scope || "").includes(s));
  if (manquant.length) {
    console.error("\n⚠ scope(s) NON accordé(s) :", manquant.join(", "));
    console.error("Le jeton est écrit quand même, mais la chaîne ne sera pas complète.");
  }

  console.log("\n=== Écriture du jeton ===");
  for (const cible of CIBLES) {
    const souci = poserJeton(cible, jeton.refresh_token);
    console.log(souci ? `  ✗ ${souci}` : `  ✓ ${cible}`);
    if (souci) process.exitCode = 1;
  }

  /* Un aperçu, pas la valeur : de quoi vérifier qu'on parle du même jeton sans
   * le déposer dans un historique de terminal. */
  const t = jeton.refresh_token;
  console.log(`\n  jeton posé : ${t.slice(0, 6)}…${t.slice(-4)} (${t.length} caractères)`);

  console.log("\nReste à faire à la main :");
  console.log("  · Vercel → projet scrapProsp → Settings → Environment Variables");
  console.log("    GOOGLE_ADS_REFRESH_TOKEN, valeur à recopier depuis Credentials.md");
  console.log("  · puis : node --env-file=.env.local scripts/check-conversions.mjs\n");

  server.close();
});

server.listen(8765);
