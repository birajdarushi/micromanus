import AppShell from "@/components/AppShell";

// Shared chrome for authenticated app routes. Layout stays mounted across
// client navigations (chat ↔ settings ↔ usage ↔ reports), so the sidebar
// and /api/me + /api/chats only load once instead of on every link click.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
