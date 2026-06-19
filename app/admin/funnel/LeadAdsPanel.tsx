"use client";

import { useMemo, useState } from "react";

/** Forme allégée du plan (CampaignPlan côté serveur) utile à l'affichage admin. */
export interface PlanLike {
  params: {
    accountName: string;
    campaignName: string;
    dailyBudgetMicros: number;
    finalUrl: string;
    callPhoneE164: string;
    geo: { kind: "proximity"; radiusKm: number } | { kind: "city"; ville: string };
  };
  keywords: { text: string; match: string }[];
  negatives: string[];
  ad: { headlines: string[]; descriptions: string[] };
  warnings?: string[];
}

interface Props {
  leadId: string;
  leadLabel: string;
  plan: PlanLike | null;
  existing: { status: string; customer_id: string | null; campaign_id: string | null } | null;
}

function planToText(p: PlanLike): string {
  const budget = Math.round(p.params.dailyBudgetMicros / 1_000_000);
  const zone = p.params.geo.kind === "proximity" ? `proximité ${p.params.geo.radiusKm} km` : `ville : ${p.params.geo.ville}`;
  return [
    `Compte        : ${p.params.accountName}`,
    `Campagne      : ${p.params.campaignName}`,
    `Budget        : ${budget} €/j (test 7 j)`,
    `Zone          : ${zone}`,
    `Final URL     : ${p.params.finalUrl || "— (manquant)"}`,
    `Tél (call)    : ${p.params.callPhoneE164 || "—"}`,
    ``,
    `Mots-clés (${p.keywords.length}) :`,
    ...p.keywords.map((k) => `  - ${k.text} [${k.match}]`),
    ``,
    `Titres RSA (${p.ad.headlines.length}) :`,
    ...p.ad.headlines.map((h) => `  - ${h}`),
    ``,
    `Descriptions RSA (${p.ad.descriptions.length}) :`,
    ...p.ad.descriptions.map((d) => `  - ${d}`),
    ``,
    `Négatifs (${p.negatives.length}) : ${p.negatives.join(", ")}`,
  ].join("\n");
}

