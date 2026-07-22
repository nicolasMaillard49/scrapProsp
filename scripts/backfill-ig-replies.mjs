// Backfill des réponses entrantes lues dans l'inbox Instagram (vague du 17/07 au 22/07).
// Source : lecture thread par thread via Claude in Chrome, 2026-07-22.
// received_at : horodatage du 1er M2 quand il existe (c'est le moment où on a vu la
// réponse), sinon le dernier DM du prospect. Pas d'invention de date.

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

// username → [{ kind, excerpt }]  (ordre chronologique)
const REPLIES = {
  mercimadyformation: [
    { kind: "neutre", excerpt: "Bonjour, pas exactement je suis formatrice dans le domaine de la beauté" },
    { kind: "neutre", excerpt: "Je suis toujours preneuse de critiques constructives mais votre spécialité c'est le marketing digital ?" },
    { kind: "neutre", excerpt: "j'ai actuellement un community manager 1500€ TTC, pouvez-vous faire mieux ? 12 vidéos + 4 carrousels" },
  ],
  "lafabrike.agde": [
    { kind: "neutre", excerpt: "Hello, Oui" },
    { kind: "refus", excerpt: "Bonjour, nous ne sommes pas intéressé Cordialement" },
  ],
  boucherie_sam_may: [{ kind: "neutre", excerpt: "Bonjour oui toujours (+ réaction 👍)" }],
  pottiezrenovconcept: [
    { kind: "neutre", excerpt: "Bonjour, oui toujours." },
    { kind: "neutre", excerpt: "Je n'ai pas vraiment le temps pour les réseaux, ma clientèle est assez aisée" },
    { kind: "positive", excerpt: "On peut organiser un rendez-vous à mon siège social pour une rencontre" },
  ],
  terre_lointaine_pepinieres: [{ kind: "neutre", excerpt: "Bonjour Oui toujours. Bonne journée" }],
  michel_renovation_talence: [{ kind: "neutre", excerpt: "Bonjours oui toujours" }],
  univrbois: [
    { kind: "neutre", excerpt: "Bonjour oui" },
    { kind: "neutre", excerpt: "Hum ok" },
  ],
  "watts.up_": [
    { kind: "refus", excerpt: "oui mais je n'ai pas besoin de site pour l'instant je n'ai pas d'argent à mettre là-dedans" },
    { kind: "neutre", excerpt: "oui pas de problème, tout conseil est bon à prendre je vous remercie" },
  ],
  "julie.esthetique2b": [
    { kind: "neutre", excerpt: "Bonjour, oui toujours le cas" },
    { kind: "neutre", excerpt: "Ah super ! Je vous écoute" },
    { kind: "neutre", excerpt: "Ah oui ça m'intéresse d'avoir un avis extérieur" },
    { kind: "neutre", excerpt: "Un peu moins d'un an / La recherche de nouveaux clients (découverte M5-M6)" },
  ],
  "vbr.caroline": [{ kind: "neutre", excerpt: "Bonjour oui tout à fait" }],
  boisfeuilleciseaux: [{ kind: "neutre", excerpt: "Bonjour, Oui, nous sommes une menuiserie" }],
  hilarone: [
    { kind: "neutre", excerpt: "Bonjour Oui tout à fait je suis en activité / de quelles pistes de réflexion ?" },
    { kind: "refus", excerpt: "Enchanté Nicolas, tu voudrais me proposer tes services ? Je ne veux pas te faire perdre du temps" },
  ],
  menuiserieboisbodin: [
    { kind: "neutre", excerpt: "Bonjour, oui" },
    { kind: "refus", excerpt: "Je ne suis pas intéressé par ce type de démarchage" },
  ],
  tiana_nails22: [
    { kind: "neutre", excerpt: "Bonjour, oui / J'écoute" },
    { kind: "refus", excerpt: "Non, merci" },
  ],
  "ma2moiselle.m": [
    { kind: "neutre", excerpt: "Bonjour, Oui, je suis toujours en activité. En quoi puis-je vous être utile ?" },
    { kind: "refus", excerpt: "Je préfère décliner votre proposition et je ne souhaite pas échanger" },
  ],
  lailabeauty74_: [
    { kind: "neutre", excerpt: "Bonjour oui" },
    { kind: "neutre", excerpt: "Oui expliquer moi" },
  ],
  beautedinterieur: [
    { kind: "neutre", excerpt: "Bonjour oui nous sommes en activité" },
    { kind: "refus", excerpt: "si c'est pour vendre un service ou produit nous ne sommes pas intéressés" },
  ],
  sunnails01851: [{ kind: "neutre", excerpt: "Bonjour, Prothésiste ongulaire et salon de massages. Cdlt" }],
  toto_wood: [
    { kind: "neutre", excerpt: "Bonjour, oui toujours le cas" },
    { kind: "positive", excerpt: "J'ai vu votre vidéo sur les Ads, je suis en plein questionnement sur ça justement" },
    { kind: "positive", excerpt: "Oui sans problème, je peux vous appeler d'ici 15-20 minutes ? → créneau demain 17h accepté" },
  ],
  sebon_restaurant: [
    { kind: "neutre", excerpt: "Bonjour Oui c'est le cas" },
    { kind: "neutre", excerpt: "Je suis Sébastien, chef de cuisine et propriétaire, je vous remercie de votre intérêt (+ vocal)" },
  ],
  atelierpillet: [{ kind: "refus", excerpt: "« Non je n'ai jamais été menuisier » puis « T'es une IA ou quoi ? » (thread supprimé depuis)" }],
  herea_skin_body_cryo_lucciana: [
    { kind: "neutre", excerpt: "Bonjour oui" },
    { kind: "refus", excerpt: "J'ai déjà un site merci je n'ai besoin de rien" },
  ],
  "ssaf.beauty": [{ kind: "neutre", excerpt: "bonjour oui" }],
  adelinemaisonetjardin: [
    { kind: "neutre", excerpt: "Bonjour Oui bien sûr !" },
    { kind: "neutre", excerpt: "C'est pour quoi exactement ?" },
    { kind: "neutre", excerpt: "Si vous voulez" },
  ],
  jardin_medoc: [
    { kind: "refus", excerpt: "oui c'est toujours le cas. Je préfère vous informer que je ne suis intéressé par aucun démarchage" },
    { kind: "refus", excerpt: "Je préfère pas vous faire perdre votre temps, désolé." },
  ],
  _divalya: [
    { kind: "neutre", excerpt: "Bonjour, oui toujours / Oui bien sûr pourquoi pas" },
    { kind: "refus", excerpt: "j'ai planity qui m'aide bcp et mon planning est très largement chargé voire plein" },
  ],
  lioneldbois: [
    { kind: "neutre", excerpt: "Bonjour, Oui tout à fait / C'est à dire ?" },
    { kind: "neutre", excerpt: "j'ai quelqu'un qui s'occupe déjà de mon digital merci" },
    { kind: "neutre", excerpt: "Oui bien entendu je ne suis pas contre de voir votre point de vue de pro (+ découverte M5-M6)" },
  ],
  florianbourgine_atelier: [{ kind: "refus", excerpt: "Refus (thread supprimé — marqué perdu le jour même, contenu non relisible)" }],
  vibe_nails912: [{ kind: "neutre", excerpt: "Salut oui bien sûr" }],
};

