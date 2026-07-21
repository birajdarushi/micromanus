import { createSupabaseServer } from "@/lib/supabase/server";
import { createLinkCode } from "@/gateway/pairing";

export const runtime = "nodejs";

/** Authenticated MM user: generate a one-time link code for Discord/WhatsApp. */
export async function POST() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const { code, expires_at } = await createLinkCode(user.id);
    return Response.json({
      code,
      expires_at,
      instructions:
        "In Discord or WhatsApp, send: link " +
        code +
        "  (code expires in 15 minutes)",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to create code" },
      { status: 500 }
    );
  }
}
