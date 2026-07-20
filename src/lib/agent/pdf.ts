import { createSupabaseAdmin } from "@/lib/supabase/server";
import { renderPdf } from "./pdf-render";
import type { ToolContext } from "./tools";

// Public entry: render markdown -> PDF, upload to the private `artifacts`
// bucket, record the row, and return a 7-day signed URL. The rendering itself
// lives in ./pdf-render (import-light, so it can be unit-tested in isolation).
export async function generatePdfReport(
  title: string,
  markdown: string,
  ctx: ToolContext
): Promise<{ id: string; filename: string; url: string }> {
  const buffer = await renderPdf(title, markdown);

  const admin = createSupabaseAdmin();
  const safeTitle =
    title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "report";
  const filename = `${safeTitle}.pdf`;
  const storagePath = `${ctx.userId}/${ctx.chatId}/${Date.now()}-${filename}`;

  const { error: upErr } = await admin.storage
    .from("artifacts")
    .upload(storagePath, buffer, { contentType: "application/pdf" });
  if (upErr) throw new Error(`artifact upload failed: ${upErr.message}`);

  const { data: row, error: insErr } = await admin
    .from("artifacts")
    .insert({ user_id: ctx.userId, chat_id: ctx.chatId, filename, storage_path: storagePath })
    .select("id")
    .single();
  if (insErr) throw new Error(`artifact record failed: ${insErr.message}`);

  const { data: signed, error: signErr } = await admin.storage
    .from("artifacts")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
  if (signErr || !signed) throw new Error(`artifact signing failed: ${signErr?.message}`);

  return { id: row.id, filename, url: signed.signedUrl };
}
