"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus, Loader2, Zap } from "lucide-react";

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => reject(new Error("Razorpay failed to load"));
    document.body.appendChild(s);
  });
}

interface Pricing {
  symbol: string;
  perCredit: number;
  min: number;
  max: number;
}

interface Props {
  /** When set, the trigger shows the balance (count + subtle +). */
  credits?: number | null;
  /** Popover horizontal anchor (use right when the pill sits in a top-right corner). */
  align?: "left" | "right";
}

// Header chip: zinc surface + zinc-800 border (same language as the rest of the app).
// Amber is reserved for the credit signal only. Click opens the top-up popover.
export default function CreditTopUp({ credits, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(5);
  const [busy, setBusy] = useState(false);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasBalance = credits !== undefined;

  useEffect(() => {
    if (!open || pricing) return;
    fetch("/api/billing/order")
      .then((r) => r.json())
      .then((d) => setPricing(d))
      .catch(() => {});
  }, [open, pricing]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const min = pricing?.min ?? 1;
  const max = pricing?.max ?? 100;
  const clamp = (n: number) => Math.max(min, Math.min(max, n || 0));
  const cost =
    pricing && qty > 0 ? `${pricing.symbol}${Math.round((pricing.perCredit * qty) / 100)}` : "…";

  async function buy() {
    setBusy(true);
    try {
      const Razorpay = await loadRazorpay();
      const res = await fetch("/api/billing/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create order");

      const rzp = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "MicroManus",
        description: `Top-up — ${data.credits} research credits`,
        order_id: data.orderId,
        theme: { color: "#6366f1" },
        handler: async (resp: Record<string, string>) => {
          try {
            const v = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const vd = await v.json();
            if (!v.ok) throw new Error(vd.error ?? "Verification failed");
            toast.success(`${vd.creditsGranted ?? qty} credits added`);
            window.dispatchEvent(new Event("mm:refresh"));
            setOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verification failed");
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="credit-topup-btn"
        aria-label="Buy more credits"
        aria-expanded={open}
        title="Buy more credits"
        className={`group inline-flex h-8 items-center gap-2 rounded-lg border bg-zinc-900/80 pl-2.5 pr-1.5 font-mono text-xs shadow-sm shadow-black/20 backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none ${
          open
            ? "border-zinc-700 bg-zinc-900 text-zinc-100"
            : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
        }`}
      >
        <Zap size={13} strokeWidth={1.5} className="shrink-0 text-amber-400" />
        {hasBalance ? (
          <>
            <span className="flex items-baseline gap-1">
              <span className="tabular-nums font-medium text-amber-400">{credits ?? "…"}</span>
              <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">
                credits
              </span>
            </span>
            <span
              aria-hidden
              className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950/80 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-amber-400"
            >
              <Plus size={12} strokeWidth={2} />
            </span>
          </>
        ) : (
          <>
            <span className="text-zinc-300">Buy more</span>
            <span
              aria-hidden
              className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950/80 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-amber-400"
            >
              <Plus size={12} strokeWidth={2} />
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Buy more credits"
          className={`absolute top-10 z-40 w-60 rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 shadow-2xl shadow-black/50 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="font-sans text-xs font-medium text-zinc-200">Buy more credits</p>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
            1 credit = 1 research run
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty((q) => clamp(q - 1))}
              aria-label="Decrease"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <Minus size={14} strokeWidth={2} />
            </button>
            <input
              type="number"
              value={qty}
              min={min}
              max={max}
              onChange={(e) => setQty(clamp(parseInt(e.target.value, 10)))}
              data-testid="credit-qty-input"
              className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 text-center font-mono text-sm text-zinc-100 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
            />
            <button
              type="button"
              onClick={() => setQty((q) => clamp(q + 1))}
              aria-label="Increase"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              {qty} credit{qty === 1 ? "" : "s"}
            </span>
            <span className="font-mono font-medium text-zinc-100">{cost}</span>
          </div>
          <button
            type="button"
            onClick={buy}
            disabled={busy || qty < min}
            data-testid="credit-topup-buy"
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-600 text-white hover:bg-accent-500 transition-colors py-2 text-sm font-medium disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
          >
            {busy ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : null}
            {busy ? "Opening…" : `Pay ${cost}`}
          </button>
        </div>
      )}
    </div>
  );
}
