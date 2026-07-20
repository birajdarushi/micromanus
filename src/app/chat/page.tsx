"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import Mascot from "@/components/Mascot";

// /chat — landing inside the app: nudges setup, or starts a fresh chat.
export default function ChatHome() {
  const router = useRouter();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [credits, setCredits] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.paywallPassed) {
          router.replace("/paywall");
          return;
        }
        setHasApiKey(!!d.hasApiKey);
        setCredits(d.credits ?? 0);
      })
      .catch(() => {});
  }, [router]);

  async function start() {
    setCreating(true);
    try {
      const res = await fetch("/api/chats", { method: "POST", body: "{}" });
      const data = await res.json();
      if (res.ok) router.push(`/chat/${data.chat.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-md flex flex-col items-center animate-in fade-in duration-300">
          <Mascot state="idle" size={96} className="mb-3" />
          <h1 className="font-heading text-2xl font-medium tracking-tight text-zinc-50">
            Deep research, on demand
          </h1>
          <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
            MicroManus searches the web, reads sources, reasons in a loop, and can
            produce PDF reports. You have{" "}
            <span className="text-amber-400 font-mono font-medium">{credits} credits</span>.
          </p>
          {hasApiKey === false ? (
            <button
              onClick={() => router.push("/settings?welcome=1")}
              data-testid="add-key-btn"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors px-6 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
            >
              <KeyRound size={16} strokeWidth={1.5} />
              Add your API key to begin
            </button>
          ) : (
            <button
              onClick={start}
              disabled={creating || hasApiKey === null}
              data-testid="start-chat-btn"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
            >
              {creating ? "Starting…" : "Start a new research chat"}
              {!creating && <ArrowRight size={16} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
