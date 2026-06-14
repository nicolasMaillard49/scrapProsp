"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Config dupliquée côté client (les constantes serveur ne sont pas importables ici sans "use server").
const EMPLOYEES = [
  { value: "solo", label: "Je travaille seul", hint: "Solo" },
  { value: "2_5", label: "2 à 5", hint: "Petite équipe" },
  { value: "6_15", label: "6 à 15", hint: "Équipe" },
  { value: "gt_15", label: "Plus de 15", hint: "Structure" },
];
const CA_RANGES = [
  { value: "lt_5k", label: "Moins de 5 000 € /mois" },
  { value: "5k_15k", label: "5 000 – 15 000 € /mois" },
  { value: "15k_50k", label: "15 000 – 50 000 € /mois" },
  { value: "gt_50k", label: "Plus de 50 000 € /mois" },
];
const AD_BUDGETS = [
  { value: "lt_500", label: "Moins de 500 € /mois", hint: "Petit" },
  { value: "500_1000", label: "500 – 1 000 € /mois", hint: "Standard" },
  { value: "1000_3000", label: "1 000 – 3 000 € /mois", hint: "Ambitieux" },
  { value: "gt_3000", label: "Plus de 3 000 € /mois", hint: "Agressif" },
];
const GOALS = [
  { value: "plus_30", label: "+30 % de CA", hint: "Confortable" },
  { value: "plus_50", label: "+50 % de CA", hint: "Ambitieux" },
  { value: "plus_100", label: "Doubler mon CA", hint: "Très ambitieux" },
  { value: "double", label: "Changer de dimension", hint: "Maximal" },
];

interface Props {
  token: string;
  metier: string;
  ville: string;
  phone: string;
}

export default function QuizForm({ token, metier, ville, phone }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState({
    metier,
    ville,
    radius_km: 10,
    site_url: "",
    employees_range: "",
    ca_range: "",
    ad_budget_range: "",
    goal_range: "",
    first_name: "",
    last_name: "",
    email: "",
    phone,
  });

  const set = (k: string, v: unknown) => setA((p) => ({ ...p, [k]: v }));
  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/eligibilite/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...a }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      router.push(`/eligibilite/rapport/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setSubmitting(false);
    }
  }

  const STEPS = [
    {
      q: "Votre métier",
      sub: "On adapte toute la campagne à votre activité.",
      body: (
        <input
          className="input"
          value={a.metier}
          onChange={(e) => set("metier", e.target.value)}
          placeholder="Ex : Paysagiste"
        />
      ),
      can: () => a.metier.trim().length > 1,
    },
    {
      q: "Dans quelle ville exercez-vous ?",
      sub: "On garantit l'exclusivité sur votre zone géographique.",
      body: (
        <input
          className="input"
          value={a.ville}
          onChange={(e) => set("ville", e.target.value)}
          placeholder="Ex : Niort"
        />
      ),
      can: () => a.ville.trim().length > 1,
    },
    {
      q: `Quel rayon autour de ${a.ville || "votre ville"} ?`,
      sub: "On cible les internautes qui cherchent depuis cette zone.",
      body: (
        <div>
          <div className="text-3xl font-bold text-center mb-2">{a.radius_km} km</div>
          <input
            type="range"
            min={0}
            max={50}
            value={a.radius_km}
            onChange={(e) => set("radius_km", Number(e.target.value))}
            className="w-full accent-orange-500"
          />
        </div>
      ),
      can: () => true,
    },
    {
      q: "Quelle est l'adresse de votre site web ?",
      sub: "On l'analyse pour repérer votre service le plus rentable.",
      body: (
        <input
          className="input"
          value={a.site_url}
          onChange={(e) => set("site_url", e.target.value)}
          placeholder="exemple-paysagiste.fr"
        />
      ),
      can: () => true,
    },
    {
      q: "Combien êtes-vous dans l'équipe ?",
      sub: "On calibre le volume de leads à votre capacité de réponse.",
      body: <Choices opts={EMPLOYEES} value={a.employees_range} onPick={(v) => { set("employees_range", v); }} />,
      can: () => !!a.employees_range,
    },
    {
      q: "Quel est votre CA mensuel actuel ?",
      sub: "Sert à calculer votre potentiel ROI.",
      body: <Choices opts={CA_RANGES} value={a.ca_range} onPick={(v) => set("ca_range", v)} />,
      can: () => !!a.ca_range,
    },
    {
      q: "Quel budget pub Google par mois ?",
      sub: "C'est uniquement votre budget Google. Notre service est offert la 1ʳᵉ semaine.",
      body: <Choices opts={AD_BUDGETS} value={a.ad_budget_range} onPick={(v) => set("ad_budget_range", v)} />,
      can: () => !!a.ad_budget_range,
    },
    {
      q: "Quel est votre objectif de croissance ?",
      sub: "On dimensionne la campagne en conséquence.",
      body: <Choices opts={GOALS} value={a.goal_range} onPick={(v) => set("goal_range", v)} />,
      can: () => !!a.goal_range,
    },
    {
      q: "Dernière étape, vos coordonnées.",
      sub: "Pour recevoir votre analyse personnalisée.",
      body: (
        <div className="space-y-3">
          <input className="input" value={a.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Prénom *" />
          <input className="input" value={a.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Nom" />
          <input className="input" type="email" value={a.email} onChange={(e) => set("email", e.target.value)} placeholder="Email *" />
          <input className="input" type="tel" value={a.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Téléphone *" />
        </div>
      ),
      can: () => a.first_name.trim().length > 0 && /\S+@\S+\.\S+/.test(a.email) && a.phone.trim().length >= 6,
    },
  ];

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="w-full max-w-md">
      <style>{`.input{width:100%;background:#15151c;border:1px solid #2a2a35;border-radius:10px;padding:14px 16px;color:#fff;font-size:16px;outline:none}.input:focus{border-color:#f97316}`}</style>

      <div className="mb-6 h-1.5 w-full rounded-full bg-[#1d1d27]">
        <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {step > 0 && (
        <button onClick={back} className="mb-4 text-sm text-slate-400 hover:text-slate-200">← Retour</button>
      )}

      <h1 className="text-xl font-bold mb-1">{cur.q}</h1>
      <p className="text-slate-400 text-sm mb-6">{cur.sub}</p>

      <div className="mb-6">{cur.body}</div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        disabled={!cur.can() || submitting}
        onClick={isLast ? submit : next}
        className="w-full rounded-xl bg-orange-500 py-3.5 font-bold text-white disabled:opacity-40 hover:bg-orange-400 transition-colors"
      >
        {submitting ? "Envoi…" : isLast ? "Recevoir mon analyse" : "Continuer"}
      </button>
    </div>
  );
}

function Choices({
  opts,
  value,
  onPick,
}: {
  opts: { value: string; label: string; hint?: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onPick(o.value)}
          className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors ${
            value === o.value ? "border-orange-500 bg-orange-500/10" : "border-[#2a2a35] bg-[#15151c] hover:border-slate-500"
          }`}
        >
          <div className="font-medium">{o.label}</div>
          {o.hint && <div className="text-xs text-slate-400">{o.hint}</div>}
        </button>
      ))}
    </div>
  );
}
