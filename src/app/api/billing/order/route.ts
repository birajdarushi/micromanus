import { NextRequest } from "next/server";
import Razorpay from "razorpay";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { paywallPrice, creditPurchase, perCreditAmount, MIN_CREDITS, MAX_CREDITS } from "@/lib/billing";

export const runtime = "nodejs";

// Pricing info for the top-up UI (no side effects).
export async function GET() {
  const { currency } = paywallPrice();
  return Response.json({
    currency,
    symbol: currency === "USD" ? "$" : "₹",
    perCredit: perCreditAmount(), // smallest unit (paise/cents)
    min: MIN_CREDITS,
    max: MAX_CREDITS,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // A body with { credits } → variable top-up; no body → the fixed unlock pack.
  const body = await req.json().catch(() => null);
  const requested = Number(body?.credits);
  const isTopUp = Number.isFinite(requested) && requested > 0;
  const { currency, amount, display, credits } = isTopUp
    ? creditPurchase(requested)
    : { ...paywallPrice(), credits: 5 };

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `mm_${user.id.slice(0, 8)}_${Date.now()}`,
      // credits is server-authoritative here; verify() reads it back from the order.
      notes: { user_id: user.id, purpose: "micromanus_credits", credits: String(credits) },
    });

    const admin = createSupabaseAdmin();
    await admin.from("payments").insert({
      user_id: user.id,
      provider: "razorpay",
      order_id: order.id,
      amount,
      currency,
      status: "created",
    });

    return Response.json({
      orderId: order.id,
      amount,
      currency,
      display,
      credits,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order creation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
