"use client";

import { useState } from "react";

interface Props {
  token: string;
  name: string;
  phone: string;
  commune: string | null;
  service: string | null;
  message: string;
  status: string;
  amountCents: number | null;
  receivedAt: string;
}

/**
 * Deux boutons et un champ. Rien d'autre.
 *
 * L'écran s'ouvre depuis un SMS, sur un chantier, avec une main libre : chaque
 * champ supplémentaire est une réponse qu'on n'obtiendra pas. Le montant est en
 * euros entiers — personne ne saisit des centimes debout sur un échafaudage.
 */
export default function QualifyForm(p: Props) {
  const dejaQualifie = p.status !== "nouveau";
  const [montant, setMontant] = useState(
    p.amountCents ? String(Math.round(p.amountCents / 100)) : "",
  );
  const [etat, setEtat] = useState<"idle" | "envoi" | "ok" | "erreur">(
    dejaQualifie ? "ok" : "idle",
  );
  const [message, setMessage] = useState("");
  const [dernier, setDernier] = useState(p.status);

  async function envoyer(status: "signe" | "perdu") {
    setEtat("envoi");
    setMessage("");
    try {
      const res = await fetch("/api/leads/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: p.token, status, amount: Number(montant) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setDernier(status);
      setEtat("ok");
    } catch (e) {
      setEtat("erreur");
      setMessage(e instanceof Error ? e.message : "Envoi impossible");
    }
  }

  const date = new Date(p.receivedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="w-full max-w-md rounded-xl p-6 flex flex-col gap-5"
      style={{
        background: "var(--color-surface-solid)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
      }}
    >
      <header className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          Demande du {date}
        </span>
        <h1 className="text-xl font-semibold">{p.name}</h1>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          <a href={`tel:${p.phone}`} className="underline">
            {p.phone}
          </a>
          {p.commune ? ` · ${p.commune}` : ""}
          {p.service ? ` · ${p.service}` : ""}
        </p>
      </header>

      <p
        className="text-sm rounded-lg p-3 whitespace-pre-wrap"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}
      >
        {p.message}
      </p>

      {etat === "ok" ? (
        <div className="flex flex-col gap-3">
          <p
            className="text-sm font-medium"
            style={{
              color:
                dernier === "signe" ? "var(--color-state-success)" : "var(--color-text-muted)",
            }}
          >
            {dernier === "signe"
              ? `Devis signé, ${Number(montant || 0).toLocaleString("fr-FR")} € — c'est enregistré. Merci.`
              : "Devis perdu — c'est enregistré. Merci."}
          </p>
          <button
            type="button"
            onClick={() => setEtat("idle")}
            className="text-xs underline self-start"
            style={{ color: "var(--color-text-muted)" }}
          >
            Me suis trompé, corriger
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Montant du chantier</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="4200"
                className="flex-1 rounded-lg px-3 py-3 text-lg"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-text-primary)",
                }}
              />
              <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>
                €
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={etat === "envoi" || !Number(montant)}
              onClick={() => envoyer("signe")}
              className="rounded-lg py-3 font-medium disabled:opacity-40"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {etat === "envoi" ? "Envoi…" : "Ce devis a signé"}
            </button>
            <button
              type="button"
              disabled={etat === "envoi"}
              onClick={() => envoyer("perdu")}
              className="rounded-lg py-2 text-sm disabled:opacity-40"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              Pas signé
            </button>
          </div>
        </>
      )}

      {etat === "erreur" && (
        <p className="text-sm" style={{ color: "var(--color-state-danger)" }}>
          {message} — réessaie, ou préviens Nicolas.
        </p>
      )}
    </div>
  );
}
