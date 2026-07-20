"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const ACCENTS = [
  { id: "indigo", color: "#6366f1", label: "Indigo" },
  { id: "violet", color: "#8b5cf6", label: "Violet" },
  { id: "blue", color: "#3b82f6", label: "Blue" },
  { id: "emerald", color: "#10b981", label: "Emerald" },
  { id: "rose", color: "#f43f5e", label: "Rose" },
];

// Lets the user recolour the whole UI's accent. Persisted in localStorage and
// applied via <html data-accent="…">; "indigo" is the default (no attribute).
export default function AccentPicker() {
  const [accent, setAccent] = useState("indigo");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccent(localStorage.getItem("mm-accent") || "indigo");
  }, []);

  const pick = (id: string) => {
    setAccent(id);
    localStorage.setItem("mm-accent", id);
    if (id === "indigo") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", id);
  };

  return (
    <div className="flex items-center gap-2.5">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => pick(a.id)}
          aria-label={a.label}
          title={a.label}
          data-testid={`accent-${a.id}`}
          className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition-transform ${
            accent === a.id ? "ring-zinc-100 scale-110" : "ring-transparent hover:scale-105"
          }`}
          style={{ backgroundColor: a.color }}
        >
          {accent === a.id && <Check size={14} strokeWidth={2.5} className="text-white" />}
        </button>
      ))}
    </div>
  );
}
