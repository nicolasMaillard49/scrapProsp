"use client";

import { useEffect, useState } from "react";
import {
  PhoneCall, MessageSquare, Phone, Megaphone, ShieldAlert, CalendarCheck,
  ChevronDown, Sparkles, Flame, Search, Link2, Presentation, BadgeEuro, Handshake,
} from "lucide-react";
import type { Prospect } from "../lib/types";
import { metierLabel } from "../maquette/templates/data";

/** "ALEXIS" / "alexis bernard" -> "Alexis" (1er prénom, capitalisé). */
function firstName(prenom?: string | null): string {
  const f = (prenom ?? "").trim().split(/\s+/)[0] ?? "";
  if (!f) return "";
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

/** Ressentis cliquables en découverte → alimentent la douleur du Pont. */
const FEELINGS = [
  { key: "deborde", label: "Débordé", pain: "vous êtes débordé, vous courez dans tous les sens" },
  { key: "stagne", label: "Ça stagne", pain: "vous tournez avec les mêmes clients, ça stagne" },
  { key: "inquiet", label: "Inquiet pour l’avenir", pain: "vous vous demandez d’où viendront les clients demain" },
  { key: "boa", label: "Dépend du bouche-à-oreille", pain: "vous dépendez à 100 % du bouche-à-oreille" },
  { key: "pasperçu", label: "Pas pris au sérieux", pain: "vous n’êtes pas pris au sérieux face aux plus gros" },
  { key: "decu", label: "Déçu par le digital", pain: "vous avez déjà été déçu par des promesses sur internet" },
] as const;

/** Moteur principal cliquable → alimente l’ambition du Pont + l’angle d’argumentation. */
const OBJECTIVES = [
  { key: "tranquillite", label: "Tranquillité", ambition: "avoir l’esprit tranquille, un flux de clients régulier sans courir après",
    angle: "Joue l’automatique : le site travaille pour lui 24/7, les clients arrivent tout seuls. Vocabulaire « serein », « ça tourne », « plus à y penser »." },
  { key: "argent", label: "Plus d’argent / clients", ambition: "faire rentrer plus de clients et augmenter le chiffre",
    angle: "Va sur le ROI : un seul client via le site = remboursé. Reprends la valeur d’un client qu’il t’a donnée. Volume, chantiers en plus." },
  { key: "image", label: "Crédibilité / image", ambition: "avoir une image vraiment pro, crédible face aux concurrents",
    angle: "Compare : aujourd’hui une fiche Google nue, demain un vrai site. Première impression — on appelle celui qui fait sérieux." },
  { key: "developper", label: "Développer / recruter", ambition: "développer la boîte et pouvoir embaucher derrière",
    angle: "Positionne le site comme un levier de croissance prévisible : un canal de clients régulier pour soutenir l’embauche." },
  { key: "transmettre", label: "Valoriser / transmettre", ambition: "valoriser la boîte pour la transmettre ou la revendre un jour",
    angle: "Le site = un actif qui reste et augmente la valeur perçue de l’entreprise le jour de la transmission." },
] as const;

/* ════════════════ GOOGLE ADS — semaine test (source : sales-game/content) ════════════════ */

/** Situation du site (phase RDV Ads) — clique sa réponse → relance dédiée. */
const ADS_SITE_DIMS = [
  {
    key: "site", q: "Son site aujourd'hui ?",
    opts: [
      { key: "propre", label: "Site propre", relance: "« Vous avez fait le plus dur. Mais un site sans visiteurs, c'est une vitrine dans une rue où personne ne passe — nous on amène les gens devant. »" },
      { key: "vieux", label: "Site daté", relance: "« Même daté, il peut convertir si les bonnes personnes tombent dessus au bon moment — c'est exactement ce que fait la pub. »" },
      { key: "proche", label: "Fait par un proche", relance: "« C'est top d'avoir quelqu'un de confiance. La question c'est juste : quand on tape votre métier + votre ville, vous sortez où ? Votre proche peut même regarder comment on configure. »" },
      { key: "aucun", label: "Pas de site", relance: "Cible non idéale pour les Ads (il faut une page d'atterrissage) → bascule sur l'offre site à 299€, ou propose le combo site + semaine test." },
    ],
  },
  {
    key: "clients", q: "Ses clients viennent d'où ?",
    opts: [
      { key: "boa", label: "Bouche-à-oreille", relance: "« Gardez-le précieusement, c'est la preuve que vous bossez bien. Mais il amène les clients de vos clients — pas ceux qui tapent votre métier sur Google sans connaître personne. Ceux-là, aujourd'hui, ils tombent sur vos concurrents. »" },
      { key: "reseaux", label: "Réseaux sociaux", relance: "« Les réseaux travaillent votre image, mais c'est pas le même client : sur Insta on scrolle pour se divertir, sur Google on tape votre métier parce qu'on en a besoin MAINTENANT. Nous on capte ceux-là. »" },
      { key: "pub", label: "Fait déjà de la pub", relance: "« Vous savez sur quels mots-clés vous êtes positionné et combien de demandes ça rentre par semaine ? Souvent on paie sans voir les chiffres. Notre semaine test est gratuite — vous comparez en vrai. »" },
      { key: "saitpas", label: "Il sait pas trop", relance: "« Donc si demain ça ralentit, vous avez pas de robinet à ouvrir. C'est exactement ce qu'on teste : un canal mesurable, que vous contrôlez. »" },
    ],
  },
] as const;

interface AdsObjection {
  key: string;
  label: string;
  line: string;
  reponse: string;
}

/** Objections phase RDV (vouvoiement) — la réponse « good » du sales-game. */
const ADS_OBJ_RDV: AdsObjection[] = [
  { key: "agence", label: "J'ai déjà une agence",
    line: "« Merci mais j'ai déjà une agence qui s'occupe de toute ma com. »",
    reponse: "« Parfait, bon signe que vous investissiez déjà. Juste pour comprendre : elle vous fait apparaître en haut de Google quand on tape votre métier + votre ville ? C'est exactement ce qu'on teste — et pendant une semaine c'est gratuit. Vous comparez, vous gardez le meilleur. »" },
  { key: "premier", label: "Je suis déjà premier sur Google",
    line: "« Quand on tape mon nom je suis premier, ça me sert à rien. »",
    reponse: "« Parfait — ceux qui vous connaissent vous trouvent. Maintenant tapez votre MÉTIER + votre ville, sans votre nom, comme quelqu'un qui ne vous connaît pas : vous ressortez où ? C'est sur cette recherche-là qu'on vous met en haut. »" },
  { key: "fiche", label: "J'ai déjà ma fiche Google",
    line: "« J'ai ma fiche Maps avec mes avis, pourquoi payer en plus ? »",
    reponse: "« Bien joué d'avoir la fiche, gardez-la. Mais elle ressort surtout auprès des gens proches sur la carte. Les annonces s'affichent TOUT en haut, sur n'importe quelle recherche métier + ville, au-dessus de la carte et des concurrents qui ont aussi des avis. »" },
  { key: "cliquepas", label: "Les gens cliquent pas sur les pubs",
    line: "« Moi je clique jamais sur les pubs en haut de Google. »",
    reponse: "« Vrai pour ce qu'on ne cherche pas. Mais quand vous tapez plombier + votre ville à 22h parce que ça fuit, vous cliquez sur quoi ? Le premier qui peut venir. Les gens qui cherchent votre métier sont déjà en train d'acheter. »" },
  { key: "boa", label: "Le bouche-à-oreille me suffit",
    line: "« Mes clients viennent par bouche-à-oreille, j'ai pas besoin de Google. »",
    reponse: "« Excellente base — je ne veux pas la remplacer. J'ajoute juste une source : les gens qui tapent déjà votre métier sur Google et qui ne vous connaissent pas encore. Aujourd'hui ils tombent sur vos concurrents. On teste une semaine, gratuitement, et vous jugez. »" },
  { key: "dejaappele", label: "On m'a déjà appelé 10 fois",
    line: "« On m'a déjà appelé dix fois pour Google, j'en peux plus. »",
    reponse: "« Je vous comprends, et je vais pas refaire le même speech. La différence : on ne vous demande pas d'investir — on configure tout, vous testez une semaine gratuitement, le budget pub va directement à Google. Vous risquez juste de voir des clients arriver. 30 secondes ? »" },
  { key: "mail", label: "Envoyez-moi un mail",
    line: "« Envoyez-moi tout ça par mail, je regarderai. »",
    reponse: "« Avec plaisir pour le résumé. Mais un mail ne remplace pas les 10 minutes où on regarde VOTRE cas — votre métier, votre zone. On se cale un créneau rapide, et derrière je vous envoie tout par écrit. Plutôt matin ou après-midi ? »" },
  { key: "marchepas", label: "J'y crois pas / ça marche pas",
    line: "« Google Ads franchement j'y crois pas, c'est du flan. »",
    reponse: "« Et vous avez raison de ne pas y croire sur parole — moi non plus. C'est exactement pour ça qu'on fait une semaine test gratuite : vous ne croyez rien, vous regardez juste les chiffres à la fin. On lance, on regarde ensemble ? »" },
];

/** Objections phase closing semaine test (tutoiement, comme la source). */
const ADS_OBJ_CLOSE: AdsObjection[] = [
  { key: "budgetpub", label: "Encore un budget pub",
    line: "« Encore un budget pub à sortir, j'en ai marre de payer partout. »",
    reponse: "« Clair avec toi : c'est ~100€ sur la semaine, payés directement à Google — pas à nous. Notre travail pendant le test est gratuit. Le pire scénario : 100€ pour savoir si ça te rentre des clients. »" },
  { key: "derape", label: "Peur que ça dérape",
    line: "« J'ai peur que ça me bouffe 500€ en deux jours. »",
    reponse: "« Légitime — et c'est pour ça que le budget est PLAFONNÉ : 10 à 15€ par jour, Google ne peut pas dépenser un centime de plus, et tu peux tout couper en un clic. Sur la semaine, 100€ max. »" },
  { key: "apres", label: "C'est combien après ?",
    line: "« Et une fois la semaine gratuite finie, ça me coûte combien ? »",
    reponse: "« Transparent : si tu vois que ça rentre et que tu veux continuer, la gestion c'est 750€/mois TTC. Mais tu décides SEULEMENT après avoir vu les résultats — zéro engagement pendant le test. On fait les calculs ensemble à la fin et tu tranches. »" },
  { key: "tropcher", label: "750€/mois trop cher",
    line: "« 750 balles par mois ? Beaucoup trop cher pour moi. »",
    reponse: "« Reprends ton chiffre : un chantier moyen chez toi c'est [X]€. Si la machine t'en ramène ne serait-ce que deux par mois, on est où ? C'est pas une dépense, c'est un commercial qui bosse 24/7 — et tu le juges sur la semaine test avant de payer quoi que ce soit. »" },
  { key: "essaye", label: "Déjà essayé, rien donné",
    line: "« J'ai testé Google Ads, j'ai cramé 300 balles pour rien. »",
    reponse: "« Ça m'aide de le savoir. C'était toi qui gérais, ou un expert ? Neuf fois sur dix le problème c'est le ciblage — mauvais mots-clés, mauvaise zone, pas de plafond. Là un expert pilote, et tu vois en une semaine si ça réagit différemment quand c'est bien fait. »" },
  { key: "complique", label: "Trop compliqué / pas le temps",
    line: "« J'ai déjà pas le temps pour ma compta, alors gérer ça en plus… »",
    reponse: "« Justement : tu ne gères RIEN. L'expert configure, lance, surveille. La seule chose qui t'arrive, ce sont des appels de clients qui cherchaient déjà ton service. C'est l'inverse d'une charge. »" },
  { key: "reflechir", label: "Je vais réfléchir",
    line: "« C'est intéressant… mais je vais réfléchir. »",
    reponse: "« Je t'entends. Mais réfléchir à quoi exactement ? On parle d'une semaine de test gratuite — on fait tout, et le seul truc à prévoir c'est ~100€ payés direct à Google. Qu'est-ce qui te fait hésiter ? »" },
  { key: "conjoint", label: "J'en parle à ma femme / associé",
    line: "« Faut que j'en parle à ma femme, c'est elle qui gère les sous. »",
    reponse: "« Logique. Si elle était là, elle objecterait quoi à un test à 100€ qui peut ramener des clients ? … Et si ça ne tenait qu'à toi, tu le ferais ? » (si oui → cale un rappel précis à trois, date/heure notées)" },
  { key: "commission", label: "Vous touchez une commission",
    line: "« Vous me poussez à dépenser chez Google pour votre commission, c'est ça ? »",
    reponse: "« Franc avec toi : pendant le test je touche zéro — service gratuit, budget direct chez Google. Je suis payé seulement APRÈS, et uniquement si ça te rentre des clients et que tu continues. J'ai tout intérêt à ce que ça marche : on a les mêmes intérêts. »" },
];

/** Objection Ads cliquable : chip → réplique de l'artisan + ta réponse. */
function AdsObjections({ items }: { items: AdsObjection[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const cur = items.find((o) => o.key === sel) ?? null;
  return (
    <div>
      <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Il dit quoi ? — clique l&apos;objection</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((o) => (
          <Chip key={o.key} active={sel === o.key} onClick={() => setSel(sel === o.key ? null : o.key)}>{o.label}</Chip>
        ))}
      </div>
      {cur && (
        <>
          <p className="mt-2 text-[11px] italic text-[var(--color-text-muted)]">{cur.line}</p>
          <Relance>{cur.reponse}</Relance>
        </>
      )}
    </div>
  );
}

/** Pastille cliquable (toggle). */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
        active
          ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-transparent shadow"
          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Relance à dire en réaction à une réponse (réponse interactive, vert = « à répondre »). */
function Relance({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[12px] leading-relaxed text-emerald-800 dark:text-emerald-200/90 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-2.5 py-1.5">
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">↳ </span>{children}
    </p>
  );
}

/** Dimensions « vie d'entreprise » cliquables — chaque réponse a une relance dédiée. */
const BIZ_DIMS = [
  {
    key: "anciennete", q: "Depuis quand installé ?",
    opts: [
      { key: "jeune", label: "< 2 ans", relance: "Le lancement, c’est LE moment pour se rendre visible : le site pose les bases tout de suite, avant les concurrents." },
      { key: "etabli", label: "2–10 ans", relance: "Vous avez déjà la réputation. Le site capte tous ceux qui vous cherchent sur Google et ne tombent que sur une fiche." },
      { key: "veteran", label: "10 ans +", relance: "Tout construit au bouche-à-oreille, bravo. Imaginez le même résultat AVEC un canal qui tourne 24/7 en plus." },
    ],
  },
  {
    key: "equipe", q: "Seul ou en équipe ?",
    opts: [
      { key: "seul", label: "Seul", relance: "Tout repose sur vous → le site qualifie et filtre les demandes avant même que vous décrochiez." },
      { key: "petite", label: "2–5", relance: "Pour nourrir l’équipe en chantiers, il faut un flux régulier — pas seulement le bouche-à-oreille." },
      { key: "grande", label: "5 +", relance: "À votre taille, l’image compte : le client compare et appelle celui qui fait le plus sérieux." },
    ],
  },
  {
    key: "charge", q: "Charge en ce moment ?",
    opts: [
      { key: "deborde", label: "Débordé", relance: "Vous êtes plein MAINTENANT. Et dans 3 mois ? Le site lisse le flux pour ne plus dépendre des périodes." },
      { key: "ok", label: "Ça va", relance: "Bon moment pour installer le canal pendant que c’est calme — les effets arrivent en différé." },
      { key: "trous", label: "Trous au planning", relance: "Le site remplit justement les trous : il travaille même quand vous êtes sur un chantier." },
      { key: "saison", label: "Saisonnier", relance: "Pour des résultats en haute saison, il faut être visible AVANT — on prend de l’avance maintenant." },
    ],
  },
  {
    key: "digital", q: "Déjà tenté le digital ?",
    opts: [
      { key: "jamais", label: "Jamais", relance: "Page blanche → parfait, aucune mauvaise habitude à corriger. On part propre." },
      { key: "vieux", label: "Vieux site", relance: "Un site daté fait fuir autant qu’une absence de site. Là vous voyez le neuf avant de décider." },
      { key: "decu", label: "Déjà payé, déçu", relance: "« Qu’est-ce qui n’a pas marché ? » (écoute) → Nous le site est DÉJÀ fait : vous le voyez avant de payer un centime." },
      { key: "reseaux", label: "Réseaux only", relance: "Instagram c’est bien, mais ça ne sort pas sur Google — le site, si, là où les gens cherchent près de chez eux." },
    ],
  },
] as const;

/** Canaux d'acquisition actuels (multi) — sert à montrer sa dépendance. */
const CHANNELS = [
  { key: "boa", label: "Bouche-à-oreille" },
  { key: "lbc", label: "Le Bon Coin" },
  { key: "pj", label: "Pages Jaunes" },
  { key: "social", label: "Réseaux sociaux" },
  { key: "rien", label: "Rien de structuré" },
] as const;

/** Surligne une variable dynamique (prénom, ville, métier…). */
function V({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--color-accent)] font-semibold">{children}</span>;
}

/** Réplique à dire mot pour mot (bloc citation). */
function Say({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] leading-relaxed text-[var(--color-text-primary)] border-l-2 border-violet-300 dark:border-violet-500/50 pl-2.5 py-0.5">
      {children}
    </p>
  );
}

