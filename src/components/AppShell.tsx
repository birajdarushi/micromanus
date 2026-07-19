"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface ChatListItem {
  id: string;
  title: string;
  model: string;
  updated_at: string;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(() => {
    fetch("/api/chats")
      .then((r) => r.json())
      .then((d) => setChats(d.chats ?? []))
      .catch(() => {});
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
        setEmail(d.user?.email ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("mm:refresh", onRefresh);
    return () => window.removeEventListener("mm:refresh", onRefresh);
  }, [refresh]);

  async function newChat() {
    setCreatingChat(true);
    try {
      const res = await fetch("/api/chats", { method: "POST", body: "{}" });
      const data = await res.json();
      if (res.ok) {
        refresh();
        router.push(`/chat/${data.chat.id}`);
        setSidebarOpen(false);
      }
    } finally {
      setCreatingChat(false);
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const nav = [
    { href: "/usage", label: "📊 Cost & stats" },
    { href: "/settings", label: "⚙️ Settings" },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      {/* mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-30 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm"
      >
        ☰
      </button>

      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform fixed md:static z-20 w-64 h-full flex flex-col bg-zinc-925 bg-zinc-900 border-r border-zinc-800`}
      >
        <div className="p-4 border-b border-zinc-800">
          <Link href="/chat" className="font-semibold tracking-tight text-lg">
            🔬 MicroManus
          </Link>
          <div className="mt-2 text-xs text-zinc-500 truncate">{email}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 px-2.5 py-0.5 text-xs">
            ⚡ {credits ?? "…"} credits
          </div>
        </div>

        <div className="p-3">
          <button
            onClick={newChat}
            disabled={creatingChat}
            className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 transition py-2 text-sm font-medium disabled:opacity-60"
          >
            {creatingChat ? "Creating…" : "+ New chat"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {chats.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              onClick={() => setSidebarOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm truncate transition ${
                pathname === `/chat/${c.id}`
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              {c.title || "New chat"}
            </Link>
          ))}
          {chats.length === 0 && (
            <p className="text-xs text-zinc-600 px-3 py-2">No chats yet.</p>
          )}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-0.5">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setSidebarOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                pathname === n.href
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <button
            onClick={signOut}
            className="w-full text-left rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition"
          >
            ← Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-hidden">{children}</main>
    </div>
  );
}
