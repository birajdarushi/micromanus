/**
 * Resolve SurfaceAuth → Principal (MM user id when applicable).
 */

import { createHash, randomBytes } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Principal, SurfaceAuthContext } from "@/gateway/contracts";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Resolve principal from surface auth context.
 * - user_session: caller already has MM user id in token field
 * - channel_link: look up channel_identities
 * - service_token: look up personal_access_tokens
 * - device_pair: look up device_pairings
 * - local_loopback: only when allowLocal is true (never from public webhooks)
 */
export async function resolvePrincipal(
  auth: SurfaceAuthContext,
  opts?: { allowLocal?: boolean }
): Promise<Principal | null> {
  if (auth.kind === "user_session" && auth.token) {
    return { kind: "mm_user", id: auth.token };
  }

  if (auth.kind === "local_loopback") {
    if (!opts?.allowLocal) return null;
    if (auth.token) return { kind: "device_owner", id: auth.token };
    return null;
  }

  const admin = createSupabaseAdmin();

  if (auth.kind === "channel_link" && auth.channel && auth.external_user_id) {
    const { data } = await admin
      .from("channel_identities")
      .select("user_id")
      .eq("channel", auth.channel)
      .eq("external_id", auth.external_user_id)
      .maybeSingle();
    if (!data?.user_id) return null;
    return { kind: "mm_user", id: data.user_id };
  }

  if (auth.kind === "service_token" && auth.token) {
    const tokenHash = hashToken(auth.token);
    const { data } = await admin
      .from("personal_access_tokens")
      .select("user_id, revoked_at, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!data?.user_id || data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    await admin
      .from("personal_access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
    return { kind: "mm_user", id: data.user_id };
  }

  if (auth.kind === "device_pair" && auth.token) {
    const tokenHash = hashToken(auth.token);
    const { data } = await admin
      .from("device_pairings")
      .select("user_id, revoked_at")
      .eq("device_secret_hash", tokenHash)
      .maybeSingle();
    if (!data?.user_id || data.revoked_at) return null;
    return { kind: "device_owner", id: data.user_id };
  }

  return null;
}

export async function linkChannelIdentity(params: {
  channel: string;
  externalId: string;
  userId: string;
  meta?: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("channel_identities").upsert(
    {
      channel: params.channel,
      external_id: params.externalId,
      user_id: params.userId,
      meta: params.meta ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel,external_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