/** Question ouverte à poser (à creuser, pas à réciter). */
function Ask({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] leading-relaxed text-[var(--color-text-primary)] border-l-2 border-sky-300 dark:border-sky-500/50 pl-2.5 py-0.5">
      <span className="text-sky-500 dark:text-sky-400 font-semibold mr-1">?</span>{children}
    </p>
  );
}

/** Liste de conseils / variantes / pas-à-pas. */
function Tips({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((t, j) => (
        <li key={j} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-accent)] mt-0.5 shrink-0">▸</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Sous-titre d'une objection / d'un cas dans une section. */
function ObjTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3 first:mt-1">{children}</div>;
}

function Section({
  num, title, icon, defaultOpen = false, accent = false, children,
}: {
  num?: number;
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={`rounded-xl border bg-[var(--color-background)]/40 overflow-hidden group ${
        accent ? "border-violet-300 dark:border-violet-500/30" : "border-[var(--color-border)]"
      }`}
    >
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none bg-[var(--color-surface-2)]/30">
        {num != null && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-[var(--color-accent)] text-[11px] font-bold shrink-0">
            {num}
          </span>
        )}
        <span className="text-[var(--color-accent)] shrink-0">{icon}</span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)] flex-1">
          {title}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-open:rotate-180 transition shrink-0" />
      </summary>
      <div className="px-3 py-2.5 space-y-2">{children}</div>
    </details>
  );
}

