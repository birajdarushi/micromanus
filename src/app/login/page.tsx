"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import Mascot from "@/components/Mascot";

const BG =
  "https://images.unsplash.com/photo-1622737133809-d95047b9e673?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZ2VvbWV0cmljJTIwM2QlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQ0ODUyMDV8MA&ixlib=rb-4.1.0&q=85";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function signIn(provider: "google" | "github") {
    setLoading(provider);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div className="relative w-full max-w-sm text-center animate-in fade-in duration-300">
        <div className="mb-10 flex flex-col items-center">
          <Mascot state="idle" size={96} className="mb-2" />
          <h1 className="font-heading text-3xl font-medium tracking-tight text-zinc-50">
            MicroManus
          </h1>
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
            A deep research AI agent. Searches the web, reasons in a loop, and
            writes PDF reports — powered by your own LLM API key.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn("google")}
            disabled={!!loading}
            data-testid="login-google-btn"
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-zinc-50 text-zinc-900 py-2.5 font-medium hover:bg-white transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </button>

          <button
            onClick={() => signIn("github")}
            disabled={!!loading}
            data-testid="login-github-btn"
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-zinc-900 text-zinc-100 py-2.5 font-medium hover:bg-zinc-800 transition-colors border border-zinc-800 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
            </svg>
            {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </button>
        </div>

        <p className="mt-10 font-mono text-xs text-zinc-500">
          Sign up · unlock with a coupon or card · plug in your API key · research.
        </p>
      </div>
    </main>
  );
}
