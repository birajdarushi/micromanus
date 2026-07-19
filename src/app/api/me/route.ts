import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: profile }, { data: cfg }] = await Promise.all([
    supabase.from("profiles").select("credits, paywall_passed, email").eq("id", user.id).single(),
    supabase.from("api_configs").select("default_model").eq("user_id", user.id).single(),
  ]);

  return Response.json({
    user: { id: user.id, email: user.email },
    credits: profile?.credits ?? 0,
    paywallPassed: profile?.paywall_passed ?? false,
    hasApiKey: !!cfg,
    defaultModel: cfg?.default_model ?? null,
  });
}
