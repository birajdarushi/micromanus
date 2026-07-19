import { NextRequest } from "next/server";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { COUPON_CODE, CREDITS_PER_UNLOCK } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const code: string = (body?.code ?? "").trim();
  if (code !== COUPON_CODE) {
    return Response.json({ error: "Invalid coupon code" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // one redemption per user (unique constraint backs this up)
  const { error: insErr } = await admin
    .from("coupon_redemptions")
    .insert({ user_id: user.id, code });
  if (insErr) {
    if (insErr.code === "23505") {
      return Response.json({ error: "Coupon already redeemed" }, { status: 409 });
    }
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();
  await admin
    .from("profiles")
    .update({
      credits: (profile?.credits ?? 0) + CREDITS_PER_UNLOCK,
      paywall_passed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return Response.json({ ok: true, creditsGranted: CREDITS_PER_UNLOCK });
}
