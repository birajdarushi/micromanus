"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

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

export default function PaywallPage() {
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState<"coupon" | "pay" | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  }, [router]);

  function unlocked(msg: string) {
    setSuccess(msg);
    setTimeout(() => router.replace(hasKeyRedirect()), 1200);
  }

  function hasKeyRedirect() {
    return "/settings?welcome=1";
  }

  async function redeemCoupon(e: React.FormEvent) {
    e.preventDefault();
    setBusy("coupon");
    setError(null);
    try {
      const res = await fetch("/api/billing/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Coupon failed");
      unlocked(`Coupon accepted — ${data.creditsGranted} credits added ✨`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coupon failed");
    } finally {
      setBusy(null);
    }
  }

  async function payWithCard() {
    setBusy("pay");
    setError(null);
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
        theme: { color: "#6366f1" },
        handler: async (resp: RazorpayResponse) => {
          try {
            const v = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const vd = await v.json();
            if (!v.ok) throw new Error(vd.error ?? "Verification failed");
            unlocked(`Payment verified — ${vd.creditsGranted ?? 5} credits added 🎉`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed");
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔓</div>
          <h1 className="text-2xl font-semibold">Unlock MicroManus</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            One unlock gives you <span className="text-zinc-200 font-medium">5 research credits</span>.
            Each credit runs one full agent research task.
          </p>
        </div>

        {success ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 text-emerald-300 p-4 text-center text-sm">
            {success}
            <div className="text-emerald-500 text-xs mt-1">Taking you to setup…</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="font-medium mb-1">Pay with card</h2>
              <p className="text-sm text-zinc-400 mb-4">
                ₹425 (≈ $5) via Razorpay — test mode, use card{" "}
                <code className="text-zinc-300">4111 1111 1111 1111</code>, any future
                expiry, any CVV.
              </p>
              <button
                onClick={payWithCard}
                disabled={!!busy}
                className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 transition py-2.5 font-medium disabled:opacity-60"
              >
                {busy === "pay" ? "Opening checkout…" : "Pay & unlock — 5 credits"}
              </button>
            </div>

            <div className="flex items-center gap-3 text-zinc-600 text-xs">
              <div className="h-px bg-zinc-800 flex-1" /> OR <div className="h-px bg-zinc-800 flex-1" />
            </div>

            <form
              onSubmit={redeemCoupon}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <h2 className="font-medium mb-1">Have a coupon?</h2>
              <p className="text-sm text-zinc-400 mb-4">Redeem it to skip payment.</p>
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!!busy || !coupon.trim()}
                  className="rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-300 transition disabled:opacity-60"
                >
                  {busy === "coupon" ? "…" : "Redeem"}
                </button>
              </div>
            </form>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
