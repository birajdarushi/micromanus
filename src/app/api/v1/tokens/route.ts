import { NextRequest } from "next/server";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { createPersonalAccessToken } from "@/gateway/pairing";

export const runtime = "nodejs";

/** List PAT metadata (never the secret). */
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("personal_access_tokens")
    .select("id, name, token_prefix, expires_at, revoked_at, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tokens: data });
}

/** Create PAT — secret returned once. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name as string)?.trim() || "CLI token";
  const expiresInDays =
    typeof body?.expiresInDays === "number" ? body.expiresInDays : 90;

  try {
    const { token, id } = await createPersonalAccessToken({
      userId: user.id,
      name,
      expiresInDays,
    });
    return Response.json({
      id,
      token,
      name,
      warning: "Store this token now — it will not be shown again.",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
