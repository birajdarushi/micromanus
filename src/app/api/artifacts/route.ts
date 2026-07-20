import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { ARTIFACT_TTL_DAYS, cleanupExpiredArtifacts } from "@/lib/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lists every PDF the user has generated (within retention), newest first,
// each with a fresh signed URL.
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Opportunistic GC of PDFs older than ARTIFACT_TTL_DAYS
  void cleanupExpiredArtifacts();

  const admin = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - ARTIFACT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from("artifacts")
    .select("id, filename, storage_path, created_at, chat_id, chats(title)")
    .eq("user_id", user.id)
    .gte("created_at", cutoff)
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

  return Response.json({
    artifacts,
    retentionDays: ARTIFACT_TTL_DAYS,
  });
}
