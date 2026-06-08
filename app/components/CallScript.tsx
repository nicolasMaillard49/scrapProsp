"use client";

import { useEffect, useState } from "react";
import {
  PhoneCall, MessageSquare, Phone, Megaphone, ShieldAlert, CalendarCheck,
  ChevronDown, Sparkles, Flame, Target,
} from "lucide-react";
import type { Prospect } from "../lib/types";
import { metierLabel } from "../maquette/templates/data";

/** "ALEXIS" / "alexis bernard" -> "Alexis" (1er prénom, capitalisé). */
function firstName(prenom?: string | null): string {
  const f = (prenom ?? "").trim().split(/\s+/)[0] ?? "";
  if (!f) return "";
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

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

type Version = "sms" | "cold";

export default function CallScript({
  prospect,
  smsSent,
}: {
  prospect: Prospect;
  smsSent: boolean;
}) {
  // Par défaut : version « site déjà envoyé par SMS » si un SMS est parti, sinon « découverte au tél ».
  const [version, setVersion] = useState<Version>(smsSent ? "sms" : "cold");

  useEffect(() => {
    setVersion(smsSent ? "sms" : "cold");
  }, [smsSent, prospect.id]);

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
        <PhoneCall className="w-4 h-4 text-[var(--color-accent)]" />
        Script d’appel — RDV
      </div>

      {/* Sélecteur de version */}
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
          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-1">« J’ai le bouche-à-oreille »</div>
          <Say>« C’est très bien le bouche-à-oreille. Mais s’il vient à diminuer <V>OU</V> que vous voulez plus de clients —
            vous faites comment ? Vous êtes dépendant de ce que les gens racontent, ou vous pouvez activer un levier ? »</Say>
          <Tips items={["Dire « OU » et pas « ET » : 2 scénarios, pas d’échappatoire.", "Ne jamais dire « si ça s’arrête » → « ça marche depuis 10 ans, pourquoi ça s’arrêterait ? »"]} />

          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">« Je travaille seul, ça me suffit »</div>
          <Say>« Félicitations. Vous travaillez seul ou vous avez des gens à déléguer ? … Donc vous n’avez pas
            vraiment l’ambition de développer votre boîte ? » <span className="text-[var(--color-text-muted)]">(il se défend → ouverture)</span></Say>
          <Tips items={["Si c’est l’été : « Pour avoir des résultats en hiver, faut commencer maintenant. »"]} />

          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">« On m’a déjà appelé pour ça »</div>
          <Say>« Ça ne m’étonne pas. Mais qu’est-ce qui a fait que vous n’avez pas dit oui à l’autre personne ? »
            <span className="text-[var(--color-text-muted)]"> (il sort sa vraie objection)</span></Say>
          <Tips items={["S’il a déjà payé : arrête, c’est mort. Ne demande JAMAIS toi-même « vous avez déjà payé ? »"]} />

          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">« C’est quoi le prix ? »</div>
          <Say>« L’intérêt c’est qu’on voie ensemble si le site vous plaît, ensuite on parle modifs et prix.
            Mais déjà, ça vous intéresse de jeter un œil ? Pour l’instant c’est <V>totalement gratuit</V> de regarder. »</Say>

          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">« Un site sans trafic ça sert à rien »</div>
          <Say>« Certes. Mais vous avez du bouche-à-oreille — donc des gens cherchent déjà votre nom. Là ils tombent sur quoi ?
            Une fiche Google avec 3 photos. Avec un site, vous convertissez beaucoup plus. »</Say>
          <Tips items={["Tu plugues ton offre sur ce qu’il a déjà : suite logique, pas contrainte."]} />

          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-3">« Envoyez-moi ça par mail »</div>
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
            Cale le créneau dans « <b>Caler un RDV</b> » sur la fiche → puis confirme par SMS.
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

        {/* Après le RDV : le closing (référence) */}
        <Section title="Après le RDV : le call de closing (299€)" icon={<Target className="w-4 h-4" />}>
          <Tips items={[
            <><b>Le Pont</b> : ne présente JAMAIS le site avant d’avoir creusé la douleur ET l’ambition. Reformule avec ses mots : « Aujourd’hui tu souffres de X, ce que tu veux c’est Y — et c’est exactement pour ça que je t’ai préparé ce site. » (UNE seule fois)</>,
            "Présentation en visio / partage d’écran (rassure, moins de raccrochage).",
            <><b>Prix</b> : « Chez une agence c’est 1000-3000€. Nous on a automatisé, on est à 299€, site complet mis en ligne. Un seul client trouvé via le site et il est remboursé. »</>,
            <><b>Close</b> : « On l’active pour ton activité ? » → silence absolu, la prochaine personne qui parle a perdu.</>,
            "Objection « je réfléchis » : ne jamais dire « prends ton temps » → « Qu’est-ce qui te ferait hésiter exactement ? »",
          ]} />
        </Section>
      </ol>

      <div className="mt-3 text-center text-[10px] text-[var(--color-text-muted)] leading-relaxed">
        Source : formation Léo / systeme.io · Telyos
      </div>
    </div>
  );
}
