/**
 * Session contracts — Hermes-inspired, product-agnostic.
 *
 * These types belong to the **gateway waist**, not to MicroManus product logic.
 * Surfaces (web, Discord, WhatsApp, cli_attach, future tools) normalize into
 * SessionSource; the gateway keys isolation via buildSessionKey.
 *
 * Context A: MicroManus product (web / Discord / WhatsApp → research provider)
 * Context B: Standalone remote-attach / multi-surface gateway for any host CLI
 *            (Claude, Grok, Codex, …) — separate product surface, same contracts
 * They share contracts; they are NOT a merged "Grok inside MM" app.
 */

export type ChatType = "dm" | "group" | "channel" | "thread" | "forum";

/** Well-known platform ids; open string allows future surfaces without core edits. */
export type PlatformId =
  | "web"
  | "discord"
  | "whatsapp"
  | "cli_attach"
  | "local"
  | (string & {});

/**
 * Where a message came from. Mirrors Hermes SessionSource discriminators:
 * platform + chat + optional thread + scope (guild/workspace) + user.
 */
export interface SessionSource {
  platform: PlatformId;
  /** Primary conversation id (chat / channel / MM chat uuid / terminal thread). */
  chat_id: string;
  chat_type?: ChatType;
  chat_name?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  /** Thread / forum topic id when nested. */
  thread_id?: string | null;
  /**
   * Scope discriminator: Discord guild, Slack workspace, Matrix server, etc.
   * REQUIRED for multi-tenant server isolation (e.g. Discord guild).
   */
  scope_id?: string | null;
  parent_chat_id?: string | null;
  message_id?: string | null;
}

export interface Session {
  session_key: string;
  session_id: string;
  source: SessionSource;
  /** MicroManus principal when this session bills/runs MM capabilities. */
  principal_id?: string | null;
  created_at: string;
  updated_at: string;
}

function part(value: string | null | undefined): string {
  if (value == null || value === "") return "-";
  // Collapse separators so keys stay parseable
  return String(value).replace(/\|/g, "_");
}

/**
 * Deterministic conversation-lane key.
 *
 * Policy:
 * - Always: platform | scope | chat_id
 * - Threads: include thread_id
 * - DMs: include user_id when present (per-user isolation)
 * - Groups/channels: shared lane unless thread_id set (channel-wide session)
 *
 * Discord: scope_id MUST be the guild id for server channels or two guilds collide.
 */
export function buildSessionKey(source: SessionSource): string {
  const platform = part(source.platform).toLowerCase();
  const scope = part(source.scope_id);
  const chat = part(source.chat_id);
  const chatType = (source.chat_type ?? "dm").toLowerCase() as ChatType;
  const thread = source.thread_id != null && source.thread_id !== "" ? part(source.thread_id) : null;

  const base = `${platform}|${scope}|${chat}`;

  if (thread) {
    return `${base}|t:${thread}`;
  }

  if (chatType === "dm" && source.user_id) {
    return `${base}|u:${part(source.user_id)}`;
  }

  return base;
}
