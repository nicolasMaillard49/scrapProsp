/**
 * Cree le compte Google Ads de GP elec sous le MCC.
 *
 * Identite verifiee le 02/09/2026 a l'annuaire des entreprises de l'Etat avant
 * creation (recherche-entreprises.api.gouv.fr, SIREN 990 872 129) :
 *
 *   denomination      PIERRE GUILLE (GP ELECTRICITE GENERALE)
 *   forme juridique   1000 — Entrepreneur individuel  (ni SAS, ni SARL)
 *   SIRET siege       990 872 129 00012
 *   siege             6 rue de l'Yser, 49320 Brissac Loire Aubance
 *   activite          43.21A — installation electrique
 *   creation          02/09/2025
 *   etat              actif
 *   dirigeant         Pierre Guille, entrepreneur individuel
 *
 * Le SIRET affiche sur le site du client concorde avec le registre.
 *
 * Ce que ce script NE fait PAS, volontairement :
 *  · il n'invite personne — l'invitation part d'un geste separe, une fois le
 *    niveau d'acces tranche ;
 *  · il ne touche pas a la facturation — c'est le client qui saisit sa propre
 *    carte, personne d'autre ;
 *  · il ne cree aucune campagne, aucun budget, aucun mot-cle.
 *
 * DEVISE ET FUSEAU SONT DEFINITIFS. Google ne permet pas de les changer apres
 * creation : il faut ouvrir un autre compte. EUR / Europe/Paris.
 *
 *   node --import tsx scripts/gpelec-creer-compte.mjs          (dry-run, defaut)
 *   node --import tsx scripts/gpelec-creer-compte.mjs --go      (cree pour de vrai)
 */
import { readFileSync } from "fs";

/** .env.local du checkout + bloc GOOGLE_ADS_* du vault (absents du .env.local ici). */
const loadEnv = (path, filter = () => true) => {
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return 0; }
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(k) || !filter(k)) continue;
    if (process.env[k] === undefined) { process.env[k] = v; n++; }
  }
  return n;
};
loadEnv(new URL("../.env.local", import.meta.url));
const fromVault = loadEnv("C:/Users/n.maillard/Obsidian/Cerveau/Credentials.md", (k) => k.startsWith("GOOGLE_ADS_"));
console.log(`Credentials : ${fromVault} variables GOOGLE_ADS_* reprises du vault`);

const { GoogleAdsApi } = await import("google-ads-api");

const MCC = (process.env.GOOGLE_ADS_MCC_ID || "6711813801").replace(/-/g, "");
const GO = process.argv.includes("--go");

const NOM = "GP elec";
const DEVISE = "EUR";
const FUSEAU = "Europe/Paris";

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const manager = api.Customer({
  customer_id: MCC,
  login_customer_id: MCC,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

const existants = await manager.query(`
  SELECT
    customer_client.id,
    customer_client.descriptive_name,
    customer_client.currency_code,
    customer_client.time_zone,
    customer_client.manager,
    customer_client.status
  FROM customer_client
`);

console.log(`\n${existants.length} compte(s) sous le MCC ${MCC} :`);
for (const r of existants) {
  const c = r.customer_client;
  console.log(
    `  ${String(c.id).padEnd(12)} ${String(c.descriptive_name || "(sans nom)").padEnd(32)}` +
    ` ${String(c.currency_code || "?").padEnd(4)} ${String(c.time_zone || "?").padEnd(14)}` +
    `${c.manager ? " [manager]" : ""}`,
  );
}

/* Garde-fou : ne jamais creer deux fois le meme compte. */
const doublon = existants.find((l) =>
  /gp\s*elec|guille/i.test(l.customer_client.descriptive_name || ""),
);
if (doublon) {
  console.log(
    `\nUn compte correspondant existe deja : « ${doublon.customer_client.descriptive_name} »` +
    ` (${doublon.customer_client.id}). Rien a faire.`,
  );
  process.exit(0);
}

console.log(`\nA creer : « ${NOM} » — ${DEVISE}, ${FUSEAU}.`);
console.log(`  devise et fuseau sont DEFINITIFS, Google ne les change pas apres coup.`);

const res = await manager.customers.createCustomerClient({
  customer_id: MCC,
  customer_client: {
    descriptive_name: NOM,
    currency_code: DEVISE,
    time_zone: FUSEAU,
  },
  validate_only: !GO,
});

if (!GO) {
  console.log("\n--dry : RIEN N'A ETE CREE. La requete est valide cote Google.");
  console.log(JSON.stringify(res, null, 1).slice(0, 800));
  console.log("\nRelancer avec --go pour creer reellement.");
  process.exit(0);
}

console.log("\nCREE :", JSON.stringify(res, null, 1));
console.log("\nProchains gestes, volontairement separes et non automatises :");
console.log("  · inviter Pierre Guille au niveau d'acces retenu ;");
console.log("  · c'est LUI qui saisit sa carte, la facturation ne se delegue pas ;");
console.log("  · aucune campagne n'existe : le compte est vide, et c'est voulu.");
