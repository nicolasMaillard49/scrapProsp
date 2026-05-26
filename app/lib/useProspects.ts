"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import type { Call, Prospect, Status } from "./types";

export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const prospectsRef = useRef<Prospect[]>(prospects);
  prospectsRef.current = prospects;

  // ── Initial fetch ───────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured) {
      console.warn("Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env");
      setLoaded(true);
      return;
    }
    async function load() {
      const { data, error } = await supabase
        .from("prospects")
        .select("*, calls(*)")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load prospects:", error);
      }

      setProspects(data ?? []);
      setLoaded(true);
    }
    load();
  }, []);

  // ── Realtime subscriptions ──────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured) return;
    const channel = supabase
      .channel("prospects-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "prospects" },
        (payload) => {
          const newProspect = { ...(payload.new as Prospect), calls: [] };
          setProspects((prev) => {
            if (prev.some((p) => p.id === newProspect.id)) return prev;
            return [...prev, newProspect];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prospects" },
        (payload) => {
          setProspects((prev) =>
            prev.map((p) =>
              p.id === payload.new.id
                ? { ...p, ...(payload.new as Partial<Prospect>), calls: p.calls }
                : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "prospects" },
        (payload) => {
          setProspects((prev) =>
            prev.filter((p) => p.id !== payload.old.id),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        (payload) => {
          const newCall = payload.new as Call;
          setProspects((prev) =>
            prev.map((p) =>
              p.id === newCall.prospect_id
                ? { ...p, calls: [...(p.calls ?? []), newCall] }
                : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const updated = payload.new as Call;
          setProspects((prev) =>
            prev.map((p) =>
              p.id === updated.prospect_id
                ? { ...p, calls: (p.calls ?? []).map((c) => c.id === updated.id ? updated : c) }
                : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "calls" },
        (payload) => {
          const deleted = payload.old as Call;
          setProspects((prev) =>
            prev.map((p) =>
              p.id === deleted.prospect_id
                ? { ...p, calls: (p.calls ?? []).filter((c) => c.id !== deleted.id) }
                : p,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Mutations ───────────────────────────────────────────────────────

  const updateStatus = useCallback(
    async (prospectId: string, status: Status, duration?: number) => {
      // Optimistic: update prospect status
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, status } : p)),
      );

      // DB: update prospect status
      const { error } = await supabase
        .from("prospects")
        .update({ status })
        .eq("id", prospectId);

      if (error) console.error("updateStatus prospect error:", error);

      // If not "todo", also insert a call record
      if (status !== "todo") {
        const callRow = {
          prospect_id: prospectId,
          called_at: new Date().toISOString(),
          status,
          duration: duration ?? null,
        };

        const { data: newCall, error: callError } = await supabase
          .from("calls")
          .insert(callRow)
          .select()
          .single();

        if (callError) {
          console.error("updateStatus call insert error:", callError);
        }

        // Optimistic: append the new call
        if (newCall) {
          setProspects((prev) =>
            prev.map((p) =>
              p.id === prospectId
                ? { ...p, calls: [...(p.calls ?? []), newCall as Call] }
                : p,
            ),
          );
        }
      }
    },
    [],
  );

  const updateNotes = useCallback(
    async (prospectId: string, notes: string) => {
      // Optimistic
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, notes } : p)),
      );

      const { error } = await supabase
        .from("prospects")
        .update({ notes })
        .eq("id", prospectId);

      if (error) console.error("updateNotes error:", error);
    },
    [],
  );

  const setLocalNotes = useCallback(
    (prospectId: string, notes: string) => {
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, notes } : p)),
      );
    },
    [],
  );

  const resetProspect = useCallback(async (prospectId: string) => {
    // Optimistic
    setProspects((prev) =>
      prev.map((p) =>
        p.id === prospectId ? { ...p, status: "todo" as Status, notes: "" } : p,
      ),
    );

    const { error } = await supabase
      .from("prospects")
      .update({ status: "todo", notes: "" })
      .eq("id", prospectId);

    if (error) console.error("resetProspect error:", error);
  }, []);

  const importProspects = useCallback(
    async (rows: Array<Record<string, string>>) => {
      const filtered = rows.filter((r) => r.name && r.phone);

      const dbRows = filtered.map((r) => ({
        name: r.name,
        metier: r.metier ?? "",
        phone: r.phone,
        ville: r.ville ?? "",
        departement: r.departement ?? "",
        region: r.region ?? "",
        region_label: r.region_label || null,
        rating: r.rating
          ? parseFloat(r.rating.replace(",", "."))
          : null,
        reviews: r.reviews ? parseInt(r.reviews, 10) : null,
        hours_status: r.hours_status || null,
        address: r.address || null,
        maps_url: r.maps_url ?? "",
        siret: r.siret || null,
        company_created_at: r.company_created_at || null,
        age_years: r.age_years ? parseFloat(r.age_years) : null,
        legal_status: r.legal_status || null,
        naf_code: r.naf_code || null,
      }));

      const { data, error } = await supabase
        .from("prospects")
        .upsert(dbRows, { onConflict: "maps_url", ignoreDuplicates: false })
        .select("*, calls(*)");

      if (error) {
        console.error("importProspects error:", error);
        return 0;
      }

      if (data) {
        setProspects((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          for (const row of data as Prospect[]) {
            map.set(row.id, row);
          }
          return Array.from(map.values());
        });
      }

      return data?.length ?? 0;
    },
    [],
  );

  // ── Derived data ────────────────────────────────────────────────────
  const regions = Array.from(
    new Map(
      prospects.map((p) => [
        p.region,
        { key: p.region, label: p.region_label ?? p.region },
      ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));

  return {
    prospects,
    regions,
    loaded,
    updateStatus,
    updateNotes,
    setLocalNotes,
    resetProspect,
    importProspects,
  };
}
