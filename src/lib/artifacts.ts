import { createSupabaseAdmin } from "@/lib/supabase/server";

/** PDF artifacts are deleted after this many days (storage + DB row). */
export const ARTIFACT_TTL_DAYS = 3;

/** Max PDF reports one user may create per UTC calendar day (Heroku stability). */
export const MAX_PDFS_PER_USER_PER_DAY = 10;

/**
 * Delete artifacts older than ARTIFACT_TTL_DAYS from Storage + the artifacts table.
 * Best-effort; safe to call often (e.g. on list / create).
 */
export async function cleanupExpiredArtifacts(): Promise<number> {
  const admin = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - ARTIFACT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error } = await admin
    .from("artifacts")
    .select("id, storage_path")
    .lt("created_at", cutoff)
    .limit(100);

  if (error || !expired?.length) return 0;

  const paths = expired.map((r) => r.storage_path).filter(Boolean);
  if (paths.length) {
    await admin.storage.from("artifacts").remove(paths);
  }
  const ids = expired.map((r) => r.id);
  await admin.from("artifacts").delete().in("id", ids);
  return ids.length;
}

/** How many PDFs this user has created since UTC midnight. */
export async function countPdfsToday(userId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());

  if (error) return 0;
  return count ?? 0;
}

export async function assertPdfQuota(userId: string): Promise<void> {
  const n = await countPdfsToday(userId);
  if (n >= MAX_PDFS_PER_USER_PER_DAY) {
    throw new Error(
      `Daily PDF limit reached (${MAX_PDFS_PER_USER_PER_DAY} per day). Try again tomorrow — this keeps the service stable.`
    );
  }
}
