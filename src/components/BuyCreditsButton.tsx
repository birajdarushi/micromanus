"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () =>
      w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load"));
    s.onerror = () => reject(new Error("Razorpay failed to load"));
    document.body.appendChild(s);
  });
}

// Reusable top-up button: runs the same Razorpay order→verify flow as the paywall.
// verify() grants 5 credits per paid order (idempotent) and adds to the balance.
export default function BuyCreditsButton({
  className,
  label = "Buy credits",
}: {
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    try {
      const Razorpay = await loadRazorpay();
      const res = await fetch("/api/billing/order", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create order");

      const rzp = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "MicroManus",
        description: "Top-up — 5 research credits",
        order_id: data.orderId,
        theme: { color: "#fbbf24" },
        handler: async (resp: Record<string, string>) => {
          try {
            const v = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const vd = await v.json();
            if (!v.ok) throw new Error(vd.error ?? "Verification failed");
            toast.success(`${vd.creditsGranted ?? 5} credits added`);
            window.dispatchEvent(new Event("mm:refresh"));
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
    <button
      onClick={buy}
      disabled={busy}
      data-testid="buy-credits-btn"
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors px-3 py-1.5 text-xs font-medium disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
      }
    >
      <CreditCard size={14} strokeWidth={1.5} />
      {busy ? "Opening…" : label}
    </button>
  );
}
