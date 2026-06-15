"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Radio, Circle } from "lucide-react";
import { supabase, supabaseConfigured } from "../../../../lib/supabase";

/* Libellés lisibles pour les choix (miroir des constantes du QuizForm). */
const LABELS: Record<string, Record<string, string>> = {
  employees_range: { solo: "Travaille seul", "2_5": "2 à 5", "6_15": "6 à 15", gt_15: "Plus de 15" },
  ca_range: { lt_5k: "< 5 000 €/mois", "5k_15k": "5–15 k€/mois", "15k_50k": "15–50 k€/mois", gt_50k: "> 50 k€/mois" },
  ad_budget_range: { lt_500: "< 500 €/mois", "500_1000": "500–1 000 €/mois", "1000_3000": "1–3 k€/mois", gt_3000: "> 3 000 €/mois" },
  goal_range: { plus_30: "+30 % de CA", plus_50: "+50 % de CA", plus_100: "Doubler le CA", double: "Changer de dimension" },
};

/* Ordre des étapes = ordre du wizard client. */
const FIELDS: { key: string; label: string; step: number }[] = [
  { key: "metier", label: "Métier", step: 0 },
  { key: "ville", label: "Ville", step: 1 },
  { key: "radius_km", label: "Rayon", step: 2 },
  { key: "site_url", label: "Site web", step: 3 },
  { key: "employees_range", label: "Équipe", step: 4 },
  { key: "ca_range", label: "CA mensuel", step: 5 },
  { key: "ad_budget_range", label: "Budget pub", step: 6 },
  { key: "goal_range", label: "Objectif", step: 7 },
  { key: "first_name", label: "Prénom", step: 8 },
  { key: "last_name", label: "Nom", step: 8 },
  { key: "email", label: "Email", step: 8 },
  { key: "phone", label: "Téléphone", step: 8 },
];

const TOTAL_STEPS = 9;

type State = { step: number; a: Record<string, unknown> };

function display(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "radius_km") return `${value} km`;
  const map = LABELS[key];
  if (map && typeof value === "string") return map[value] ?? String(value);
  return String(value);
}

export default function LiveMirrorPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<State | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastTs, setLastTs] = useState<number | null>(null);
  const tick = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured || !token) return;
    const ch = supabase.channel(`elig-live:${token}`, { config: { broadcast: { self: true } } });
    ch.on("broadcast", { event: "state" }, (msg) => {
      setState(msg.payload as State);
      setLastTs(Date.now());
    });
    ch.subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, [token]);

  // Rafraîchit l'âge du dernier message (« il y a Xs »).
  useEffect(() => {
    const id = setInterval(() => {
      tick.current += 1;
      force((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const ageS = lastTs ? Math.round((Date.now() - lastTs) / 1000) : null;
  const curStep = state?.step ?? -1;
  const a = state?.a ?? {};
  const filled = FIELDS.filter((f) => {
    const v = a[f.key];
    return v !== null && v !== undefined && v !== "";
  }).length;

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href="/admin/funnel" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Console funnel
        </Link>

        <div className="flex items-center justify-between gap-3 mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Radio className={`w-5 h-5 ${connected ? "text-emerald-400" : "text-slate-600"}`} />
            Miroir live
          </h1>
          <span className={`text-xs px-2 py-1 rounded-full border ${connected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-600 text-slate-500"}`}>
            {connected ? "connecté" : "connexion…"}
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-5 font-mono">
          token {token} ·{" "}
          {state ? (ageS === 0 ? "à l'instant" : `il y a ${ageS}s`) : "en attente de saisie…"}
        </p>

        {/* Progression */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Étape {curStep >= 0 ? curStep + 1 : 0} / {TOTAL_STEPS}</span>
            <span>{filled} champ{filled > 1 ? "s" : ""} rempli{filled > 1 ? "s" : ""}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#1d1d27]">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${curStep >= 0 ? ((curStep + 1) / TOTAL_STEPS) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Champs reflétés */}
        <div className="space-y-2">
          {FIELDS.map((f) => {
            const isCurrent = f.step === curStep;
            const v = a[f.key];
            const hasVal = v !== null && v !== undefined && v !== "";
            return (
              <div
                key={f.key}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isCurrent
                    ? "border-orange-500/60 bg-orange-500/10"
                    : hasVal
                      ? "border-[#2a2a35] bg-[#13131a]"
                      : "border-[#1d1d27] bg-[#0e0e14]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCurrent && <Circle className="w-2 h-2 fill-orange-500 text-orange-500 shrink-0 animate-pulse" />}
                  <span className="text-sm text-slate-400">{f.label}</span>
                </div>
                <span className={`text-sm font-medium truncate ${hasVal ? "text-slate-100" : "text-slate-600"}`}>
                  {display(f.key, v)}
                </span>
              </div>
            );
          })}
        </div>

        {!supabaseConfigured && (
          <p className="mt-6 text-sm text-rose-400">Supabase non configuré : le live ne peut pas fonctionner.</p>
        )}
      </div>
    </main>
  );
}
