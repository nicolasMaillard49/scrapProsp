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
      <div>
        <div
          className="rounded-[16px] px-4 py-3 text-sm font-medium text-left"
          style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.30)", color: "#047857" }}
        >
          ✅ Campagne prête — dernière étape : ajouter votre carte pour l&apos;activer.
        </div>
        <a href={`/eligibilite/activation/${id}`} className="fnl-btn" style={{ marginTop: 12, textDecoration: "none" }}>
          Ajouter ma carte et activer →
        </a>
      </div>
    );
  }

  return (
    <>
      <button onClick={launch} disabled={state === "loading"} className="fnl-btn">
        {state === "loading" ? "Lancement…" : "Lancer ma campagne →"}
      </button>
      {error && <p className="mt-2 text-sm" style={{ color: "#e11d48" }}>{error}</p>}
    </>
  );
}