type Mode = "prospection" | "closing" | "ads";
type Version = "sms" | "cold";
type AdsStep = "rdv" | "test";

export default function CallScript({
  prospect,
  smsSent,
}: {
  prospect: Prospect;
  smsSent: boolean;
}) {
  // Étape 1 = prospection (décrocher le RDV), étape 2 = closing (vendre à 299€ après le RDV),
  // ads = vendre la semaine test Google Ads. Les prospects du scrape Ads ouvrent direct sur l'onglet Ads.
  const [mode, setMode] = useState<Mode>(prospect.source === "ads" ? "ads" : "prospection");
  // Au sein de la prospection : « site déjà envoyé par SMS » si un SMS est parti, sinon « découverte au tél ».
  const [version, setVersion] = useState<Version>(smsSent ? "sms" : "cold");
  // Au sein de l'onglet Ads : RDV (décrocher la visio) puis Semaine test (closer en visio).
  const [adsStep, setAdsStep] = useState<AdsStep>("rdv");
  // Situation Ads cliquable (site + provenance clients) → relances dédiées.
  const [adsSit, setAdsSit] = useState<Record<string, string>>({});
  // Profil express du closing (cliquable pendant l'appel) — alimente le Pont + l'angle.
  const [feelings, setFeelings] = useState<string[]>([]);
  const [objective, setObjective] = useState<string | null>(null);
  // Vie d'entreprise : réponse choisie par dimension + canaux d'acquisition (multi).
  const [biz, setBiz] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<string[]>([]);

  useEffect(() => {
    setVersion(smsSent ? "sms" : "cold");
  }, [smsSent, prospect.id]);

  // Réinitialise le profil quand on change de prospect.
  useEffect(() => {
    setFeelings([]);
    setObjective(null);
    setBiz({});
    setChannels([]);
    setAdsSit({});
    setAdsStep("rdv");
    setMode(prospect.source === "ads" ? "ads" : "prospection");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect.id]);

  const toggleFeeling = (key: string) =>
    setFeelings((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleChannel = (key: string) =>
    setChannels((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const setBizDim = (dim: string, opt: string) =>
    setBiz((prev) => {
      if (prev[dim] === opt) {
        const rest = { ...prev };
        delete rest[dim];
        return rest;
      }
      return { ...prev, [dim]: opt };
    });
  const channelText = channels.length
    ? CHANNELS.filter((c) => channels.includes(c.key)).map((c) => c.label.toLowerCase()).join(", ")
    : null;

  const painText = feelings.length
    ? FEELINGS.filter((f) => feelings.includes(f.key)).map((f) => f.pain).join(" et ")
    : null;
  const obj = OBJECTIVES.find((o) => o.key === objective) ?? null;

  const prenom = firstName(prospect.dirigeant_prenom);
  const greet = prenom ? <V>{prenom}</V> : "monsieur";
  const metier = prospect.metier ? metierLabel(prospect.metier).toLowerCase() : "artisan";
  const ville = prospect.ville?.trim() || "votre ville";

  const tabBase =
    "flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition";
  const tabOff = "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]";
  const tabOn = "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow";

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl w-full md:w-80 lg:w-96 p-4 shadow-2xl shrink-0 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        {mode === "prospection" ? (
          <><PhoneCall className="w-4 h-4 text-[var(--color-accent)]" /> Script de prospection — RDV</>
        ) : mode === "closing" ? (
          <><Handshake className="w-4 h-4 text-[var(--color-accent)]" /> Script de closing — 299€</>
        ) : (
          <><Megaphone className="w-4 h-4 text-[var(--color-accent)]" /> Script Google Ads — semaine test</>
        )}
      </div>

      {/* Sélecteur d'offre : Prospection (RDV site) / Closing (vendre le site) / Ads (semaine test) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] mb-3">
        <button onClick={() => setMode("prospection")} className={`${tabBase} ${mode === "prospection" ? tabOn : tabOff}`}>
          <PhoneCall className="w-3.5 h-3.5" />
          Prospection
        </button>
        <button onClick={() => setMode("closing")} className={`${tabBase} ${mode === "closing" ? tabOn : tabOff}`}>
          <Handshake className="w-3.5 h-3.5" />
          Closing
        </button>
        <button onClick={() => setMode("ads")} className={`${tabBase} ${mode === "ads" ? tabOn : tabOff}`}>
          <Megaphone className="w-3.5 h-3.5" />
          Ads
        </button>
      </div>

      {mode === "ads" && (
        <>
          {/* Sous-étape : décrocher le RDV vs closer la semaine test en visio */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] mb-3">
            <button onClick={() => setAdsStep("rdv")} className={`${tabBase} ${adsStep === "rdv" ? tabOn : tabOff}`}>
              <PhoneCall className="w-3.5 h-3.5" />
              1. RDV (tél)
            </button>
            <button onClick={() => setAdsStep("test")} className={`${tabBase} ${adsStep === "test" ? tabOn : tabOff}`}>
              <Presentation className="w-3.5 h-3.5" />
              2. Semaine test (visio)
            </button>
          </div>

          {/* Site détecté par le scrape — la cible idéale Ads a déjà un site */}
          <div className={`mb-3 px-3 py-2 rounded-lg border text-[11px] leading-relaxed ${
            prospect.website
              ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200/90"
              : "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200/90"
          }`}>
            {prospect.website ? (
              <>🎯 <b>Site détecté</b> — cible idéale Ads :{" "}
                <a href={prospect.website} target="_blank" rel="noreferrer" className="underline font-medium break-all">
                  {prospect.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                </a>
                {" "}· ouvre-le avant d&apos;appeler + tape « {metier} {ville} » sur Google pour voir où il sort.</>
            ) : (
              <>⚠️ <b>Pas de site détecté</b> — l&apos;offre Ads cible ceux qui en ont déjà un.
                Vérifie sa fiche Maps, sinon bascule sur l&apos;offre site (onglet Prospection) ou propose le combo site + semaine test.</>
            )}
          </div>

          {adsStep === "rdv" ? (
            <>
              {/* Mindset RDV Ads */}
              <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-100/80 leading-relaxed">
                Tu ne vends <span className="font-semibold text-violet-700 dark:text-violet-200">rien aujourd&apos;hui</span> : tu proposes un{" "}
                <span className="font-semibold text-violet-700 dark:text-violet-200">test gratuit</span> d&apos;une semaine.
                70 % des RDV acceptent la semaine test, 50 % des tests finissent closés.
                Objectif unique : <span className="font-semibold text-violet-700 dark:text-violet-200">la visio de 10 min</span>.
              </div>

              <ol className="space-y-2">
                <Section num={1} title="Ouverture" icon={<PhoneCall className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Si je vous dis que c&apos;est un appel de prospection, vous raccrochez, ou vous me laissez <V>10 secondes</V> ? »</Say>
                  <Say>« Je suis tombé sur votre site en cherchant un <V>{metier}</V> à <V>{ville}</V> — il est bien.
                    Le souci, c&apos;est que pour vous trouver, il faut déjà vous chercher <V>vous</V>. »</Say>
                  <Tips items={[
                    "Pause après l'accroche : laisse-le réagir.",
                    "Les 10 techniques d'ouverture de l'onglet Prospection marchent aussi ici.",
                  ]} />
                </Section>

                <Section num={2} title="Question d'entrée + situation" icon={<Search className="w-4 h-4" />} defaultOpen accent>
                  <Ask>« Aujourd&apos;hui, vos clients viennent d&apos;où ? »</Ask>
                  <Ask>« Et votre site, il vous ramène combien de demandes par mois, à peu près ? »</Ask>
                  <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/5 p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Sa situation — clique sa réponse</span>
                      {Object.keys(adsSit).length > 0 && (
                        <button type="button" onClick={() => setAdsSit({})}
                          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline">
                          réinitialiser
                        </button>
                      )}
                    </div>
                    {ADS_SITE_DIMS.map((dim) => {
                      const sel = adsSit[dim.key];
                      const selOpt = dim.opts.find((o) => o.key === sel);
                      return (
                        <div key={dim.key} className="mb-2.5 last:mb-0">
                          <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">{dim.q}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {dim.opts.map((o) => (
                              <Chip key={o.key} active={sel === o.key} onClick={() =>
                                setAdsSit((prev) => prev[dim.key] === o.key
                                  ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== dim.key))
                                  : { ...prev, [dim.key]: o.key })
                              }>{o.label}</Chip>
                            ))}
                          </div>
                          {selOpt && <Relance>{selOpt.relance}</Relance>}
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section num={3} title="Le mécanisme (20 secondes)" icon={<Megaphone className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Notre service c&apos;est simple : on met votre entreprise <V>en tête de Google</V> quand quelqu&apos;un
                    cherche <V>{metier}</V> dans votre zone. Et on vous propose de tester ça <V>gratuitement pendant 1 semaine</V>. »</Say>
                  <Say>« Il y a juste un petit budget pub à prévoir — environ <V>100€</V> sur la semaine, payés <V>directement à Google</V>,
                    pas à nous. Notre travail pendant le test, il est offert. »</Say>
                  <Tips items={[
                    "20 secondes max : mécanisme → test gratuit → budget transparent. Pas de jargon (Quality Score, CPC…).",
                    "Le « directement à Google, pas à nous » désamorce 80 % de la méfiance.",
                  ]} />
                </Section>

                <Section num={4} title="Projection + prise de RDV" icon={<CalendarCheck className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Imaginez : demain quelqu&apos;un tape <V>{metier} {ville}</V> — il tombe sur <V>vous</V> en premier,
                    au-dessus de tous vos concurrents. C&apos;est ça qu&apos;on teste. »</Say>
                  <Say>« On se cale <V>10 minutes en visio</V> ? Je vous montre votre cas concret — votre zone, ce que les gens
                    cherchent — et vous me direz si ça vaut le coup de lancer la semaine. » → <V>RDV</V></Say>
                  <Tips items={[
                    "Récupère le prénom, justifie la visio (« je vous montre VOTRE zone en partage d'écran »), confirme le créneau — anti no-show, comme pour les sites.",
                    <>Cale le créneau dans « <b>Caler un RDV</b> » sur la fiche → confirme par SMS → le jour J, bascule sur l&apos;étape <b>2. Semaine test</b>.</>,
                  ]} />
                </Section>

                <Section num={5} title="Objections (RDV)" icon={<ShieldAlert className="w-4 h-4" />} defaultOpen>
                  <AdsObjections items={ADS_OBJ_RDV} />
                </Section>
              </ol>
            </>
          ) : (
            <>
              {/* Mindset closing semaine test */}
              <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-100/80 leading-relaxed">
                En <span className="font-semibold text-violet-700 dark:text-violet-200">visio</span>, tutoiement naturel.
                Tu fais le <span className="font-semibold text-violet-700 dark:text-violet-200">diagnostic AVANT l&apos;offre</span>,
                tu annonces les <span className="font-semibold text-violet-700 dark:text-violet-200">3 chiffres dans l&apos;ordre</span> (gratuit → 100€ Google → 750€/mois ensuite),
                et après le close : <span className="font-semibold text-violet-700 dark:text-violet-200">silence total</span>.
                Objectif : <span className="font-semibold text-violet-700 dark:text-violet-200">formulaire rempli pendant l&apos;appel</span>.
              </div>

              <ol className="space-y-2">
                <Section num={1} title="Brise-glace + positionnement" icon={<Handshake className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Salut {greet}, ça va depuis notre appel ? On peut se tutoyer ? »</Say>
                  <Say>« Avant de commencer : je suis pas là pour te vendre du rêve. On lance un test, on regarde les chiffres
                    ensemble à la fin, et <V>c&apos;est toi qui tranches</V>. Ça te va comme deal ? »</Say>
                  <Tips items={["Le « c'est toi qui tranches » pose le cadre : pas de pression, des chiffres. Il se détend → il écoute."]} />
                </Section>

                <Section num={2} title="Diagnostic (3 questions clés)" icon={<Search className="w-4 h-4" />} defaultOpen accent>
                  <Ask>« C&apos;est quoi ton service le plus <V>rentable</V> — celui que tu voudrais vendre plus souvent ? »</Ask>
                  <Ask>« Un chantier moyen là-dessus, ça te rapporte combien à peu près ? »</Ask>
                  <Ask>« Tu interviens dans quel rayon autour de <V>{ville}</V> ? »</Ask>
                  <Tips items={[
                    "Note LE chiffre (valeur d'un chantier) : c'est lui qui justifiera les 750€/mois au close.",
                    "On lance la campagne sur SON service le plus rentable, pas sur tout — dis-le-lui, ça rassure.",
                    "Pendant qu'il parle, ouvre son site en partage d'écran et tape son métier + sa ville sur Google : montre-lui où il sort.",
                  ]} />
                </Section>

                <Section num={3} title="Le mécanisme (coquille vide)" icon={<Link2 className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Ton site, il est bien — mais un site sans visiteurs c&apos;est une <V>coquille vide</V> :
                    une vitrine dans une rue où personne ne passe. »</Say>
                  <Say>« Là, regarde : quand on tape <V>{metier} {ville}</V>, les 3-4 premiers résultats sont des <V>annonces</V>.
                    Les gens cliquent là, au moment exact où ils ont besoin. Nous, on met <V>ton site</V> à cette place. »</Say>
                </Section>

                <Section num={4} title="L'offre (3 chiffres, dans l'ordre)" icon={<BadgeEuro className="w-4 h-4" />} defaultOpen accent>
                  <Say>« 1. Pendant la semaine test, notre travail est <V>gratuit</V> — l&apos;expert configure tout, lance, surveille. »</Say>
                  <Say>« 2. Le seul budget, c&apos;est la pub : <V>10-15€ par jour plafonnés</V>, environ <V>100€ sur la semaine</V>,
                    payés directement à Google sur <V>ton</V> compte. »</Say>
                  <Say>« 3. Et si à la fin tu vois que ça rentre et que tu veux continuer, la gestion c&apos;est <V>750€/mois</V> —
                    mais ça, tu le décides <V>après</V> avoir vu les chiffres. Zéro engagement pendant le test. »</Say>
                  <Tips items={[
                    "Annonce les 3 chiffres toi-même, dans cet ordre — s'il découvre le 750€ plus tard, tu passes pour un piège.",
                    <>Recadrage valeur : « Tu m&apos;as dit qu&apos;un chantier vaut <V>[X]€</V>. Un paysagiste chez nous a signé un chantier à 15 000€ dès sa semaine test. Deux chantiers par mois et la gestion est payée plusieurs fois. »</>,
                  ]} />
                </Section>

                <Section num={5} title="Le close + logistique" icon={<CalendarCheck className="w-4 h-4" />} defaultOpen accent>
                  <Say>« C&apos;est bon pour toi tout ça ? »
                    <span className="text-[var(--color-text-muted)]"> → SILENCE total. Le premier qui parle a perdu.</span></Say>
                  <Tips items={[
                    <><b>Dès le oui</b> : formulaire rempli <b>pendant l&apos;appel</b> (2 min, vous le faites ensemble) — ou max 5 min après, jamais « je te l&apos;envoie pour ce soir ».</>,
                    "Le budget pub se met sur SON compte Google (l'argent reste chez lui) — guide-le pas à pas.",
                    "Transmets le formulaire à l'expert, cale le point résultats à J+7 dans « Caler un RDV », passe la fiche en Positif.",
                  ]} />
                </Section>

                <Section num={6} title="Objections (semaine test)" icon={<ShieldAlert className="w-4 h-4" />} defaultOpen>
                  <AdsObjections items={ADS_OBJ_CLOSE} />
                </Section>
              </ol>
            </>
          )}
        </>
      )}

      {mode === "prospection" && (
        <>
          {/* Sous-version : SMS déjà envoyé vs cold */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] mb-3">
            <button onClick={() => setVersion("sms")} className={`${tabBase} ${version === "sms" ? tabOn : tabOff}`}>
              <MessageSquare className="w-3.5 h-3.5" />
              Site envoyé (SMS)
            </button>
            <button onClick={() => setVersion("cold")} className={`${tabBase} ${version === "cold" ? tabOn : tabOff}`}>
              <Phone className="w-3.5 h-3.5" />
              Découverte (cold)
            </button>
          </div>

          {/* Mindset (conseils MEC) */}
          <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-100/80 leading-relaxed">
            Debout, casque, <span className="font-semibold text-violet-700 dark:text-violet-200">sourire forcé</span> (ça change la voix).
            Tu es là pour <span className="font-semibold text-violet-700 dark:text-violet-200">aider, pas vendre</span> — pose des questions,
            laisse-le arriver lui-même à la conclusion. Objectif unique : <span className="font-semibold text-violet-700 dark:text-violet-200">décrocher le RDV</span>.
          </div>

          <ol className="space-y-2">
            {/* 1 — OUVERTURE (dépend de la version) */}
            {version === "sms" ? (
              <Section num={1} title="Ouverture (relance SMS)" icon={<MessageSquare className="w-4 h-4" />} defaultOpen accent>
                <Say>« Bonjour {greet}, c’est <V>Nicolas</V>. Je vous ai envoyé un <V>SMS</V> il y a quelques jours
                  avec un <V>site web</V> que j’ai pris la liberté de créer pour vous — vous avez eu le temps d’y jeter un œil ? »</Say>
                <Tips items={[
                  <>S’il l’a vu → « Et qu’est-ce que vous en avez pensé ? » puis enchaînez sur la <b>Prise de RDV</b>.</>,
                  <>S’il ne l’a pas vu / l’a zappé → « Pas de souci, c’est justement pour ça que je vous appelle. » puis passez au <b>Pitch</b>.</>,
                  "S’il vous tutoie, tutoyez-le aussi tout de suite. Sinon : « On peut se tutoyer ? »",
                ]} />
              </Section>
            ) : (
              <Section num={1} title="Ouverture (cold — Base Script)" icon={<PhoneCall className="w-4 h-4" />} defaultOpen accent>
                <Say>« Si je vous dis que c’est un appel de prospection, vous balancez le téléphone par la fenêtre,
                  ou vous me laissez <V>10 secondes</V> pour vous expliquer ? »</Say>
                <Say>« Je suis tombé sur votre profil sur internet et j’ai vu que vous n’avez pas de site web. »</Say>
                <Tips items={[
                  "Pause après l’accroche : laisse-le réagir.",
                  <>Variante d’ouverture possible ci-dessous (10 techniques) pour casser le « non » réflexe.</>,
                  "S’il démasque la prospection : ne jamais avouer sèchement — enchaîne La Pizza puis le Base Script.",
                ]} />
              </Section>
            )}

            {/* 1bis — 10 techniques d'ouverture (cold uniquement) */}
            {version === "cold" && (
              <Section title="10 techniques d’ouverture (variantes)" icon={<Flame className="w-4 h-4" />}>
                <Tips items={[
                  <><b>1. Standard</b> — « …vous jetez le téléphone par la fenêtre ou vous me laissez 10 secondes ? »</>,
                  <><b>2. Jingle radio</b> — « Pour tenter de remporter 1000€, quelle est votre radio préférée ? » → Base Script.</>,
                  <><b>3. Accent</b> — « EH OUI BONJOUR C’EST POUR LES PANNEAUX SOLAIRES ! » puis « Non je plaisante. » (forcer à 200%)</>,
                  <><b>4. Voix robotique</b> — « Ceci est un appel concernant votre assurance auto. » puis « Non je plaisante. »</>,
                  <><b>5. La Pizza</b> — « Je vais vous commander une margarita et une royale, c’est prêt dans combien de temps ? » (la plus simple, fait rire)</>,
                  <><b>6. Loto</b> — « J’ai une excellente nouvelle. (pause) Non, vous n’avez pas gagné au loto. (pause) Mais un appel de prospection. »</>,
                  <><b>7. Site discret</b> — « Je vous appelle pour vous féliciter : votre site est le plus discret d’internet, impossible à trouver. »</>,
                  <><b>8. Stagiaire</b> — « Vous prenez des stagiaires ? (pause) Non je rigole. »</>,
                  <><b>9. Marre qu’on vous appelle</b> — « Vous en avez marre qu’on vous appelle pour des sites web ? Parfait, je règle le problème : je vous en ai fait un. »</>,
                  <><b>10. Ça vous appartient</b> — « J’ai quelque chose qui vous appartient… un site web tout neuf, prêt à être activé. » → Partie 2.</>,
                ]} />
              </Section>
            )}

            {/* 2 — LE PITCH (Base Script Partie 2) */}
            <Section num={2} title="Le pitch" icon={<Megaphone className="w-4 h-4" />} defaultOpen accent>
              <Say>« J’imagine qu’on vous appelle souvent pour ça… » <span className="text-[var(--color-text-muted)]">(silence)</span></Say>
              <Say>« La grande différence, c’est que j’ai pris la liberté de vous <V>créer le site directement</V>,
                au lieu de vous promettre beaucoup de choses. »</Say>
              <Say>« Donc si ça vous intéresse je peux vous le montrer, comme ça vous voyez si vous le trouvez bien ou pas ? »
                → <V>Prise de RDV</V></Say>
              <Tips items={[
                "Tu ne vends pas, tu montres ce qui existe déjà → ça désamorce la méfiance.",
                "Ne dis jamais quoi penser à l’artisan : laisse-le conclure que c’est bien.",
              ]} />
            </Section>

            {/* 3 — OBJECTIONS (commun) */}
            <Section num={3} title="Gestion des objections" icon={<ShieldAlert className="w-4 h-4" />}>
              <ObjTitle>« J’ai le bouche-à-oreille »</ObjTitle>
              <Say>« C’est très bien le bouche-à-oreille. Mais s’il vient à diminuer <V>OU</V> que vous voulez plus de clients —
                vous faites comment ? Vous êtes dépendant de ce que les gens racontent, ou vous pouvez activer un levier ? »</Say>
              <Tips items={["Dire « OU » et pas « ET » : 2 scénarios, pas d’échappatoire.", "Ne jamais dire « si ça s’arrête » → « ça marche depuis 10 ans, pourquoi ça s’arrêterait ? »"]} />

              <ObjTitle>« Je travaille seul, ça me suffit »</ObjTitle>
              <Say>« Félicitations. Vous travaillez seul ou vous avez des gens à déléguer ? … Donc vous n’avez pas
                vraiment l’ambition de développer votre boîte ? » <span className="text-[var(--color-text-muted)]">(il se défend → ouverture)</span></Say>
              <Tips items={["Si c’est l’été : « Pour avoir des résultats en hiver, faut commencer maintenant. »"]} />

              <ObjTitle>« On m’a déjà appelé pour ça »</ObjTitle>
              <Say>« Ça ne m’étonne pas. Mais qu’est-ce qui a fait que vous n’avez pas dit oui à l’autre personne ? »
                <span className="text-[var(--color-text-muted)]"> (il sort sa vraie objection)</span></Say>
              <Tips items={["S’il a déjà payé : arrête, c’est mort. Ne demande JAMAIS toi-même « vous avez déjà payé ? »"]} />

              <ObjTitle>« C’est quoi le prix ? »</ObjTitle>
              <Say>« L’intérêt c’est qu’on voie ensemble si le site vous plaît, ensuite on parle modifs et prix.
                Mais déjà, ça vous intéresse de jeter un œil ? Pour l’instant c’est <V>totalement gratuit</V> de regarder. »</Say>

              <ObjTitle>« Un site sans trafic ça sert à rien »</ObjTitle>
              <Say>« Certes. Mais vous avez du bouche-à-oreille — donc des gens cherchent déjà votre nom. Là ils tombent sur quoi ?
                Une fiche Google avec 3 photos. Avec un site, vous convertissez beaucoup plus. »</Say>
              <Tips items={["Tu plugues ton offre sur ce qu’il a déjà : suite logique, pas contrainte."]} />

              <ObjTitle>« Envoyez-moi ça par mail »</ObjTitle>
              <Say>« Le souci c’est que je suis pas chez moi, le site est sur mon ordi, pas encore en ligne.
                La seule chose qu’on peut faire, c’est un petit <V>RDV de 10 min</V> en partage d’écran. »</Say>
              <Tips items={["Ne jamais accepter le mail sans résistance → il oublie en 30 min."]} />
            </Section>

            {/* 4 — PRISE DE RDV + MEC (commun) */}
            <Section num={4} title="Prise de RDV (conseils MEC)" icon={<CalendarCheck className="w-4 h-4" />} defaultOpen accent>
              <Tips items={[
                <><b>Récupère le prénom</b> pendant le call → rend le RDV naturel (« Salut {prenom || "Mathieu"}, ça va depuis notre appel ? »).</>,
                <>Oublié ? « On est allé un peu vite, j’ai oublié de me présenter — moi c’est Nicolas. Et vous ? »</>,
                <><b>Justifie le RDV</b> : « Le site est sur mon ordi, pas en ligne — on fait un partage d’écran de 10 min. » → rend le RDV obligatoire.</>,
                <><b>Confirme le créneau</b> avant de raccrocher : « C’est noté pour [heure]. Vous me confirmez que vous aurez 10 min au calme ? J’ai passé du temps sur le site, j’ai pas envie que vous loupiez le RDV. » → anti no-show.</>,
                "Ne te bats jamais 3× pour le RDV sans expliquer pourquoi tu ne peux pas envoyer → tu passes pour un vendeur qui force.",
                "Coupe un tunnel proprement : « C’est super intéressant, mais justement par rapport à ça… »",
              ]} />
              <div className="mt-2 text-[11px] text-violet-800 dark:text-violet-200/80 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded px-2.5 py-1.5">
                Cale le créneau dans « <b>Caler un RDV</b> » sur la fiche → puis confirme par SMS. Le jour J, bascule sur l’onglet <b>Closing</b>.
              </div>
            </Section>

            {/* Scripts bonus (cold uniquement) */}
            {version === "cold" && (
              <Section title="+2 scripts bonus" icon={<Sparkles className="w-4 h-4" />}>
                <div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">Script 1 — preuve sociale + saturation</div>
                <Say>« J’ai déjà contacté 3 de vos confrères du secteur, tout le monde déborde, c’est incroyable.
                  De votre côté vous pouvez encore prendre des chantiers, ou c’est chaud aussi ? … Si je vous dis que j’ai
                  de quoi vous attirer 5 à 10 nouveaux clients par mois, vous seriez contre le fait d’écouter ? …
                  Justement j’ai pris la liberté de vous créer un site pour ça — vous seriez contre l’idée de prendre 5 min
                  pour voir si vous pourriez vous projeter ? » → RDV</Say>
                <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">Script 2 — l’inspecteur</div>
                <Say>« Bonjour, je suis l’inspecteur Nicolas au bureau de <V>{ville}</V>. J’ai vu votre nom passer ce matin,
                  la situation est grave. Une seule question : vous ne trouvez pas ça criminel qu’un <V>{metier}</V> qui fait
                  un si bon travail n’ait toujours pas de site en 2026 ? J’ai pris la liberté de vous en créer un —
                  5 min pour y jeter un œil ? » → RDV</Say>
              </Section>
            )}
          </ol>
        </>
      )}

      {mode === "closing" && (
        <>
          {/* Mindset closing */}
          <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-100/80 leading-relaxed">
            En <span className="font-semibold text-violet-700 dark:text-violet-200">visio / partage d’écran</span>, au calme.
            Tu <span className="font-semibold text-violet-700 dark:text-violet-200">creuses AVANT de montrer</span> : la douleur et l’ambition d’abord, le site ensuite.
            Le <span className="font-semibold text-violet-700 dark:text-violet-200">silence est ton allié</span> — après le prix et après le close, tu te tais.
            Objectif unique : <span className="font-semibold text-violet-700 dark:text-violet-200">activer le site aujourd’hui</span>.
          </div>

          <ol className="space-y-2">
            {/* 1 — DÉCOUVERTE */}
            <Section num={1} title="Découverte (creuser avant de montrer)" icon={<Search className="w-4 h-4" />} defaultOpen accent>
              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] first:mt-1">Reprendre contact</div>
              <Say>« Salut {greet}, ça va depuis notre appel ? Avant de vous montrer le site, j’aimerais juste comprendre
                votre situation pour qu’on regarde la bonne chose ensemble. »</Say>

              {/* Sa vie d'entreprise — clique sa réponse → relance interactive */}
              <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/5 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Sa vie d’entreprise — clique sa réponse</span>
                  {(Object.keys(biz).length > 0 || channels.length > 0) && (
                    <button type="button" onClick={() => { setBiz({}); setChannels([]); }}
                      className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline">
                      réinitialiser
                    </button>
                  )}
                </div>

                {BIZ_DIMS.map((dim) => {
                  const sel = biz[dim.key];
                  const selOpt = dim.opts.find((o) => o.key === sel);
                  return (
                    <div key={dim.key} className="mb-2.5 last:mb-0">
                      <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">{dim.q}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dim.opts.map((o) => (
                          <Chip key={o.key} active={sel === o.key} onClick={() => setBizDim(dim.key, o.key)}>{o.label}</Chip>
                        ))}
                      </div>
                      {selOpt && <Relance>{selOpt.relance}</Relance>}
                    </div>
                  );
                })}

                {/* Canaux d'acquisition actuels (multi) */}
                <div className="mb-0">
                  <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Comment il trouve ses clients aujourd’hui ? <span className="text-[var(--color-text-muted)]">(plusieurs)</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHANNELS.map((c) => (
                      <Chip key={c.key} active={channels.includes(c.key)} onClick={() => toggleChannel(c.key)}>{c.label}</Chip>
                    ))}
                  </div>
                  {channelText && (
                    <Relance>« Donc aujourd’hui vous comptez surtout sur <b>{channelText}</b>. Le jour où ça ralentit, vous faites comment ? Le site, lui, ne dépend de personne et tourne en continu. »</Relance>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">La douleur (situation actuelle)</div>
              <Ask>« Aujourd’hui, vos clients, ils vous trouvent comment ? »</Ask>
              <Ask>« Qu’est-ce qui vous embête le plus là-dedans ? »</Ask>
              <Ask>« Si rien ne change dans 6 mois, ça donne quoi pour vous ? »</Ask>

              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">L’ambition (où il veut aller)</div>
              <Ask>« Vous aimeriez développer quoi cette année — plus de chantiers, recruter, monter en gamme ? »</Ask>
              <Ask>« C’est quoi l’objectif idéal sur 12 mois si tout se passe bien ? »</Ask>
              <Ask>« Un nouveau client moyen, ça vaut combien pour vous à peu près ? »</Ask>

              <Tips items={[
                "Note ses mots exacts (douleur + ambition + le chiffre) — tu vas les réutiliser au Pont et au Prix.",
                "Questions ouvertes, pas de oui/non. Reformule (« donc si je comprends bien… ») pour qu’il se sente écouté.",
                "Ne montre RIEN tant que tu n’as pas une douleur claire ET un chiffre.",
              ]} />

              {/* Profil express cliquable → compose le Pont + l'angle */}
              <div className="mt-3 rounded-lg border border-sky-200 dark:border-sky-500/25 bg-sky-50 dark:bg-sky-500/5 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Profil express — clique pendant l’appel</span>
                  {(feelings.length > 0 || objective) && (
                    <button type="button" onClick={() => { setFeelings([]); setObjective(null); }}
                      className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline">
                      réinitialiser
                    </button>
                  )}
                </div>
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Comment il se sent aujourd’hui ? <span className="text-[var(--color-text-muted)]">(plusieurs possibles)</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {FEELINGS.map((f) => (
                    <Chip key={f.key} active={feelings.includes(f.key)} onClick={() => toggleFeeling(f.key)}>{f.label}</Chip>
                  ))}
                </div>
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mt-2.5 mb-1">Son moteur principal ?</div>
                <div className="flex flex-wrap gap-1.5">
                  {OBJECTIVES.map((o) => (
                    <Chip key={o.key} active={objective === o.key} onClick={() => setObjective(objective === o.key ? null : o.key)}>{o.label}</Chip>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-sky-700 dark:text-sky-300/80 leading-snug">
                  ↓ Ta sélection compose automatiquement le <b>Pont</b> et l’<b>angle</b> (phase 2).
                </div>
              </div>
            </Section>

            {/* 2 — LE PONT (composé depuis le profil express) */}
            <Section num={2} title="Le Pont (relier douleur → solution)" icon={<Link2 className="w-4 h-4" />} defaultOpen accent>
              <Say>« Donc si je résume avec vos mots : aujourd’hui {painText ? <V>{painText}</V> : <V>[sa douleur]</V>},
                et ce que vous voulez vraiment c’est {obj ? <V>{obj.ambition}</V> : <V>[son ambition]</V>}.
                C’est <V>exactement</V> pour ça que je vous ai préparé ce site. »</Say>
              {(!painText || !obj) && (
                <div className="text-[10px] text-[var(--color-text-muted)] italic">
                  Clique sur les ressentis et le moteur en phase 1 (Découverte) pour remplir automatiquement les passages en couleur.
                </div>
              )}
              {obj && (
                <div className="mt-1 rounded-lg border border-violet-200 dark:border-violet-500/25 bg-violet-50 dark:bg-violet-500/5 px-2.5 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)] mb-0.5">Angle conseillé — {obj.label}</div>
                  <div className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">{obj.angle}</div>
                </div>
              )}
              <Tips items={[
                "Le Pont se dit UNE seule fois, juste avant de montrer — c’est lui qui donne du sens à toute la présentation.",
                "Reprends SES mots, pas les tiens. S’il a dit « j’en ai marre de courir après les devis », redis « courir après les devis ».",
                "Ne surcharge pas : douleur → ambition → « c’est pour ça que ». Puis tu enchaînes direct sur la présentation.",
              ]} />
            </Section>

            {/* 3 — PRÉSENTATION */}
            <Section num={3} title="Présentation du site" icon={<Presentation className="w-4 h-4" />} defaultOpen accent>
              <Say>« Je vous le montre, et vous me dites ce que vous en pensez. »
                <span className="text-[var(--color-text-muted)]"> (partage d’écran, puis silence — laisse-le réagir en premier)</span></Say>
              <Say>« Là c’est votre page d’accueil avec <V>{metier}</V> à <V>{ville}</V>, vos avis, le bouton pour vous appeler.
                Ça vous ressemble ? On garde comme ça ? »</Say>
              {obj && (
                <div className="rounded-lg border border-violet-200 dark:border-violet-500/25 bg-violet-50 dark:bg-violet-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-accent)]">Garde l’angle « {obj.label} » : </span>{obj.angle}
                </div>
              )}
              <Tips items={[
                "Ne dis JAMAIS « c’est beau / c’est top » à sa place : pose des questions, laisse-le conclure que c’est bien.",
                "Fais-le valider section par section (« on garde ? ») → chaque oui est un micro-engagement.",
                "Note ses demandes de modif : ça veut dire qu’il se projette comme proprio du site → signal d’achat.",
                <>Projection : « Quand un client cherchera un <V>{metier}</V> à <V>{ville}</V> et tombera là-dessus, il vous appelle direct. »</>,
              ]} />
            </Section>

            {/* 4 — LE PRIX */}
            <Section num={4} title="Annonce du prix (ancrage)" icon={<BadgeEuro className="w-4 h-4" />} defaultOpen accent>
              <Say>« En agence, un site comme ça c’est <V>1000 à 3000€</V>. Nous, on a tout automatisé :
                c’est <V>299€</V>, site complet, mis en ligne. »</Say>
              <Say>« Un <V>seul client</V> trouvé via le site et il est déjà remboursé. »
                <span className="text-[var(--color-text-muted)]"> (puis tais-toi)</span></Say>
              <Tips items={[
                "Annonce le prix avec assurance, sans t’excuser et sans meubler derrière. Le premier qui parle après le prix est en position basse.",
                "Rappelle la valeur d’un client qu’il a donnée en découverte : « vous m’avez dit qu’un client vaut [X]€ → 299€ vs [X]€. »",
                "Pas de remise spontanée. S’il négocie, c’est qu’il est déjà acheteur → passe au close.",
              ]} />
            </Section>

            {/* 5 — CONCLUSION / CLOSE */}
            <Section num={5} title="Conclusion (le close)" icon={<Handshake className="w-4 h-4" />} defaultOpen accent>
              <Say>« On l’<V>active</V> pour votre activité ? »
                <span className="text-[var(--color-text-muted)]"> → SILENCE absolu. La prochaine personne qui parle a perdu.</span></Say>
              <ObjTitle>Variantes de close</ObjTitle>
              <Tips items={[
                <><b>Choix alternatif</b> : « On part sur une mise en ligne cette semaine, ou plutôt la semaine prochaine ? »</>,
                <><b>Récap</b> : « Donc : site complet, vos avis, mis en ligne, 299€. On y va ? »</>,
                <><b>Logistique = oui implicite</b> : « Je prends juste le nom exact de la boîte et on lance la mise en ligne. »</>,
              ]} />
              <div className="mt-2 text-[11px] text-violet-800 dark:text-violet-200/80 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded px-2.5 py-1.5">
                Dès le « oui » : verrouille le <b>paiement</b> (lien/CB) et le <b>délai de mise en ligne</b> tout de suite, tant qu’il est chaud. Puis passe la fiche en <b>Positif</b>.
              </div>
            </Section>

            {/* 6 — OBJECTIONS DE CLOSING */}
            <Section num={6} title="Objections de closing" icon={<ShieldAlert className="w-4 h-4" />}>
              <ObjTitle>« Je vais réfléchir »</ObjTitle>
              <Say>« Bien sûr. Juste pour comprendre : qu’est-ce qui vous ferait hésiter <V>exactement</V> ? »
                <span className="text-[var(--color-text-muted)]"> (jamais « prenez votre temps » → il oublie)</span></Say>

              <ObjTitle>« C’est cher / je n’ai pas le budget »</ObjTitle>
              <Say>« Je comprends. Vous m’avez dit qu’un client vaut <V>[X]€</V> pour vous. Là on parle de 299€ une fois,
                site à vous, en ligne. La vraie question c’est : est-ce que ça vous en ramène au moins un ? »</Say>
              <Tips items={["S’il bloque vraiment sur la trésorerie : « Qu’est-ce qui devrait se passer pour que ce soit le bon moment ? »"]} />

              <ObjTitle>« Faut que j’en parle à (associé / conjoint) »</ObjTitle>
              <Say>« Logique. Si ça ne tenait qu’à <V>vous</V>, vous le feriez ? »
                <span className="text-[var(--color-text-muted)]"> (si oui → cale un rappel précis à 3, avec la date/heure notée)</span></Say>

              <ObjTitle>« Je vais le faire moi-même / avec quelqu’un »</ObjTitle>
              <Say>« Vous pouvez, clairement. Mais entre le temps à y passer et le résultat — là il est <V>déjà fait</V>,
                il vous ressemble, et il est en ligne aujourd’hui. C’est ça que vous voulez, non ? »</Say>

              <Tips items={["Traite l’objection → reformule → re-close. Ne laisse jamais une objection sans revenir au « on y va ? »."]} />
            </Section>
          </ol>
        </>
      )}

      <div className="mt-3 text-center text-[10px] text-[var(--color-text-muted)] leading-relaxed">
        Source : formation Léo / systeme.io · Telyos
      </div>
    </div>
  );
}
