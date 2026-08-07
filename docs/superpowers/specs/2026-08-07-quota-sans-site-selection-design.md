# Quota « sans site » dans la sélection du jour

**Date** : 07/08/2026
**Décision** : Nicolas

## Le besoin

La sélection du jour ignore complètement `has_website`. Or l'offre vendue est un
site : un prospect qui en a déjà un est un prospect qu'il faut convaincre de
changer, un prospect qui n'en a pas est un prospect à qui il manque quelque
chose. Le second convertit mieux — le score le sait déjà (+30 quand
`has_website === false`), la sélection non.

Nicolas veut pouvoir dire « aujourd'hui, 49 de mes 50 comptes doivent être des
sans-site » et les avoir.

## Ce qu'on construit

Un **plancher réglable, par compte émetteur** : le nombre minimum de lignes sans
site que la journée doit contenir.

« Sans site » = `has_website IS NULL OR has_website = false`. Même définition que
le filtre du pipeline (`app/instagram/page.tsx`) et que l'export CSV
(`app/api/instagram/export/route.ts`) — un profil dont on ignore s'il a un site
compte comme sans site, parce que c'est ainsi que le reste de l'outil le compte.

### Ce qu'on ne construit pas

- Pas de bloc de 50 comptes EN PLUS des 50 : le plafond de chauffe
  (`warmupCaps`, max 50/j) est la limite d'envoi Instagram, la dépasser ferait
  refuser les DM par `/api/instagram/dm`. Le quota se joue à l'intérieur.
- Pas de complétion de secours avec des « avec site » quand le stock sans-site
  manque. Voir « À sec » plus bas.
- Pas de simple case à cocher d'affichage : elle masquerait des lignes sans
  jamais garantir d'en avoir 49.

## Le réglage

Migration 028 :

```sql
ALTER TABLE ig_accounts
  ADD COLUMN IF NOT EXISTS no_site_min integer NOT NULL DEFAULT 50;
```

Par compte, parce que le cockpit est multi-comptes et que chaque compte a son
propre plan de chauffe. En base et pas dans le navigateur, parce que le cron du
matin (`/api/cron/ig-refill`) construit la sélection avant que l'écran ne soit
ouvert : une valeur qui ne vivrait que côté client lui serait invisible.

Défaut 50 = journée entièrement sans-site. C'est la valeur que Nicolas veut
aujourd'hui ; elle s'écrête toute seule au nombre de créneaux réels (en chauffe
J2, 10 créneaux → plancher effectif 10).

## La mécanique

Dans `ensureDailySelection`, les créneaux du jour se scindent en deux :

| part | taille | remplie avec |
|---|---|---|
| réservée | `min(no_site_min, slots)` | **uniquement** du sans-site |
| libre | `slots − réservée` | n'importe quel qualifié |

Le décompte porte sur la **journée entière, reports d'hier compris** — même
règle que le plafond par métier. Une ligne reportée sans site consomme la part
réservée ; une ligne reportée avec site consomme la part libre, et déborde sur
la part réservée si la part libre est déjà pleine (elle occupe physiquement un
créneau, on ne peut pas la déloger).

Fonction pure `partSansSite(slots, noSiteMin, dejaSansSite, dejaAvecSite)` →
`{ sansSite, libre }` : ce qu'il reste à poser dans chaque part. Testable sans
base, comme `daySlots` et `roundRobinByMetier`.

`pickFreshProspects` prend un drapeau `sansSiteOnly` qui ajoute
`.or("has_website.is.null,has_website.eq.false")` au SQL, et un ensemble
`exclure` pour que le second appel ne repropose pas ce que le premier vient de
poser. Deux appels par génération : la part réservée, puis la part libre.

Le round-robin par métier et le plafond de `MAX_PER_METIER` restent intacts et
s'appliquent aux deux parts, avec le même compteur `already` — une part ne peut
pas saturer un métier au détriment de l'autre.

`PROSPECT_COLS` gagne `has_website` : la colonne n'était pas lue par la
sélection, ni pour choisir ni pour afficher.

## À sec

Quand la réserve sans-site ne suffit pas, **les créneaux restent vides**. Aucun
code nouveau : `shortfall` monte, et c'est lui qui déclenche déjà la chasse
(`refillStock`). Le manque répare le stock, exactement comme le plafond par
métier le fait pour le mix.

Ce qui manque, c'est l'**explication**. Le bandeau d'aujourd'hui connaît deux
causes (« plafond de 5 par métier atteint », « plus assez de comptes
qualifiés ») ; il en faut une troisième. `DailySelection` remonte donc :

| champ | sens |
|---|---|
| `noSiteMin` | le plancher stocké, **non** écrêté (voir plus bas) |
| `noSite` | lignes sans site réellement dans la journée (hors écartées) |
| `stockLeftNoSite` | qualifiés sans site encore en réserve |

Ordre des messages, du plus spécifique au plus général : réserve sans-site
épuisée alors que du stock avec site existe → plafond métier → stock vide.

## L'écran

Dans le bandeau d'avancement de la sélection (`SelectionView`) :

- un champ numérique **« sans site : 42 / [49] »** — à gauche ce que la journée
  contient, à droite le plancher, borné `0..100`, qui écrit le réglage et
  recharge la sélection.

  Le champ réaffiche la valeur **stockée**, jamais la valeur écrêtée : sur un
  compte en chauffe (50 demandés, 10 créneaux), réafficher 10 puis le réécrire
  au réglage suivant ferait descendre le plancher d'un cran à chaque visite, et
  le 50 serait perdu pour le jour où les créneaux existeront. L'écrêtage reste
  un calcul de génération, il ne touche pas au réglage ;
- la ligne de réserve précise la composition : `42 sans site · 8 avec site`.

Écriture via la route existante de la sélection —
`POST /api/instagram/selection { action: "quota", account_id, no_site_min }` —
plutôt qu'un PATCH sur `/api/instagram/accounts` : c'est un réglage de la
sélection, il vit avec elle, et la route renvoie déjà la sélection recalculée
après chaque action.

## Le coût, dit d'avance

Le plafond de 5 par métier ne bouge pas. **49 sans-site exigent donc au moins
10 métiers ayant du qualifié sans site en réserve.** Les journées peinent déjà à
remplir 50 créneaux tous profils confondus ; en restreignant à une partie du
vivier, le `shortfall` montera plus souvent et la chasse tournera davantage —
donc plus d'appels Apify/RapidAPI et plus de lots Claude par jour.

C'est le comportement choisi (créneaux vides plutôt que complétion molle). Le
remède, s'il devient pénible, est un réglage et non un commit : baisser
`no_site_min` à 30-35.

## Tests

`app/lib/igSelection.test.ts`, sur `partSansSite` :

- cas nominal : 50 créneaux, plancher 49, journée vide → 49 réservés, 1 libre ;
- écrêtage par la chauffe : 10 créneaux, plancher 50 → 10 réservés, 0 libre ;
- reports sans site déjà posés : ils décomptent la part réservée ;
- reports avec site qui débordent : 10 « avec site » d'hier et un plancher de 49
  sur 50 créneaux → la part réservée tombe à 40, le quota est inatteignable et
  rien ne plante ;
- plancher 0 : comportement d'avant, aucune part réservée ;
- jamais de valeur négative, jamais plus que les créneaux restants.
