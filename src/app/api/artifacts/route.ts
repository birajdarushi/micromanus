import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lists every PDF the user has generated, newest first, each with a fresh
// short-lived signed URL (the stored 7-day URLs may have expired).
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data: rows } = await admin
    .from("artifacts")
    .select("id, filename, storage_path, created_at, chat_id, chats(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const artifacts = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data: signed } = await admin.storage
        .from("artifacts")
        .createSignedUrl(r.storage_path, 60 * 60);
      const chat = r.chats as { title?: string } | { title?: string }[] | null;
      const chatTitle = Array.isArray(chat) ? chat[0]?.title : chat?.title;
      return {
        id: r.id,
        filename: r.filename,
        createdAt: r.created_at,
        chatId: r.chat_id,
        chatTitle: chatTitle ?? null,
        url: signed?.signedUrl ?? null,
      };
    })
  );

  return Response.json({ artifacts });
}
