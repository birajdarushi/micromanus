import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MODELS } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("chats")
    .select("id, title, model, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ chats: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let model: string = body?.model ?? "";
  if (!model) {
    const { data: cfg } = await supabase
      .from("api_configs")
      .select("default_model")
      .eq("user_id", user.id)
      .single();
    model = cfg?.default_model ?? MODELS[0].id;
  }

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: user.id, model })
    .select("id, title, model")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ chat: data });
}
