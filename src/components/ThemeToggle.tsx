"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("mm-theme") as Theme) || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mm-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <button
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label="Toggle color theme"
      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
    >
      {theme === "dark" ? (
        <Sun size={16} strokeWidth={1.5} />
      ) : (
        <Moon size={16} strokeWidth={1.5} />
      )}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
