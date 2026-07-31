// Test de la chaîne de sources Instagram, sans écrire en base (dryRun).
//   npx tsx scripts/_tmp-test-fallback.mts [hashtag] [order] [resolveCap]
// ex. npx tsx scripts/_tmp-test-fallback.mts coiffeurbordeaux looter 5

import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim();
}

const hashtag = process.argv[2] ?? "coiffeur";
if (process.argv[3]) process.env.IG_PROVIDER_ORDER = process.argv[3];
process.env.IG_RESOLVE_CAP = process.argv[4] ?? "5";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const { discoverHashtagUsernames, fetchProfiles, sourceStatus } = await import("../app/lib/igSource.ts");
const { isProspect, pickContact, extractLastPostAt, detectMetier, prospectScore } = await import("../app/lib/instagram.ts");

log("ordre:", process.env.IG_PROVIDER_ORDER ?? "(défaut apify,looter,stable)", "| cap:", process.env.IG_RESOLVE_CAP);
log("état chaîne:", JSON.stringify(await sourceStatus()));

const src = await discoverHashtagUsernames(hashtag, 40);
log(
  `#${hashtag} → ${src.usernames.length} usernames | provider=${src.provider} resolver=${src.resolver ?? "-"} ` +
    `réutilisés=${src.reused} résolus=${src.resolved} plafonné=${src.capped}`,
);
if (src.attempts.length) log("tentatives:", JSON.stringify(src.attempts));
log("échantillon:", src.usernames.slice(0, 8).join(", "));

const profiles = await fetchProfiles(src.usernames.slice(0, 5));
log(`profils: ${profiles.length} (servis par le cache si la découverte les a déjà payés)`);

for (const p of profiles) {
  const { email, phone } = pickContact(p);
  const prospect = isProspect(p);
  const last = extractLastPostAt(p);
  const { score, tier } = prospectScore({
    has_website: !prospect,
    last_post_at: last,
    followers: typeof p.followersCount === "number" ? p.followersCount : null,
    email,
    phone,
    is_business: typeof p.isBusinessAccount === "boolean" ? p.isBusinessAccount : null,
    bio: p.biography ?? null,
  });
  log(
    `  @${p.username} | ${p.followersCount ?? "?"} abo | métier=${detectMetier(p.businessCategoryName, p.biography) || "-"} ` +
      `| sans-site=${prospect} | contact=${email ?? phone ?? "-"} | dernier post=${last?.slice(0, 10) ?? "-"} | score=${score}/${tier} | src=${p._provider ?? "apify"}`,
  );
}

log("état chaîne après:", JSON.stringify(await sourceStatus()));
