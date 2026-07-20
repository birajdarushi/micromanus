"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import ChatWindow from "@/components/ChatWindow";
import Mascot from "@/components/Mascot";

// /chat — a DRAFT chat (no DB row yet). The chat is created on first send,
// so we never leave empty chats lying around. Guards paywall + API key first.
export default function ChatHome() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "no_key" | "ready">("loading");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.paywallPassed) {
          router.replace("/paywall");
          return;
        }
        setState(d.hasApiKey ? "ready" : "no_key");
      })
      .catch(() => setState("ready"));
  }, [router]);

  if (state === "loading") {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center">
          <Mascot state="thinking" size={64} />
        </div>
      </AppShell>
    );
  }

  if (state === "no_key") {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center px-6">
          <div className="text-center max-w-md flex flex-col items-center">
            <Mascot state="lock" size={88} className="mb-3" />
            <h1 className="font-heading text-2xl font-medium tracking-tight text-zinc-50">
              Add your API key to begin
            </h1>
            <p className="text-zinc-400 text-sm mt-2">
              MicroManus runs on your own OpenAI-compatible key. Add it once and start researching.
            </p>
            <button
              onClick={() => router.push("/settings?welcome=1")}
              data-testid="add-key-btn"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-600 text-white hover:bg-accent-500 transition-colors px-6 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
            >
              <KeyRound size={16} strokeWidth={1.5} />
              Add API key
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ChatWindow />
    </AppShell>
  );
}
