/**
 * Short-lived link codes: MM user generates code; Discord/WA user claims it.
 * Hermes-inspired pairing without requiring OAuth on every channel.
 */

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { generateOpaqueToken, hashToken } from "@/gateway/principal-resolve";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 8): string {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i]! % ALPHABET.length];
  return s;
}

/** Create a link code for the authenticated MM user (web). */
export async function createLinkCode(userId: string): Promise<{
  code: string;
  expires_at: string;
}> {
  const admin = createSupabaseAdmin();
  const code = randomCode(8);
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error } = await admin.from("link_codes").insert({
    code_hash: hashToken(code.toUpperCase()),
    user_id: userId,
    expires_at: expires,
  });
  if (error) throw new Error(error.message);
  return { code, expires_at: expires };
}

/** Claim a code from a channel identity (Discord/WA). */
export async function claimLinkCode(params: {
  code: string;
  channel: string;
  externalId: string;
  meta?: Record<string, unknown>;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const admin = createSupabaseAdmin();
  const codeHash = hashToken(params.code.trim().toUpperCase());
  const { data: row } = await admin
    .from("link_codes")
    .select("id, user_id, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (!row) return { ok: false, error: "Invalid code" };
  if (row.consumed_at) return { ok: false, error: "Code already used" };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "Code expired" };
  }

  const { error: linkErr } = await admin.from("channel_identities").upsert(
    {
      channel: params.channel,
      external_id: params.externalId,
      user_id: row.user_id,
      meta: params.meta ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel,external_id" }
  );
  if (linkErr) return { ok: false, error: linkErr.message };

  await admin
    .from("link_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true, userId: row.user_id };
}

/** Create a personal access token for CLI/connector (Context B host → MM). */
export async function createPersonalAccessToken(params: {
  userId: string;
  name: string;
  expiresInDays?: number;
}): Promise<{ token: string; id: string }> {
  const admin = createSupabaseAdmin();
  const raw = `mm_${generateOpaqueToken(32)}`;
  const tokenHash = hashToken(raw);
  const expires =
    params.expiresInDays != null
      ? new Date(Date.now() + params.expiresInDays * 864e5).toISOString()
      : null;
  const { data, error } = await admin
    .from("personal_access_tokens")
    .insert({
      user_id: params.userId,
      name: params.name,
      token_hash: tokenHash,
      token_prefix: raw.slice(0, 10),
      expires_at: expires,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create token");
  return { token: raw, id: data.id };
}
