import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/app/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/prospects/add
 * Insère un prospect issu de l'ajout manuel (déjà enrichi par /api/prospects/find).
 * Dédup par maps_url (409 si déjà présent). source="manuel".
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  let b: {
    name?: string;
    metier?: string;
    phone?: string;
    ville?: string;
    rating?: number | null;
    reviews?: number | null;
    website?: string | null;
    address?: string | null;
    maps_url?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const name = (b.name || "").trim();
  const maps_url = (b.maps_url || "").trim();
  if (!name || !maps_url) {
    return NextResponse.json(
      { error: "name et maps_url sont requis" },
      { status: 400 },
    );
  }

  // Dédup
  const { data: existing } = await supabase
    .from("prospects")
    .select("id")
    .eq("maps_url", maps_url)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Ce prospect existe déjà dans votre liste", existing: true },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("prospects")
    .insert({
      name,
      metier: (b.metier || "").trim(),
      phone: (b.phone || "").trim(),
      ville: (b.ville || "").trim(),
      departement: "",
      region: "",
      region_label: null,
      rating: b.rating != null ? Number(b.rating) : null,
      reviews: b.reviews != null ? Number(b.reviews) : null,
      address: b.address || null,
      website: b.website || null,
      maps_url,
      source: "manuel",
      status: "todo",
      notes: "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prospect: data });
}
