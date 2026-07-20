"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

export default function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("mm-theme") as Theme) || "dark";
    // sync UI state to the persisted theme on mount (SSR can't read localStorage)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mm-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const label = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label="Toggle color theme"
      title={label}
      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors ${
        collapsed ? "md:justify-center md:px-2" : ""
      }`}
    >
      {theme === "dark" ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
      <span className={collapsed ? "md:hidden" : ""}>{label}</span>
    </button>
  );
}
