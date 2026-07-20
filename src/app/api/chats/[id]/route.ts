import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: chat } = await supabase
    .from("chats")
    .select("id, title, model")
    .eq("id", id)
    .single();
  if (!chat) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ chat, messages });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: { model?: string; title?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body?.model === "string" && body.model.trim()) patch.model = body.model.trim();
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (!patch.model && !patch.title) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chats")
    .update(patch)
    .eq("id", id)
    .select("id, title, model")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ chat: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.from("chats").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
