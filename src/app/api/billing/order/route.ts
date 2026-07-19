import Razorpay from "razorpay";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { paywallPrice } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { currency, amount, display } = paywallPrice();

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `mm_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, purpose: "micromanus_unlock" },
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
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order creation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
