"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Settings, LogOut, Plus, Zap, Menu, X, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import Mascot from "@/components/Mascot";
import BuyCreditsButton from "@/components/BuyCreditsButton";
import ThemeToggle from "@/components/ThemeToggle";

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
  const [confirmDelete, setConfirmDelete] = useState<ChatListItem | null>(null);
  const [renaming, setRenaming] = useState<ChatListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
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

  function openDelete(chat: ChatListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(chat);
  }

  function openRename(chat: ChatListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenameValue(chat.title || "");
    setRenaming(chat);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Chat deleted");
      refresh();
      if (pathname === `/chat/${id}`) router.push("/chat");
    } else {
      toast.error("Couldn't delete the chat");
    }
  }

  async function doRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const id = renaming.id;
    const title = renameValue.trim();
    setRenaming(null);
    if (!title || title === renaming.title) return;
    const res = await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      toast.success("Chat renamed");
      refresh();
    } else {
      toast.error("Couldn't rename the chat");
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const nav = [
    { href: "/usage", label: "Cost & stats", icon: BarChart3, testid: "nav-usage" },
    { href: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-950 text-zinc-50">
      {/* mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
        data-testid="sidebar-toggle"
        className="md:hidden fixed top-3 left-3 z-40 rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-zinc-300 hover:text-zinc-50 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
      >
        {sidebarOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
      </button>

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-200 fixed md:static z-30 w-64 h-full flex flex-col justify-between bg-zinc-950 border-r border-zinc-800`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="p-4 border-b border-zinc-800">
            <Link
              href="/chat"
              className="flex items-center gap-2 font-heading font-medium tracking-tight text-lg text-zinc-50"
            >
              <Mascot state="idle" size={26} />
              MicroManus
            </Link>
            <div className="mt-2 font-mono text-xs text-zinc-500 truncate">{email}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-amber-400 px-2.5 py-1 font-mono text-xs">
                <Zap size={13} strokeWidth={1.5} />
                {credits ?? "…"} credits
              </span>
              <BuyCreditsButton label="Buy 5" />
            </div>
          </div>

          <div className="p-3">
            <button
              onClick={newChat}
              disabled={creatingChat}
              data-testid="new-chat-btn"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors py-2 text-sm font-medium disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
            >
              <Plus size={16} strokeWidth={2} />
              {creatingChat ? "Creating…" : "New chat"}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
            {chats.map((c) => (
              <div key={c.id} className="group relative flex items-center">
                <Link
                  href={`/chat/${c.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex-1 block rounded-lg pl-3 pr-14 py-2 text-sm truncate transition-colors ${
                    pathname === `/chat/${c.id}`
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  {c.title || "New chat"}
                </Link>
                <div className="absolute right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => openRename(c, e)}
                    data-testid="rename-chat-btn"
                    aria-label="Rename chat"
                    className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                  >
                    <Pencil size={13} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={(e) => openDelete(c, e)}
                    data-testid="delete-chat-btn"
                    aria-label="Delete chat"
                    className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
            {chats.length === 0 && (
              <p className="font-mono text-xs text-zinc-600 px-3 py-2">No chats yet.</p>
            )}
          </nav>
        </div>

        <div className="p-3 border-t border-zinc-800 space-y-0.5">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setSidebarOpen(false)}
                data-testid={n.testid}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === n.href
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                {n.label}
              </Link>
            );
          })}
          <ThemeToggle />
          <button
            onClick={signOut}
            data-testid="sign-out-btn"
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-hidden">{children}</main>

      {/* Delete confirmation (in-app, not a browser alert) */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-medium text-zinc-50">Delete chat?</h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              <span className="text-zinc-200">{confirmDelete.title || "New chat"}</span> and all
              its messages will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doDelete}
                data-testid="confirm-delete-btn"
                className="rounded-lg bg-red-500 text-zinc-50 px-4 py-2 text-sm font-medium hover:bg-red-600 transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {renaming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRenaming(null)}
        >
          <form
            onSubmit={doRename}
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-medium text-zinc-50">Rename chat</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              data-testid="rename-input"
              className="mt-4 w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="confirm-rename-btn"
                className="rounded-lg bg-amber-400 text-zinc-950 px-4 py-2 text-sm font-medium hover:bg-amber-500 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
