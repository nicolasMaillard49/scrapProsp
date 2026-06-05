import { NextResponse } from "next/server";
import { twilioClient, twilioConfigured } from "@/app/lib/twilio";

/** Solde du compte Twilio (pour l'aperçu coût/solde dans /sms). */
export async function GET() {
  if (!twilioConfigured) return NextResponse.json({ error: "Twilio non configuré" }, { status: 503 });
  try {
    const bal = await twilioClient().balance.fetch();
    return NextResponse.json({ balance: parseFloat(bal.balance), currency: bal.currency });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
