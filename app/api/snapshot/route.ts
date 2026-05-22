import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

const SEED_PATH = resolve(process.cwd(), "public", "state-seed.json");

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { ok: false, error: "Endpoint désactivé en production (filesystem read-only sur Vercel)" },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON body invalide" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "État vide" }, { status: 400 });
  }
  const payload = JSON.stringify(body, null, 2);
  await writeFile(SEED_PATH, payload + "\n", "utf8");
  return Response.json({
    ok: true,
    bytes: payload.length,
    keys: Object.keys(body as Record<string, unknown>).length,
    path: "public/state-seed.json",
  });
}

export async function GET() {
  return Response.json({
    enabled: process.env.NODE_ENV !== "production",
    path: "public/state-seed.json",
  });
}
