"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase, supabaseConfigured } from "../../lib/supabase";

const MapRadius = dynamic(() => import("./MapRadius"), {
  ssr: false,
  loading: () => (
    <div className="fnl-map">
      <div className="fnl-map-loading">···</div>
    </div>
  ),
});

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

  // Miroir temps réel (suivi admin) : on diffuse l'état au fil de la saisie.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    const ch = supabase.channel(`elig-live:${token}`, { config: { broadcast: { self: false } } });
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [token]);
  useEffect(() => {
    channelRef.current?.send({ type: "broadcast", event: "state", payload: { step, a } });
  }, [step, a]);

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

  const rangePct = (a.radius_km / 50) * 100;

  const STEPS = [
    {
      q: "Quel est votre métier ?",
      sub: "On adapte toute la campagne à votre activité.",
      body: <input className="fnl-input" value={a.metier} onChange={(e) => set("metier", e.target.value)} placeholder="Ex : Paysagiste" autoFocus />,
      can: () => a.metier.trim().length > 1,
    },
    {
      q: "Dans quelle ville exercez-vous ?",
      sub: "On garantit l'exclusivité sur votre zone géographique.",
      body: <input className="fnl-input" value={a.ville} onChange={(e) => set("ville", e.target.value)} placeholder="Ex : Niort" autoFocus />,
      can: () => a.ville.trim().length > 1,
    },
    {
      q: `Quel rayon autour de ${a.ville || "votre ville"} ?`,
      sub: "On cible les internautes qui cherchent depuis cette zone.",
      body: (
        <div>
          <MapRadius ville={a.ville} radiusKm={a.radius_km} />
          <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--ink)" }}>
            <PinIcon /> {a.ville || "Votre ville"}
          </div>
          <div className="mt-1.5">
            <span className="text-[44px] font-bold leading-none" style={{ color: "var(--ink)" }}>{a.radius_km}</span>
            <span className="text-[22px] font-bold" style={{ color: "var(--muted)" }}> km</span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>Rayon autour du centre-ville.</p>
          <input
            type="range"
            min={0}
            max={50}
            value={a.radius_km}
            onChange={(e) => set("radius_km", Number(e.target.value))}
            className="fnl-range mt-4"
            style={{ background: `linear-gradient(90deg, var(--accent) ${rangePct}%, var(--border) ${rangePct}%)` }}
          />
          <div className="flex justify-between text-xs mt-2 font-medium" style={{ color: "var(--muted)" }}>
            <span>0 km</span><span>25 km</span><span>50 km</span>
          </div>
        </div>
      ),
      can: () => true,
    },
    {
      q: "Quelle est l'adresse de votre site web ?",
      sub: "On l'analyse pour repérer votre service le plus rentable.",
      body: <input className="fnl-input" value={a.site_url} onChange={(e) => set("site_url", e.target.value)} placeholder="exemple-paysagiste.fr" autoFocus />,
      can: () => true,
    },
    {
      q: "Combien êtes-vous dans l'équipe ?",
      sub: "On calibre le volume de leads à votre capacité de réponse.",
      body: <Choices opts={EMPLOYEES} value={a.employees_range} onPick={(v) => set("employees_range", v)} />,
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
        <div className="space-y-2.5">
          <input className="fnl-input" value={a.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Prénom *" />
          <input className="fnl-input" value={a.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Nom" />
          <input className="fnl-input" type="email" value={a.email} onChange={(e) => set("email", e.target.value)} placeholder="Email *" />
          <input className="fnl-input" type="tel" value={a.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Téléphone *" />
        </div>
      ),
      can: () => a.first_name.trim().length > 0 && /\S+@\S+\.\S+/.test(a.email) && a.phone.trim().length >= 6,
    },
  ];

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="w-full max-w-md min-h-screen flex flex-col px-1">
      {/* En-tête marque + progression */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[18px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            NMF<span style={{ color: "var(--accent)" }}>.</span>
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Étape {step + 1} / {STEPS.length}</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 flex flex-col justify-center py-8">
        {step > 0 && (
          <button onClick={back} className="mb-5 inline-flex items-center gap-1 self-start text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "var(--ink-soft)" }}>
            ← Retour
          </button>
        )}
        <h1 className="text-[28px] font-bold leading-[1.1]" style={{ color: "var(--ink)", textWrap: "balance" }}>{cur.q}</h1>
        <p className="mt-2.5 text-[15px] leading-relaxed mb-7" style={{ color: "var(--ink-soft)" }}>{cur.sub}</p>
        <div>{cur.body}</div>
        {error && <p className="mt-3 text-sm" style={{ color: "#e11d48" }}>{error}</p>}
      </div>

      {/* CTA sticky bas */}
      <div className="fnl-sticky">
        <button disabled={!cur.can() || submitting} onClick={isLast ? submit : next} className="fnl-btn">
          {submitting ? "Envoi…" : isLast ? "Recevoir mon analyse" : "Continuer →"}
        </button>
        <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
          🔒 Confidentiel · 1ʳᵉ semaine offerte
        </p>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
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
      {opts.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onPick(o.value)} data-active={active} className="fnl-choice">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold" style={{ color: "var(--ink)" }}>{o.label}</div>
                {o.hint && <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{o.hint}</div>}
              </div>
              <span
                className="shrink-0 grid place-items-center rounded-full transition-all"
                style={{
                  width: 22, height: 22,
                  border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent)" : "transparent",
                }}
              >
                {active && <span style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} />}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
