"use client";

import { useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Cette campagne diffuse-t-elle bien ?",
  "Pourquoi si peu d'appels ?",
  "Mon budget est-il bien dépensé ?",
  "Que changer pour avoir plus de clients ?",
];

export default function CampaignChat({
  campaignRecordId,
  clientLabel,
}: {
  campaignRecordId: string;
  clientLabel: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch(`/api/funnel/campagne/${campaignRecordId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        setMessages((m) => replaceLast(m, err.error || `Erreur ${res.status}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => replaceLast(m, acc));
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch (e) {
      setMessages((m) => replaceLast(m, `⚠️ ${e instanceof Error ? e.message : String(e)}`));
    } finally {
      setBusy(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }

  return (
    <section className="rounded-xl border border-[#2a2a35] bg-[#13131a] flex flex-col h-[640px] lg:sticky lg:top-6">
      <div className="flex items-center gap-2 border-b border-[#23232c] px-4 py-3">
        <Sparkles className="w-4 h-4 text-violet-300" />
        <span className="text-sm font-semibold">Demander à Claude</span>
        <span className="ml-auto text-[11px] text-slate-600 truncate max-w-[45%]">{clientLabel}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Pose une question sur cette campagne — Claude répond à partir des données réelles (perf, statut, mots-clés).
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-[#2a2a35] bg-[#0b0b0f] px-3 py-1.5 text-[12px] text-slate-300 hover:border-violet-500/50 hover:text-violet-200 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-violet-500/20 border border-violet-500/40 text-violet-100"
                    : "bg-[#0b0b0f] border border-[#23232c] text-slate-200"
                }`}
              >
                {m.content || (busy && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[#23232c] p-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Votre question…"
          className="flex-1 resize-none rounded-lg bg-[#0b0b0f] border border-[#2a2a35] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 max-h-32"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-lg bg-violet-500/25 border border-violet-500/50 p-2 text-violet-200 hover:bg-violet-500/35 transition disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Envoyer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
}

function replaceLast(msgs: Msg[], content: string): Msg[] {
  const copy = [...msgs];
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}
