"use client";

import { useState } from "react";

export default function LaunchButton({ id, alreadyLaunched }: { id: string; alreadyLaunched: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(alreadyLaunched ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/eligibilite/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-green-300 text-sm">
        ✅ Campagne lancée — un email d'activation vient de partir.
      </div>
    );
  }

  return (
    <>
      <button
        onClick={launch}
        disabled={state === "loading"}
        className="w-full rounded-xl bg-orange-500 py-3.5 font-bold text-white disabled:opacity-50 hover:bg-orange-400 transition-colors"
      >
        {state === "loading" ? "Lancement…" : "Lancer ma campagne →"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </>
  );
}
