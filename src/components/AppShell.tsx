"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
  Trash2,
  Pencil,
  FileText,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import Mascot from "@/components/Mascot";
import CreditTopUp from "@/components/CreditTopUp";
import ThemeToggle from "@/components/ThemeToggle";
import { timeAgo } from "@/lib/time";
import { formatModShortcut } from "@/lib/platform";
import { identifyUser } from "@/components/PostHogProvider";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ChatListItem | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Platform-specific label (⌘K vs Ctrl+K). Default non-Apple for SSR; resolved on mount.
  const [newChatShortcut, setNewChatShortcut] = useState("Ctrl+K");
  const renameRef = useRef<HTMLInputElement>(null);
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
        if (d.user?.id) {
          identifyUser(d.user.id, { email: d.user.email ?? null });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("mm:refresh", onRefresh);
    return () => window.removeEventListener("mm:refresh", onRefresh);
  }, [refresh]);

  // restore collapsed state + platform shortcut label (SSR can't read navigator)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem("mm-sidebar-collapsed") === "1");
    setNewChatShortcut(formatModShortcut("K"));
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("mm-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const newChat = useCallback(() => {
    router.push("/chat");
    setSidebarOpen(false);
  }, [router]);

  // Meta+K (macOS) / Ctrl+K (Windows, Linux) opens a new chat from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  function openDelete(chat: ChatListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(chat);
  }

  function startRename(chat: ChatListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenameValue(chat.title || "");
    setRenamingId(chat.id);
    setTimeout(() => renameRef.current?.focus(), 0);
  }

  async function commitRename(chat: ChatListItem) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === chat.title) return;
    // optimistic
    setChats((cs) => cs.map((c) => (c.id === chat.id ? { ...c, title } : c)));
    const res = await fetch(`/api/chats/${chat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) toast.success("Chat renamed");
    else {
      toast.error("Couldn't rename the chat");
      refresh();
    }
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

  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const nav = [
    { href: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
    { href: "/usage", label: "Cost & stats", icon: BarChart3, testid: "nav-usage" },
    { href: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
  ];

  const railWidth = collapsed ? "md:w-16" : "md:w-64";

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-950 text-zinc-50">
      {/* mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
        data-testid="sidebar-toggle"
        className="md:hidden fixed top-3 left-3 z-40 rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-zinc-300 hover:text-zinc-50 transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
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
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 ${railWidth} transition-all duration-200 fixed md:static z-30 w-64 h-full flex flex-col justify-between bg-zinc-950 border-r border-zinc-800`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className={`p-4 border-b border-zinc-800 ${collapsed ? "md:px-2" : ""}`}>
            {/* ChatGPT-style brand: logo is the collapse control; on hover it
                swaps to the panel icon. Wordmark still navigates home. */}
            <div
              className={`flex items-center gap-2 ${collapsed ? "md:justify-center" : ""}`}
            >
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                data-testid="collapse-toggle"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="group relative hidden md:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-200 hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
              >
                <span className="absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                  <Mascot state="idle" size={26} />
                </span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 text-zinc-300 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {collapsed ? (
                    <PanelLeft size={18} strokeWidth={1.5} />
                  ) : (
                    <PanelLeftClose size={18} strokeWidth={1.5} />
                  )}
                </span>
              </button>
              {/* Mobile still needs a static brand mark (no collapse rail). */}
              <Link
                href="/chat"
                className="md:hidden flex items-center gap-2 font-heading font-medium tracking-tight text-lg text-zinc-50"
                onClick={() => setSidebarOpen(false)}
              >
                <Mascot state="idle" size={26} />
                <span>MicroManus</span>
              </Link>
              <Link
                href="/chat"
                className={`font-heading font-medium tracking-tight text-lg text-zinc-50 hover:text-zinc-200 transition-colors ${collapsed ? "md:hidden" : "hidden md:inline"}`}
              >
                MicroManus
              </Link>
            </div>

            {!collapsed && (
              <div className="mt-2 font-mono text-xs text-zinc-500 truncate">{email}</div>
            )}
          </div>

          <div className={`p-3 ${collapsed ? "md:px-2" : ""}`}>
            <button
              onClick={newChat}
              data-testid="new-chat-btn"
              title={`New chat (${newChatShortcut})`}
              className={`w-full flex items-center justify-center gap-2 rounded-lg bg-accent-600 text-white hover:bg-accent-500 transition-colors py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none`}
            >
              <Plus size={16} strokeWidth={2} />
              <span className={collapsed ? "md:hidden" : ""}>New chat</span>
              <kbd
                className={`ml-1 items-center gap-0.5 rounded border border-white/25 px-1.5 py-0.5 font-mono text-[10px] text-white/80 ${collapsed ? "md:hidden" : "hidden sm:inline-flex"}`}
              >
                {newChatShortcut}
              </kbd>
            </button>
          </div>

          {/* chat list — hidden in the collapsed rail */}
          <nav className={`flex-1 overflow-y-auto px-3 space-y-0.5 ${collapsed ? "md:hidden" : ""}`}>
            {!collapsed && chats.length > 0 && (
              <p className="px-3 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                Recent
              </p>
            )}
            {chats.map((c) => {
              const active = pathname === `/chat/${c.id}`;
              if (renamingId === c.id) {
                return (
                  <div key={c.id} className="px-0 py-0.5">
                    <input
                      ref={renameRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(c);
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      data-testid="rename-input"
                      className="w-full rounded-lg bg-zinc-950 border border-accent-500 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                );
              }
              return (
                <div key={c.id} className="group relative flex items-center">
                  <Link
                    href={`/chat/${c.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex-1 min-w-0 block rounded-lg pl-3 pr-16 py-2 text-sm truncate transition-colors ${
                      active
                        ? "bg-zinc-800 text-zinc-50"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    {c.title || "New chat"}
                  </Link>
                  {/* timestamp (hidden on hover to reveal actions) */}
                  <span className="pointer-events-none absolute right-2.5 font-mono text-[10px] text-zinc-600 transition-opacity group-hover:opacity-0">
                    {timeAgo(c.updated_at)}
                  </span>
                  <div className="absolute right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startRename(c, e)}
                      data-testid="rename-chat-btn"
                      aria-label="Rename chat"
                      className="p-1 rounded text-zinc-500 hover:text-accent-400 hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={(e) => openDelete(c, e)}
                      data-testid="delete-chat-btn"
                      aria-label="Delete chat"
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })}
            {chats.length === 0 && (
              <p className="font-mono text-xs text-zinc-600 px-3 py-2">No chats yet.</p>
            )}
          </nav>
          {collapsed && <div className="flex-1 md:block hidden" />}
        </div>

        <div className={`p-3 border-t border-zinc-800 space-y-0.5 ${collapsed ? "md:px-2" : ""}`}>
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setSidebarOpen(false)}
                data-testid={n.testid}
                title={n.label}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${collapsed ? "md:justify-center md:px-2" : ""} ${
                  active
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span className={collapsed ? "md:hidden" : ""}>{n.label}</span>
              </Link>
            );
          })}
          <ThemeToggle collapsed={collapsed} />
          <button
            onClick={signOut}
            data-testid="sign-out-btn"
            title="Sign out"
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors ${collapsed ? "md:justify-center md:px-2" : ""}`}
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className={collapsed ? "md:hidden" : ""}>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="relative flex-1 h-full overflow-hidden">
        {/* Credits chip sits in the main header row (top-right), vertically centered. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-end px-3 md:px-4">
          <div className="pointer-events-auto">
            <CreditTopUp credits={credits} align="right" />
          </div>
        </div>
        {children}
      </main>

      {/* Delete confirmation (destructive → keep an explicit confirm) */}
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
    </div>
  );
}
