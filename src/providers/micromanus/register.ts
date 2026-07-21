/**
 * Registers MicroManus product capabilities on the gateway registry.
 * Import side-effect only (loaded by capability registry bootstrap).
 */

import { createHash } from "crypto";
import { registerCapability } from "@/gateway/capabilities/registry";
import { buildSessionKey, type SessionSource } from "@/gateway/contracts";
import { runAgentTurn } from "./research";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { MODELS } from "@/lib/models";

/**
 * Resolve a durable chat lane for this principal + surface session.
 * Hermes-style: same Discord user/channel/guild keeps the same MM chat
 * (history continues). Explicit chatId (web) always wins.
 */
async function ensureChatId(
  userId: string,
  chatId?: string,
  source?: SessionSource
): Promise<string | null> {
  const admin = createSupabaseAdmin();
  if (chatId) {
    const { data } = await admin
      .from("chats")
      .select("id, user_id")
      .eq("id", chatId)
      .single();
    if (data?.user_id === userId) return data.id;
    return null;
  }

  // Stable lane title from session key (fits chats.title; opaque but unique per surface thread)
  const sessionKey = source ? buildSessionKey(source) : `web|orphan|${userId}`;
  const laneTitle =
    "gw:" + createHash("sha256").update(sessionKey).digest("hex").slice(0, 28);

  const { data: existing } = await admin
    .from("chats")
    .select("id")
    .eq("user_id", userId)
    .eq("title", laneTitle)
    .maybeSingle();
  if (existing?.id) {
    await admin
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: cfg } = await admin
    .from("api_configs")
    .select("default_model")
    .eq("user_id", userId)
    .single();
  const model = cfg?.default_model ?? MODELS[0]?.id ?? "gpt-4.1";
  const { data: chat, error } = await admin
    .from("chats")
    .insert({ user_id: userId, model, title: laneTitle })
    .select("id")
    .single();
  if (error || !chat) return null;
  return chat.id;
}

async function researchHandler(ctx: {
  principal_id: string | null;
  text: string;
  source?: SessionSource;
  args?: Record<string, unknown>;
  onEvent: (e: import("@/gateway/contracts").TurnEvent) => void | Promise<void>;
}) {
  if (!ctx.principal_id) {
    await ctx.onEvent({
      type: "error",
      message: "Not authenticated as a MicroManus user.",
    });
    return;
  }
  const chatIdArg =
    typeof ctx.args?.chatId === "string" ? ctx.args.chatId : undefined;
  const chatId = await ensureChatId(
    ctx.principal_id,
    chatIdArg,
    ctx.source
  );
  if (!chatId) {
    await ctx.onEvent({
      type: "error",
      message: "Could not open a chat for this research run.",
    });
    return;
  }

  const turn = await runAgentTurn({
    userId: ctx.principal_id,
    chatId,
    message: ctx.text,
    onEvent: ctx.onEvent,
  });
  if (!turn.ok) {
    await ctx.onEvent({
      type: "error",
      message:
        (turn.body.message as string) ||
        (turn.body.error as string) ||
        "Research failed",
    });
    return;
  }
  await turn.execute();
}

registerCapability(
  {
    name: "research.chat",
    description:
      "Run a MicroManus deep-research turn in an existing or auto-created chat (billed).",
    provider: "micromanus",
    requires_principal: true,
  },
  async (ctx) =>
    researchHandler({
      principal_id: ctx.principal_id,
      text: ctx.text,
      source: ctx.source,
      args: ctx.args,
      onEvent: ctx.onEvent,
    })
);

registerCapability(
  {
    name: "research.run",
    description:
      "Research run for channel/CLI surfaces; reuses the same chat lane per session key.",
    provider: "micromanus",
    requires_principal: true,
  },
  async (ctx) =>
    researchHandler({
      principal_id: ctx.principal_id,
      text: ctx.text,
      source: ctx.source,
      args: ctx.args,
      onEvent: ctx.onEvent,
    })
);