export default function LeadAdsPanel({ leadId, leadLabel, plan, existing }: Props) {
  const planText = useMemo(() => (plan ? planToText(plan) : ""), [plan]);
  const [copied, setCopied] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    existing?.status === "paused" ? "done" : "idle",
  );
  const [result, setResult] = useState<{ campaignId: string | null; error: string | null } | null>(
    existing?.status === "paused" || existing?.status === "active"
      ? { campaignId: existing.campaign_id, error: null }
      : null,
  );
  const [actState, setActState] = useState<"idle" | "loading" | "done" | "error">(
    existing?.status === "active" ? "done" : "idle",
  );
  const [actResult, setActResult] = useState<{ endDate: string | null; error: string | null } | null>(null);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [refreshResult, setRefreshResult] = useState<{
    removed: number;
    added: number;
    keywords: { text: string; match: string }[];
    source: string;
    error: string | null;
  } | null>(null);

  const digits = customerId.replace(/\D/g, "");
  const idValid = digits.length === 10;
  const campaignId = result?.campaignId ?? existing?.campaign_id ?? null;
  const custForActivate = digits.length === 10 ? digits : existing?.customer_id ?? null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(planText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indispo */
    }
  }

  async function activate() {
    setActState("loading");
    try {
      const res = await fetch("/api/eligibilite/activate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, customerId: custForActivate, campaignId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setActResult({ endDate: null, error: json.error || `Erreur ${res.status}` });
        setActState("error");
        return;
      }
      setActResult({ endDate: json.endDate, error: null });
      setActState("done");
    } catch (e) {
      setActResult({ endDate: null, error: e instanceof Error ? e.message : String(e) });
      setActState("error");
    }
  }

  async function refreshKeywords() {
    setRefreshState("loading");
    try {
      const res = await fetch("/api/eligibilite/refresh-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, customerId: custForActivate, campaignId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setRefreshResult({ removed: 0, added: 0, keywords: [], source: "", error: json.error || `Erreur ${res.status}` });
        setRefreshState("error");
        return;
      }
      setRefreshResult({ removed: json.removed, added: json.added, keywords: json.keywords || [], source: json.keywordSource, error: null });
      setRefreshState("done");
    } catch (e) {
      setRefreshResult({ removed: 0, added: 0, keywords: [], source: "", error: e instanceof Error ? e.message : String(e) });
      setRefreshState("error");
    }
  }

  async function createCampaign() {
    setState("loading");
    try {
      const res = await fetch("/api/eligibilite/create-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, customerId: digits }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({ campaignId: null, error: json.error || `Erreur ${res.status}` });
        setState("error");
        return;
      }
      setResult({ campaignId: json.campaignId, error: null });
      setState("done");
    } catch (e) {
      setResult({ campaignId: null, error: e instanceof Error ? e.message : String(e) });
      setState("error");
    }
  }

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#13131a] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-medium text-slate-200 truncate">{leadLabel}</span>
        {existing?.customer_id ? (
          <span className="shrink-0 text-xs text-slate-500">compte {existing.customer_id}</span>
        ) : null}
      </div>

      {plan ? (
        <>
          <div className="relative">
            <pre className="max-h-56 overflow-auto rounded-lg bg-[#0b0b0f] border border-[#23232c] p-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
              {planText}
            </pre>
            <button
              onClick={copy}
              className="absolute top-2 right-2 rounded-md bg-slate-700/70 hover:bg-slate-600 px-2 py-1 text-[11px] text-slate-200 transition"
            >
              {copied ? "Copié ✓" : "Copier"}
            </button>
          </div>
          {plan.warnings && plan.warnings.length > 0 ? (
            <p className="mt-2 text-[11px] text-amber-400">⚠️ {plan.warnings.join(" · ")}</p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500">Pas de plan généré (lead pas encore « lancé »).</p>
      )}

      {state === "done" ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300">
            ✅ Campagne PAUSED créée{result?.campaignId ? ` · ID ${result.campaignId}` : ""}.
          </div>
          {actState === "done" ? (
            <div className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-3 py-2 text-sm text-sky-300">
              🚀 Campagne ACTIVÉE{actResult?.endDate ? ` · fin le ${actResult.endDate}` : ""} — 7 j de diffusion à partir d&apos;aujourd&apos;hui.
            </div>
          ) : (
            <>
              <button
                onClick={activate}
                disabled={!campaignId || actState === "loading"}
                className="w-full rounded-lg bg-sky-500/20 border border-sky-500/40 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actState === "loading" ? "Activation…" : "Activer (lance + fin J+7 du go-live)"}
              </button>
              <p className="text-[11px] text-slate-500">
                À cliquer quand le compte + les annonces sont validés par Google. Pose la fin à 7 jours de diffusion réelle.
              </p>
              {actState === "error" && actResult?.error ? (
                <p className="text-[11px] text-rose-400 break-words">{actResult.error}</p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <label className="block text-[11px] text-slate-500 mb-1">
            Customer ID du compte créé + lié au MCC 671 (10 chiffres)
          </label>
          <div className="flex gap-2">
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="123-456-7890"
              className="flex-1 rounded-lg bg-[#0b0b0f] border border-[#2a2a35] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60"
            />
            <button
              onClick={createCampaign}
              disabled={!plan || !idValid || state === "loading"}
              className="shrink-0 rounded-lg bg-orange-500/20 border border-orange-500/40 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state === "loading" ? "Création…" : "Créer la campagne"}
            </button>
          </div>
          {customerId && !idValid ? (
            <p className="mt-1 text-[11px] text-slate-500">{digits.length}/10 chiffres</p>
          ) : null}
          {state === "error" && result?.error ? (
            <p className="mt-2 text-[11px] text-rose-400 break-words">{result.error}</p>
          ) : null}
        </div>
      )}

      {campaignId ? (
        <div className="mt-3 border-t border-[#23232c] pt-3">
          <button
            onClick={refreshKeywords}
            disabled={refreshState === "loading"}
            className="w-full rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {refreshState === "loading" ? "Rafraîchissement…" : "🔑 Rafraîchir les mots-clés (sans ville, via API)"}
          </button>
          <p className="mt-1 text-[11px] text-slate-500">
            Remplace les mots-clés actuels par des mots-clés <strong>sans ville</strong> (corrige « Volume de recherche faible »). Ne touche ni au budget ni aux enchères.
          </p>
          {refreshState === "done" && refreshResult ? (
            <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[12px] text-emerald-300">
              ✅ {refreshResult.removed} supprimé(s) · {refreshResult.added} ajouté(s)
              <span className="text-emerald-200/70"> (source : {refreshResult.source})</span>
              {refreshResult.keywords.length ? (
                <div className="mt-1 text-emerald-200/80 break-words">
                  {[...new Set(refreshResult.keywords.map((k) => k.text))].join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}
          {refreshState === "error" && refreshResult?.error ? (
            <p className="mt-2 text-[11px] text-rose-400 break-words">{refreshResult.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
