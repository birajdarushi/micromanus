"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
  /** leading icon element (rendered before the label) */
  icon?: React.ReactNode;
  /** shown when the value isn't in options (e.g. a custom model id) */
  fallbackLabel?: string;
  className?: string;
  menuClassName?: string;
  /** override the trigger button's look (layout classes are always applied) */
  buttonClassName?: string;
  align?: "left" | "right";
  "aria-label"?: string;
  "data-testid"?: string;
}

// A self-contained, keyboard-accessible dropdown — no native <select> chrome.
// Closes on outside-click / Escape; menu floats with a soft shadow.
export default function Dropdown({
  value,
  onChange,
  options,
  disabled,
  icon,
  fallbackLabel,
  className = "",
  menuClassName = "",
  buttonClassName,
  align = "left",
  "aria-label": ariaLabel,
  "data-testid": testId,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const current = selected?.label ?? fallbackLabel ?? value ?? "Select";

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const openMenu = () => {
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active].value);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={testId}
        className={`flex w-full items-center gap-1.5 transition-colors disabled:opacity-60 focus-visible:outline-none ${
          buttonClassName ??
          "rounded-lg border border-zinc-800 bg-zinc-950 pl-2.5 pr-1.5 py-1.5 font-mono text-xs text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 focus-visible:border-accent-500"
        }`}
      >
        {icon}
        <span className="truncate">{current}</span>
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          className={`ml-auto shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          id={listId}
          className={`mm-float absolute z-30 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-1 ${
            align === "right" ? "right-0" : "left-0"
          } ${menuClassName}`}
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  onMouseEnter={() => setActive(i)}
                  data-testid={testId ? `${testId}-opt` : undefined}
                  className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                    i === active ? "bg-zinc-800" : ""
                  }`}
                >
                  <Check
                    size={13}
                    strokeWidth={2}
                    className={`mt-0.5 shrink-0 ${isSel ? "text-accent-400" : "text-transparent"}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-zinc-100">{o.label}</span>
                    {o.hint && <span className="block truncate text-[10px] text-zinc-500">{o.hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
