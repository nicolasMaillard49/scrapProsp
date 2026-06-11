"use client";

import { useEffect, useState } from "react";
import {
  PhoneCall, MessageSquare, Phone, Megaphone, ShieldAlert, CalendarCheck,
  ChevronDown, Sparkles, Flame, Search, Link2, Presentation, BadgeEuro, Handshake,
  Gift, ClipboardList,
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

/* ════════════════ GOOGLE ADS — semaine test (source : formation 10K, « Scripts Google Ads ») ════════════════ */

/** Réaction au hook d'ouverture (phase 1) — clique sa réaction → la suite dédiée. */
const ADS_HOOK_REACTIONS = [
  { key: "joue", label: "😄 Il rit / « allez-y »", relance: "Il joue le jeu — enchaîne direct sur la Question d'entrée." },
  { key: "froid", label: "😐 « C'est quoi ça ? » / froid", relance: "« C'est simple — j'ai juste une question sur comment vous trouvez vos clients aujourd'hui. 30 secondes. » → il accepte → Question d'entrée." },
  { key: "pastemps", label: "❌ « J'ai pas le temps »", relance: "« Pas de souci. Je vous rappelle quand ça vous arrange — matin ou après-midi en général ? » Tu notes le rappel et tu raccroches proprement. Pas d'insistance." },
] as const;

/** État de son site (phase 2 — à regarder AVANT l'appel) — clique → la phrase dédiée. */
const ADS_SITE_STATE = [
  { key: "basique", label: "Site basique", relance: "« J'ai regardé ton site avant l'appel. Je vais être honnête avec toi — il est pas exceptionnel, mais ça ira largement pour tester et avoir tes premiers résultats. Si derrière ça marche, tu pourras investir dans quelque chose de plus optimisé. Mais pour le test — t'as déjà la base, c'est l'essentiel. »" },
  { key: "correct", label: "Site correct", relance: "« J'ai jeté un œil à ton site avant l'appel — il est bien, on a tout ce qu'il faut pour démarrer. La base est là. »" },
] as const;

interface AdsObjection {
  key: string;
  label: string;
  line: string;
  reponse: string;
}

/** Objections phase 1 — Prospection (vouvoiement), dans l'ordre de la formation. */
const ADS_OBJ_RDV: AdsObjection[] = [
  { key: "pub", label: "🔵 C'est de la pub alors ?",
    line: "« En gros c'est de la pub votre truc ? »",
    reponse: "« Oui, mais la différence c'est qu'on vise uniquement les gens qui cherchent déjà votre service. On ne va pas les convaincre — ils sont déjà en train de chercher. »" },
  { key: "dejagoogle", label: "🟡 Je suis déjà sur Google",
    line: "« Je suis déjà sur Google, ça me sert à quoi ? »",
    reponse: "« Parfait, ça veut dire qu'on peut simplement vous rendre plus visible pendant une semaine pour voir la différence. »" },
  { key: "mail", label: "🔴 Envoyez-moi un mail",
    line: "« Envoyez-moi tout ça par mail, je regarderai. »",
    reponse: "« Je peux vous envoyer un résumé, mais ça ne remplacera pas les 10 minutes où on regarde ensemble votre cas. On se cale un créneau rapide et ensuite je vous envoie tout par mail. »" },
  { key: "reflechir", label: "⏳ Pas le temps / je dois réfléchir",
    line: "« Là j'ai pas le temps, faut que je réfléchisse. »",
    reponse: "« Bien sûr. Là on ne prend pas de décision long terme — c'est juste 10 minutes pour voir si ça a du sens pour vous. Vous êtes dispo mardi matin ou mercredi après-midi ? »" },
  { key: "budget", label: "💰 J'ai pas le budget",
    line: "« J'ai pas le budget pour ça en ce moment. »",
    reponse: "« Justement, on démarre avec un petit budget pour tester sans engager de grosses sommes. L'idée n'est pas d'investir — c'est de vérifier si ça peut vous apporter quelque chose. »" },
  { key: "boa", label: "💬 Je fonctionne au bouche-à-oreille",
    line: "« Mes clients viennent par bouche-à-oreille, j'ai pas besoin de ça. »",
    reponse: "« C'est très bien, ça ne remplace pas ça. On ajoute juste une source en plus quand les gens cherchent directement sur Google. »" },
];

/** Objections phase 2 — Closing semaine test (tutoiement), dans l'ordre de la formation. */
const ADS_OBJ_CLOSE: AdsObjection[] = [
  { key: "750", label: "💸 Il hésite sur les 750€/mois",
    line: "« 750 balles par mois quand même… »",
    reponse: "« Je comprends que ça fasse grimacer — c'est normal, tu sais pas encore ce que ça rapporte. C'est justement l'idée du test : tu vois les résultats, on fait les calculs ensemble, et tu décides toi-même si c'est rentable. Le prix ne s'applique que si tu veux continuer. » ⏸ Puis silence. Tu ne négocies pas — tu reframes sur le test." },
  { key: "100", label: "💳 Il bloque sur les 100€ Google",
    line: "« Même 100€, j'ai pas envie de les jeter par la fenêtre. »",
    reponse: "« Le pire scénario : ça ne donne rien, t'es fixé pour 100€. C'est le prix de savoir. Si tu ne testes pas — la situation reste exactement comme aujourd'hui. L'idée du test c'est pas de prendre un risque, c'est de voir si on peut changer ta situation rapidement. » ⏸ Puis silence." },
  { key: "dejaboulot", label: "💼 J'ai déjà assez de travail",
    line: "« J'ai déjà assez de boulot, je vais pas savoir où donner de la tête. »",
    reponse: "« Justement, l'idée n'est pas de t'inonder. On démarre doucement pour voir la qualité des demandes, pas la quantité. Tu gardes totalement la main — tu réponds à ce qui t'intéresse. »" },
  { key: "essaye", label: "😤 Déjà essayé, ça n'a pas marché",
    line: "« J'ai déjà essayé Google Ads, ça n'a rien donné. »",
    reponse: "« C'est exactement pour ça qu'on fait un test court. On ne te demande pas de repartir sur des mois — juste de voir si ça réagit différemment quand c'est configuré correctement par un expert dédié. »" },
  { key: "connaisrien", label: "🤷 J'y connais rien à Google",
    line: "« Moi Google, les pubs, tout ça… j'y connais rien. »",
    reponse: "« Parfait — c'est exactement pour ça qu'on a un expert Google Ads dédié qui s'en occupe entièrement. Toi tu reçois juste les appels. Le formulaire c'est 2 minutes — après c'est lui qui gère tout. »" },
  { key: "reflechir", label: "⏳ Je dois réfléchir / en parler",
    line: "« Faut que je réfléchisse / que j'en parle. »",
    reponse: "« Bien sûr. On prend pas de décision sur du long terme — c'est juste une semaine pour voir. Je te laisse le formulaire, tu le remplis quand t'es prêt. Dès que c'est fait, l'expert lance. » → Le formulaire envoyé = le fil reste attaché." },
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
              1. Prospection (tél)
            </button>
            <button onClick={() => setAdsStep("test")} className={`${tabBase} ${adsStep === "test" ? tabOn : tabOff}`}>
              <Presentation className="w-3.5 h-3.5" />
              2. Closing test (visio)
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
              {/* Mindset prospection Ads */}
              <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-100/80 leading-relaxed">
                Tu ne vends <span className="font-semibold text-violet-700 dark:text-violet-200">rien aujourd&apos;hui</span> : tu proposes un{" "}
                <span className="font-semibold text-violet-700 dark:text-violet-200">test gratuit</span> d&apos;une semaine.
                Une étape à la fois, <span className="font-semibold text-violet-700 dark:text-violet-200">silence après chaque question</span>.
                Objectif unique : <span className="font-semibold text-violet-700 dark:text-violet-200">la visio de 10 min</span>.
              </div>

              <ol className="space-y-2">
                <Section num={1} title="Hook d'ouverture (5 secondes)" icon={<PhoneCall className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Allo, je suis bien avec <V>[entreprise]</V> ?
                    Si je vous dis que c&apos;est un appel de prospection, vous jetez directement le téléphone par la fenêtre…
                    ou vous me laissez <V>30 secondes chrono</V> pour vous expliquer ? »</Say>
                  <Tips items={["⏸ Silence. Laisse-le réagir — la plupart vont sourire ou dire « allez-y »."]} />
                  <div className="mt-2">
                    <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Il réagit comment ? — clique sa réaction</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ADS_HOOK_REACTIONS.map((o) => (
                        <Chip key={o.key} active={adsSit.hook === o.key} onClick={() =>
                          setAdsSit((prev) => prev.hook === o.key
                            ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== "hook"))
                            : { ...prev, hook: o.key })
                        }>{o.label}</Chip>
                      ))}
                    </div>
                    {adsSit.hook && <Relance>{ADS_HOOK_REACTIONS.find((o) => o.key === adsSit.hook)?.relance}</Relance>}
                  </div>
                </Section>

                <Section num={2} title="Question d'entrée" icon={<Search className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Parfait. J&apos;ai juste une petite question avant.
                    Aujourd&apos;hui, vos clients vous trouvent plutôt comment ? Bouche à oreille ? Via votre site web ? Un peu les deux ? »</Say>
                  <Say>« OK, donc principalement comme ça aujourd&apos;hui. »</Say>
                  <Tips items={[
                    "⏸ Laisse répondre. Ne coupe pas, ne suggère pas.",
                    "Peu importe ce qu'il dit — tu valides sa réponse et tu enchaînes pareil. Pas de débat, pas d'analyse.",
                  ]} />
                </Section>

                <Section num={3} title="Le mécanisme (20 secondes)" icon={<Megaphone className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Vous voyez quand quelqu&apos;un tape sur Google : « <V>{metier} {ville}</V> » ?
                    Notre travail c&apos;est simplement de faire apparaître votre entreprise devant ces personnes-là.
                    Pour faire en sorte qu&apos;ils vous choisissent <V>vous</V> plutôt que vos concurrents. »</Say>
                  <Tips items={["Pourquoi ça marche : il comprend immédiatement — ce sont des gens déjà en train de chercher, pas besoin de les convaincre."]} />
                </Section>

                <Section num={4} title="Proposition de valeur — le test gratuit" icon={<Gift className="w-4 h-4" />} defaultOpen accent>
                  <Say>« On vous propose simplement de mettre ça en place pour vous et de <V>tester ça gratuitement pendant 1 semaine</V>.
                    On met votre entreprise en avant sur Google, et vous recevrez chaque jour des prospects en automatique. »</Say>
                  <Say>« Vous n&apos;avez <V>aucun risque</V> à prendre — c&apos;est nous qui faisons tout pour vous.
                    On travaille déjà avec plein d&apos;entreprises à travers la France pour qui ça fonctionne très bien. »</Say>
                  <Tips items={["Précision importante : pas de frais de gestion pendant la semaine test. Juste un petit budget Google à prévoir — entre 10 et 20€/jour — pour que les annonces tournent."]} />
                </Section>

                <Section num={5} title="Projection + CTA RDV" icon={<CalendarCheck className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Si on lance demain, vous pouvez commencer à recevoir des contacts <V>dès après-demain</V>.
                    Vous pensez que ça vaut le coup de tester et voir ce que ça donne ? »
                    <span className="text-[var(--color-text-muted)]"> ⏸ Silence. Attends sa réponse.</span></Say>
                  <ObjTitle>S&apos;il dit oui</ObjTitle>
                  <Say>« Le plus simple, c&apos;est qu&apos;on vous montre ça rapidement <V>en visio</V>. En 10 minutes vous verrez
                    exactement comment ça fonctionne. Vous êtes plus dispo le matin ou l&apos;après-midi en général ? »</Say>
                  <Tips items={[
                    "Toujours une question fermée pour fixer le créneau — jamais « quand êtes-vous dispo ? ».",
                    <>Cale le créneau dans « <b>Caler un RDV</b> » sur la fiche → confirme par SMS → le jour J, bascule sur <b>2. Semaine test</b>.</>,
                  ]} />
                </Section>

                <Section num={6} title="Objections (prospection)" icon={<ShieldAlert className="w-4 h-4" />} defaultOpen>
                  <AdsObjections items={ADS_OBJ_RDV} />
                </Section>
              </ol>
            </>
          ) : (
            <>
              {/* Mindset closing semaine test */}
              <div className="mb-3 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 text-[11px] text-violet-800 dark:text-violet-100/80 leading-relaxed">
                En <span className="font-semibold text-violet-700 dark:text-violet-200">visio</span>, tutoiement{" "}
                <span className="font-semibold text-violet-700 dark:text-violet-200">glissé sans le demander</span>.
                Diagnostic <span className="font-semibold text-violet-700 dark:text-violet-200">avant</span> l&apos;offre,
                les chiffres dans l&apos;ordre (<span className="font-semibold text-violet-700 dark:text-violet-200">gratuit → ~100€ Google → 750€/mois TTC</span>),
                <span className="font-semibold text-violet-700 dark:text-violet-200"> silence</span> après le prix et après le close.
                Objectif : <span className="font-semibold text-violet-700 dark:text-violet-200">formulaire rempli pendant l&apos;appel</span>.
              </div>

              <ol className="space-y-2">
                <Section num={1} title="Brise-glace + cadrage" icon={<Handshake className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Salut {greet} ! Comment tu vas ? T&apos;es où là, t&apos;es sur un chantier ou au bureau ? »</Say>
                  <Tips items={[
                    "1 à 2 min max. Rebondis sur ce qu'il dit — région, métier, activité (« ah ouais, je connais bien cette région ! », « ça bosse dur en ce moment ! »).",
                    "Tutoiement : tu l'utilises naturellement dès le début, sans demander. S'il te vouvoie encore — continue de le tutoyer, il suit dans les 2 minutes.",
                  ]} />
                  <ObjTitle>Puis cadrage de l&apos;appel</ObjTitle>
                  <Say>« Bon, je vais pas te prendre trop de temps. L&apos;idée aujourd&apos;hui c&apos;est simple — on va voir ensemble
                    si on peut t&apos;amener des <V>demandes de clients en plus</V> rapidement via Google.
                    Si ça a du sens on lance le test. Sinon on ne perd pas plus de temps — ça te va ? »</Say>
                </Section>

                <Section num={2} title="Positionnement — « pas comme les autres »" icon={<Sparkles className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Moi je suis de la team de d&apos;abord te <V>démontrer ma valeur</V>, t&apos;apporter des résultats…
                    et puis après te demander de t&apos;investir. Tout simplement. »</Say>
                  <ObjTitle>S&apos;il a déjà été déçu par une autre agence</ObjTitle>
                  <Say>« Je comprends tout à fait, je me mets à ta place. On n&apos;est pas du tout de la même école que ces gens-là.
                    C&apos;est pour ça qu&apos;on teste d&apos;abord — tu vois les résultats <V>avant</V> de sortir le moindre euro pour notre service. »</Say>
                  <Tips items={["Ton : humain, direct. Tu n'es pas là pour vendre — tu expliques comment tu travailles."]} />
                </Section>

                <Section num={3} title="Diagnostic — site + 3 questions" icon={<Search className="w-4 h-4" />} defaultOpen accent>
                  <div className="mb-1">
                    <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Son site (à regarder AVANT l&apos;appel) — clique</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ADS_SITE_STATE.map((o) => (
                        <Chip key={o.key} active={adsSit.site === o.key} onClick={() =>
                          setAdsSit((prev) => prev.site === o.key
                            ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== "site"))
                            : { ...prev, site: o.key })
                        }>{o.label}</Chip>
                      ))}
                    </div>
                    {adsSit.site && <Relance>{ADS_SITE_STATE.find((o) => o.key === adsSit.site)?.relance}</Relance>}
                  </div>
                  <ObjTitle>Puis les 3 questions</ObjTitle>
                  <Ask>« T&apos;as de la <V>marge</V> pour accueillir de nouveaux clients en ce moment, ou t&apos;es déjà bien chargé ? »</Ask>
                  <Ask>« T&apos;interviens dans un <V>rayon de combien de kilomètres</V> autour de chez toi à peu près ? »</Ask>
                  <Ask>« C&apos;est quoi le <V>service que tu veux vraiment mettre en avant</V> ? Celui avec lequel t&apos;es le plus rentable ? »
                    <span className="text-[var(--color-text-muted)]"> — la plus importante</span></Ask>
                  <Tips items={["Note ses réponses : rayon + service prioritaire = tu les transmets à l'expert qui configure les campagnes."]} />
                </Section>

                <Section num={4} title="Le mécanisme — coquille vide" icon={<Link2 className="w-4 h-4" />} defaultOpen accent>
                  <Say>« En fait, un site web sans trafic dessus — c&apos;est une <V>coquille vide</V>. C&apos;est joli, mais s&apos;il n&apos;y a
                    personne qui passe dessus, il te ramène aucun client. Ce qu&apos;on fait, c&apos;est l&apos;inverse :
                    notre expert Google Ads se positionne sur les mots clés des gens qui tapent déjà « <V>{metier} {ville}</V> ».
                    Il met ton entreprise devant eux au moment exact où ils en ont besoin.
                    On ne convainc personne — on capte des gens qui cherchent <V>déjà activement</V> ton service. »</Say>
                  <ObjTitle>Stratégie mot-clé</ObjTitle>
                  <Say>« Ce que notre expert va faire, c&apos;est pas te mettre sur tout en même temps. On prend d&apos;abord ta place sur le
                    service le plus rentable pour toi — le <V>[service prioritaire]</V> dans un rayon de <V>[X] km</V> autour de chez toi.
                    On fait grandir ça au même rythme que ta boîte. »</Say>
                  <Tips items={["Pas besoin de chiffres : tu t'appuies sur ce qu'il t'a dit — son service et sa zone. L'expert gère le reste."]} />
                </Section>

                <Section num={5} title="L'offre — qui paye quoi" icon={<BadgeEuro className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Concrètement, pendant la semaine test — tu ne payes <V>pas notre service</V>. C&apos;est offert.
                    En revanche, vu qu&apos;on fonctionne avec de la pub Google, y&apos;a un petit budget pub à prévoir.
                    C&apos;est pas nous que tu payes — c&apos;est <V>directement Google</V>. Et c&apos;est minime :
                    environ <V>10 à 15€ par jour</V>, donc sur une semaine ça fait à peu près <V>100€</V> en tout. »</Say>
                  <ObjTitle>Le prix mensuel — calme et assumé</ObjTitle>
                  <Say>« Si à la fin de la semaine tu vois que ça te ramène des clients et que t&apos;as envie de continuer —
                    notre forfait mensuel de gestion, il est à <V>750€ par mois TTC</V>.
                    Mais ça, tu le décides seulement <V>après</V> avoir vu les résultats. »
                    <span className="text-[var(--color-text-muted)]"> ⏸ Silence après le prix. Ne justifie pas.</span></Say>
                  <Tips items={[
                    "S'il demande comment payer : les fonds se mettent directement sur le compte Google Ads — carte éphémère possible, pas besoin de laisser une carte en permanence.",
                    "C'est normal que le prix fasse grimacer — c'est exactement pour ça que la semaine test existe.",
                  ]} />
                </Section>

                <Section num={6} title="Preuve + recadrage valeur" icon={<Presentation className="w-4 h-4" />} defaultOpen accent>
                  <Say>« Pour te donner un exemple — notre expert a fait la même chose avec un <V>paysagiste</V> y&apos;a pas longtemps.
                    Même profil que toi : chantiers réguliers, facturation entre 5 et 10k€.
                    Sur la semaine de test, on a sorti <V>15 000€ de chiffre d&apos;affaires</V>. Évidemment il a voulu continuer. »
                    <span className="text-[var(--color-text-muted)]"> (15k€ la semaine test → 120k€ en 3 mois)</span></Say>
                  <Say>« Je te mens pas — je peux pas te garantir exactement les mêmes chiffres. Mais ce que je peux t&apos;assurer,
                    c&apos;est que notre expert va pas bosser une semaine pour rien. On a <V>besoin</V> que t&apos;aies des résultats —
                    c&apos;est la seule raison pour laquelle tu voudras continuer avec nous. »</Say>
                  <ObjTitle>Recadrage valeur (le pire scénario)</ObjTitle>
                  <Say>« Regarde les deux cas simplement. T&apos;investis 100€ sur la semaine — le pire scénario : ça ne donne rien,
                    t&apos;es fixé pour 100€. C&apos;est <V>le prix de savoir</V>. Si tu ne testes pas — la situation reste exactement
                    comme aujourd&apos;hui. La vraie question c&apos;est pas les 100€. C&apos;est : est-ce que je veux changer ma situation ou pas. »
                    <span className="text-[var(--color-text-muted)]"> ⏸ Silence. Puis :</span></Say>
                  <Say>« L&apos;idée du test c&apos;est pas de prendre un risque. C&apos;est de voir si on peut changer ta situation rapidement. »</Say>
                </Section>

                <Section num={7} title="Le close + formulaire" icon={<CalendarCheck className="w-4 h-4" />} defaultOpen accent>
                  <Say>« C&apos;est bon pour toi tout ça ? »
                    <span className="text-[var(--color-text-muted)]"> → SILENCE total. La prochaine personne qui parle a perdu. Tiens-le.</span></Say>
                  <ObjTitle>Dès le oui — reste pro, pas de célébration</ObjTitle>
                  <Say>« Super. Pour qu&apos;on puisse tout mettre en place, je vais te faire remplir un petit <V>formulaire</V> —
                    ça prend 2 minutes. Ça donne à notre expert Google Ads toutes les infos pour configurer les campagnes :
                    ton site, ta zone, les services à mettre en avant… Je te l&apos;envoie par message là maintenant.
                    T&apos;as 2 minutes pour le faire <V>pendant qu&apos;on est en ligne</V> ? »</Say>
                </Section>

                <Section num={8} title="Logistique (après le oui)" icon={<ClipboardList className="w-4 h-4" />} defaultOpen>
                  <ObjTitle>✅ Il remplit en live — idéal, momentum intact</ObjTitle>
                  <Tips items={[
                    "Envoie le lien formulaire par SMS / WhatsApp pendant l'appel, reste en ligne et guide-le (« c'est juste ton nom, site, zone et service principal »).",
                    "Formulaire reçu → transmets à l'expert qui crée le compte Google Ads et envoie l'invitation email.",
                    "Il met les fonds (~100€) sur le compte Google Ads — carte éphémère possible.",
                    "L'expert te prévient quand c'est live → tu envoies un message au client.",
                    <>Fixe un RDV dans une semaine pour faire les calculs ensemble — cale-le dans « <b>Caler un RDV</b> » et passe la fiche en <b>Positif</b>.</>,
                  ]} />
                  <Say>« Nickel, j&apos;ai tout ce qu&apos;il faut. Notre expert va tout configurer — je te ferai signe dès que les campagnes
                    sont en ligne. Dans une semaine on se rappelle, on fait nos petits calculs. Très belle fin de journée à toi ! »</Say>
                  <ObjTitle>⏰ « Je le fais après » — sécurise le suivi</ObjTitle>
                  <Say>« Pas de souci. Je te l&apos;envoie dans la foulée — ça prend vraiment 2 minutes.
                    Dès que tu l&apos;as rempli, notre expert configure tout dans la journée. »</Say>
                  <Tips items={[
                    "Envoie le lien immédiatement après avoir raccroché (max 5 min). Chaque heure qui passe, le momentum baisse.",
                    "Pas de formulaire sous 24h → relance : « Salut [prénom], j'ai tout prêt de notre côté, il me manque juste le formulaire pour que l'expert lance. T'as 2 minutes ? »",
                  ]} />
                </Section>

                <Section num={9} title="Objections (closing)" icon={<ShieldAlert className="w-4 h-4" />} defaultOpen>
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
