"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { toast } from "sonner";
import { CreditCard, Ticket } from "lucide-react";
import Mascot from "@/components/Mascot";
import { captureEvent } from "@/components/PostHogProvider";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const BG =
  "https://images.unsplash.com/photo-1622737133809-d95047b9e673?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZ2VvbWV0cmljJTIwM2QlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQ0ODUyMDV8MA&ixlib=rb-4.1.0&q=85";

export default function PaywallPage() {
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState<"coupon" | "pay" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.paywallPassed) router.replace("/chat");
        if (d.user?.email) setEmail(d.user.email);
      })
      .catch(() => {});
    captureEvent("paywall_viewed");
  }, [router]);

  function unlocked(msg: string) {
    setSuccess(msg);
    toast.success(msg);
    setTimeout(() => router.replace("/settings?welcome=1"), 1200);
  }

  async function redeemCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy("coupon");
    try {
      const res = await fetch("/api/billing/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Coupon failed");
      captureEvent("coupon_redeemed", { credits_granted: data.creditsGranted });
      unlocked(`Coupon accepted — ${data.creditsGranted} credits added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coupon failed");
    } finally {
      setBusy(null);
    }
  }

  async function payWithCard() {
    setBusy("pay");
    captureEvent("payment_initiated");
    try {
      const res = await fetch("/api/billing/order", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create order");

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "MicroManus",
        description: "Unlock — 5 research credits",
        order_id: data.orderId,
        prefill: { email },
        theme: { color: "#fbbf24" },
        handler: async (resp: RazorpayResponse) => {
          try {
            const v = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const vd = await v.json();
            if (!v.ok) throw new Error(vd.error ?? "Verification failed");
            captureEvent("payment_completed", { credits_granted: vd.creditsGranted ?? 5 });
            unlocked(`Payment verified — ${vd.creditsGranted ?? 5} credits added`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Verification failed");
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div className="relative w-full max-w-md animate-in fade-in duration-300">
        <div className="text-center mb-8 flex flex-col items-center">
          <Mascot state="lock" size={88} className="mb-1" />
          <h1 className="font-heading text-2xl font-medium tracking-tight text-zinc-50">
            Unlock MicroManus
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            One unlock gives you{" "}
            <span className="text-amber-400 font-medium">5 research credits</span>. Each
            credit runs one full agent research task.
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-2xl p-8 text-center shadow-2xl shadow-black/50">
            <Mascot state="complete" size={72} />
            <p className="text-emerald-400 text-sm font-medium">{success}</p>
            <p className="font-mono text-xs text-zinc-500">Taking you to setup…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-2xl p-6 shadow-2xl shadow-black/50">
              <h2 className="flex items-center gap-2 font-heading font-medium text-zinc-50">
                <CreditCard size={18} strokeWidth={1.5} className="text-amber-400" />
                Pay with card
              </h2>
              <p className="text-sm text-zinc-400 mt-1 mb-4">
                ₹425 (≈ $5) via Razorpay — test mode. Use card{" "}
                <code className="font-mono text-zinc-300">4111 1111 1111 1111</code>, any
                future expiry, any CVV.
              </p>
              <button
                onClick={payWithCard}
                disabled={!!busy}
                data-testid="pay-btn"
                className="w-full rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors py-2.5 font-medium disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
              >
                {busy === "pay" ? "Opening checkout…" : "Pay & unlock — 5 credits"}
              </button>
            </div>

            <div className="flex items-center gap-3 text-zinc-600 font-mono text-xs">
              <div className="h-px bg-zinc-800 flex-1" /> OR{" "}
              <div className="h-px bg-zinc-800 flex-1" />
            </div>

            <form
              onSubmit={redeemCoupon}
              className="rounded-2xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-2xl p-6 shadow-2xl shadow-black/50"
            >
              <h2 className="flex items-center gap-2 font-heading font-medium text-zinc-50">
                <Ticket size={18} strokeWidth={1.5} className="text-amber-400" />
                Have a coupon?
              </h2>
              <p className="text-sm text-zinc-400 mt-1 mb-4">Redeem it to skip payment.</p>
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code"
                  data-testid="coupon-input"
                  className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                />
                <button
                  type="submit"
                  disabled={!!busy || !coupon.trim()}
                  data-testid="redeem-btn"
                  className="rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-white transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                >
                  {busy === "coupon" ? "…" : "Redeem"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
