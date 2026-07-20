import crypto from "crypto";
import { NextRequest } from "next/server";
import Razorpay from "razorpay";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { CREDITS_PER_UNLOCK, MAX_CREDITS } from "@/lib/billing";

export const runtime = "nodejs";

// Verifies the Razorpay checkout signature (HMAC-SHA256 of order_id|payment_id
// with the key secret), marks the payment paid, and grants credits — exactly once.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const orderId: string = body?.razorpay_order_id ?? "";
  const paymentId: string = body?.razorpay_payment_id ?? "";
  const signature: string = body?.razorpay_signature ?? "";
  if (!orderId || !paymentId || !signature) {
    return Response.json({ error: "Missing payment fields" }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const valid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) {
    return Response.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // the order must belong to this user and not already be consumed
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, status")
    .eq("order_id", orderId)
    .single();
  if (!payment || payment.user_id !== user.id) {
    return Response.json({ error: "Unknown order" }, { status: 404 });
  }
  if (payment.status === "paid") {
    return Response.json({ ok: true, alreadyProcessed: true });
  }

  const { error: updErr } = await admin
    .from("payments")
    .update({ payment_id: paymentId, status: "paid", updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("status", "created"); // guard against double-grant
  if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

  // How many credits this order was for is server-authoritative: read it back
  // from the Razorpay order notes we set at creation (never trust the client).
  let granted = CREDITS_PER_UNLOCK;
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
    const order = await razorpay.orders.fetch(orderId);
    const n = Number((order.notes as { credits?: string } | undefined)?.credits);
    if (Number.isFinite(n) && n > 0) granted = Math.min(n, MAX_CREDITS);
  } catch {
    /* fall back to the default pack size */
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();
  await admin
    .from("profiles")
    .update({
      credits: (profile?.credits ?? 0) + granted,
      paywall_passed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return Response.json({ ok: true, creditsGranted: granted });
}
