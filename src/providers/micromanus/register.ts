/**
 * Registers MicroManus product capabilities on the gateway registry.
 * Import side-effect only (loaded by capability registry bootstrap).
 */

import { registerCapability } from "@/gateway/capabilities/registry";
import { runAgentTurn } from "./research";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { MODELS } from "@/lib/models";

async function ensureChatId(userId: string, chatId?: string): Promise<string | null> {
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
  const { data: cfg } = await admin
    .from("api_configs")
    .select("default_model")
    .eq("user_id", userId)
    .single();
  const model = cfg?.default_model ?? MODELS[0]?.id ?? "gpt-4.1";
  const { data: chat, error } = await admin
    .from("chats")
    .insert({ user_id: userId, model, title: "Channel research" })
    .select("id")
    .single();
  if (error || !chat) return null;
  return chat.id;
}

async function researchHandler(ctx: {
  principal_id: string | null;
  text: string;
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
  const chatId = await ensureChatId(ctx.principal_id, chatIdArg);
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
  async (ctx) => researchHandler(ctx)
);

registerCapability(
  {
    name: "research.run",
    description:
      "Same as research.chat — one-shot research run for channel/CLI surfaces.",
    provider: "micromanus",
    requires_principal: true,
  },
  async (ctx) => researchHandler(ctx)
);
