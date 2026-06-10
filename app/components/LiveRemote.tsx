"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, Radio, Sparkles } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { TEMPLATES, type TemplateKey } from "../lib/demoTemplate";
import type { RemoteCommand } from "./DemoLive";

interface Props {
  prospectId: string;
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  pro: "Pro",
  corporate: "Corporate",
  minimal: "Minimal",
  electric: "Electric",
  forest: "Forest",
  luxe: "Luxe",
  terra: "Terra",
  salon: "Salon",
};

const SECTIONS = [
  { id: "services", label: "Services" },
  { id: "apropos", label: "À propos" },
  { id: "contact", label: "Contact" },
];

function relTime(iso: string): string {
  const mn = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mn < 1) return "à l'instant";
  if (mn < 60) return `il y a ${mn} min`;
  const h = Math.round(mn / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/**
 * Télécommande de la démo live, affichée dans la CallModal.
 * Pendant l'appel, le prospect a sa démo ouverte : on change le template,
 * on scrolle vers une section ou on envoie un ✨ — sous ses yeux, en temps réel
 * (broadcast Supabase sur le channel `demo-{id}`, reçu par DemoLive).
 * La presence du même channel indique s'il est sur la démo en ce moment.
 */
export default function LiveRemote({ prospectId }: Props) {
  const [watching, setWatching] = useState(false);
  const [views, setViews] = useState<{ count: number; lastAt: string | null; ctaClicked: boolean }>({
    count: 0,
    lastAt: null,
    ctaClicked: false,
  });
  const [sentStyle, setSentStyle] = useState<TemplateKey | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !prospectId) return;

    let cancelled = false;
    const loadViews = async () => {
      const { data } = await supabase
        .from("demo_views")
        .select("event, created_at")
        .eq("prospect_id", prospectId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled || !data) return;
      const v = data.filter((r) => r.event === "view");
      setViews({
        count: v.length,
        lastAt: v[0]?.created_at ?? null,
        ctaClicked: data.some((r) => r.event === "cta_click"),
      });
    };
    loadViews();

    const channel = supabase.channel(`demo-${prospectId}`, { config: { presence: { key: "crm" } } });
    channel.on("presence", { event: "sync" }, () => {
      setWatching((channel.presenceState()["prospect"]?.length ?? 0) > 0);
    });
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "demo_views", filter: `prospect_id=eq.${prospectId}` },
      () => loadViews(),
    );
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setWatching(false);
      setSentStyle(null);
    };
  }, [prospectId]);

  const send = (cmd: RemoteCommand) => {
    channelRef.current?.send({ type: "broadcast", event: "remote", payload: cmd });
    if (cmd.action === "style") setSentStyle(cmd.value as TemplateKey);
  };

  if (!supabaseConfigured) return null;

  return (
    <details className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 group">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <Radio className={`w-4 h-4 ${watching ? "text-emerald-500" : "text-violet-600 dark:text-violet-300"}`} />
          Démo live
          {watching ? (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Il regarde !
            </span>
          ) : views.count > 0 ? (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30">
              <Eye className="w-3 h-3" />
              {views.count} vue{views.count > 1 ? "s" : ""}
            </span>
          ) : null}
          {views.ctaClicked && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
              🚀 a cliqué « Je le veux »
            </span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] group-open:rotate-180 transition" />
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {watching ? (
            <span className="text-emerald-600 dark:text-emerald-300 font-medium">
              🟢 Le prospect est sur sa démo EN CE MOMENT — tout ce que tu cliques ici change sous ses yeux.
            </span>
          ) : views.lastAt ? (
            <>Dernière visite de la démo {relTime(views.lastAt)} · {views.count} vue{views.count > 1 ? "s" : ""} au total. Les commandes prendront effet quand il l&apos;ouvrira.</>
          ) : (
            <>Démo jamais ouverte pour l&apos;instant. Envoie le lien par SMS, puis pilote-la d&apos;ici pendant l&apos;appel.</>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Changer le style en direct</div>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
              <button
                key={k}
                onClick={() => send({ action: "style", value: k })}
                className={`px-2 py-1.5 text-[11px] rounded-lg border transition ${
                  sentStyle === k
                    ? "bg-violet-600 border-violet-600 text-white"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/60 hover:text-[var(--color-text-primary)]"
                }`}
              >
                {TEMPLATE_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Montrer une section</div>
            <div className="flex gap-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => send({ action: "goto", value: s.id })}
                  className="flex-1 px-2 py-1.5 text-[11px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-violet-500/60 hover:text-[var(--color-text-primary)] transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">&nbsp;</div>
            <button
              onClick={() => send({ action: "ping" })}
              title="Fait apparaître un ✨ sur son écran"
              className="px-3 py-1.5 text-[11px] rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10 transition flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Ping
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
