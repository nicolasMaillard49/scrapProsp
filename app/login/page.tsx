import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") || "");
  const expected = process.env.AUTH_PASSWORD || "0902";
  if (password === expected) {
    const c = await cookies();
    c.set("prospects-auth", "ok", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 jours
    });
    redirect("/");
  }
  redirect("/login?error=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const sp = await searchParams;
  const hasError = sp.error === "1";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        action={login}
        className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <g fill="#7B4FE0" stroke="#7B4FE0" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="30" cy="36" rx="9" ry="6" />
                <circle cx="20" cy="36" r="4" />
                <path d="M17 31 Q9 24 5 30 Q4 34 9 35 L13 33 Z" strokeWidth="1.5" />
                <path d="M17 41 Q9 48 5 42 Q4 38 9 37 L13 39 Z" strokeWidth="1.5" />
                <line x1="25" y1="42" x2="22" y2="50" strokeWidth="2.5" />
                <line x1="29" y1="43" x2="28" y2="52" strokeWidth="2.5" />
                <line x1="33" y1="43" x2="34" y2="52" strokeWidth="2.5" />
                <line x1="37" y1="42" x2="39" y2="50" strokeWidth="2.5" />
                <line x1="25" y1="30" x2="22" y2="22" strokeWidth="2.5" />
                <line x1="29" y1="29" x2="28" y2="20" strokeWidth="2.5" />
                <line x1="33" y1="29" x2="34" y2="20" strokeWidth="2.5" />
                <line x1="37" y1="30" x2="39" y2="22" strokeWidth="2.5" />
                <path d="M39 36 Q50 36 53 28 Q55 18 47 16 L45 11" fill="none" strokeWidth="3.5" />
                <circle cx="45" cy="9" r="2.5" />
              </g>
            </svg>
          </div>
        </div>

        <h1 className="font-display text-3xl text-center text-[var(--color-text-primary)] mb-1 leading-none">
          Prospects <span className="text-violet-300">Tracker</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] text-center mb-6 font-mono-num">Saisis le code pour entrer</p>

        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Code d'accès</label>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          required
          className={`w-full px-4 py-3 text-lg rounded-lg bg-[var(--color-background)] border outline-none transition ${
            hasError
              ? "border-rose-500/60 focus:border-rose-500"
              : "border-[var(--color-border)] focus:border-violet-500/60"
          }`}
        />
        {hasError && (
          <p className="mt-2 text-xs text-rose-400">Code incorrect, réessaie.</p>
        )}

        <button
          type="submit"
          className="mt-5 w-full px-4 py-3 rounded-lg bg-[var(--color-accent)] hover:brightness-110 text-white font-medium transition shadow-lg shadow-violet-900/30"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