// Prospects dont le refus n'était pas encore répercuté dans le pipeline.
const A_PASSER_PERDU = ["lafabrike.agde", "watts.up_", "herea_skin_body_cryo_lucciana"];

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

let inserted = 0, skippedExisting = 0;
const notFound = [];

for (const [username, replies] of Object.entries(REPLIES)) {
  const { rows } = await client.query(
    `select p.id,
            (select min(sent_at) from ig_dm_log where prospect_id = p.id and step = 'M2') as m2_at,
            p.last_dm_at
     from instagram_prospects p where p.username = $1`,
    [username],
  );
  if (!rows.length) { notFound.push(username); continue; }
  const { id, m2_at, last_dm_at } = rows[0];

  const { rows: [{ n }] } = await client.query(
    "select count(*)::int n from ig_replies where prospect_id = $1", [id],
  );
  if (n > 0) { skippedExisting++; continue; } // idempotence : déjà backfillé

  // Base temporelle : le M2 (moment où on a traité la réponse), sinon le dernier DM.
  const base = m2_at || last_dm_at || new Date();
  for (let i = 0; i < replies.length; i++) {
    const at = new Date(new Date(base).getTime() + i * 60_000); // ordre stable
    await client.query(
      "insert into ig_replies (prospect_id, kind, received_at, excerpt) values ($1,$2,$3,$4)",
      [id, replies[i].kind, at.toISOString(), replies[i].excerpt],
    );
    inserted++;
  }
  // Un prospect qui a répondu ne doit plus être dans la file de relance.
  await client.query("update instagram_prospects set next_followup_at = null where id = $1", [id]);
}

for (const u of A_PASSER_PERDU) {
  const r = await client.query(
    "update instagram_prospects set stage = 'perdu', status = 'negative', next_followup_at = null where username = $1 returning username",
    [u],
  );
  if (r.rowCount) console.log(`  → ${u} passé perdu/negative`);
}

const { rows: [tot] } = await client.query(
  "select count(*)::int n, count(distinct prospect_id)::int p from ig_replies",
);
console.log(`\n✓ ${inserted} réponses insérées · ${skippedExisting} prospects déjà backfillés (ignorés)`);
if (notFound.length) console.log(`⚠️  introuvables en base : ${notFound.join(", ")}`);
console.log(`Total ig_replies : ${tot.n} lignes / ${tot.p} prospects`);
await client.end();
