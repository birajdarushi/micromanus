/**
 * Discord surface (Context A — MM product).
 * Interactions HTTP endpoint (slash commands).
 * Env: DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_APPLICATION_ID
 */

import { createPublicKey, verify as cryptoVerify } from "crypto";
import { handleTurn } from "@/gateway/runner";
import { resolvePrincipal } from "@/gateway/principal-resolve";
import { claimLinkCode } from "@/gateway/pairing";
import type { SessionSource, TurnEvent } from "@/gateway/contracts";

const DISCORD_API = "https://discord.com/api/v10";

export function discordConfigured(): boolean {
  return !!(
    process.env.DISCORD_BOT_TOKEN?.trim() &&
    process.env.DISCORD_PUBLIC_KEY?.trim()
  );
}

/** Verify Discord interaction signature (Ed25519). */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY?.trim();
  if (!publicKeyHex || !signature || !timestamp) return false;
  try {
    const keyObject = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKeyHex, "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      Buffer.from(timestamp + rawBody),
      keyObject,
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

async function discordRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const token = process.env.DISCORD_BOT_TOKEN!;
  return fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

export async function replyInteraction(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  const chunks = chunkText(content, 1900);
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      await discordRequest(
        "PATCH",
        `/webhooks/${applicationId}/${interactionToken}/messages/@original`,
        { content: chunks[i] }
      );
    } else {
      await discordRequest("POST", `/webhooks/${applicationId}/${interactionToken}`, {
        content: chunks[i],
      });
    }
  }
}

function chunkText(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}

type DiscordInteraction = {
  type: number;
  id: string;
  token: string;
  application_id?: string;
  channel_id?: string;
  guild_id?: string;
  member?: { user?: { id: string; username?: string } };
  user?: { id: string; username?: string };
  data?: {
    name?: string;
    options?: Array<{ name: string; type: number; value?: string }>;
  };
};

/**
 * Handle Discord interaction JSON after signature verify.
 */
export async function handleDiscordInteraction(
  interaction: DiscordInteraction
): Promise<object> {
  if (interaction.type === 1) {
    return { type: 1 }; // PONG
  }

  if (interaction.type !== 2) {
    return {
      type: 4,
      data: { content: "Unsupported interaction.", flags: 64 },
    };
  }

  const userId = interaction.member?.user?.id || interaction.user?.id || "";
  const userName =
    interaction.member?.user?.username || interaction.user?.username || "";
  const cmd = interaction.data?.name ?? "";
  const optQuery =
    interaction.data?.options?.find((o) => o.name === "query")?.value ??
    interaction.data?.options?.find((o) => o.name === "code")?.value ??
    "";

  const applicationId =
    interaction.application_id || process.env.DISCORD_APPLICATION_ID || "";

  if (cmd === "link") {
    const code = String(optQuery || "").trim();
    if (!code) {
      return {
        type: 4,
        data: {
          content:
            "Usage: `/link code:ABCD1234` (generate a code via POST /api/v1/link/code while signed in).",
          flags: 64,
        },
      };
    }
    const result = await claimLinkCode({
      code,
      channel: "discord",
      externalId: userId,
      meta: { username: userName },
    });
    return {
      type: 4,
      data: {
        content: result.ok
          ? "Linked to your MicroManus account. Use `/research` next."
          : `Link failed: ${result.error}`,
        flags: 64,
      },
    };
  }

  if (cmd === "research") {
    const query = String(optQuery || "").trim();
    if (!query) {
      return {
        type: 4,
        data: { content: "Usage: `/research query:…`", flags: 64 },
      };
    }

    // Defer, then research in background (Discord 3s limit)
    void runDiscordResearch({
      interaction,
      query,
      userId,
      userName,
      applicationId,
    });

    return { type: 5 }; // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  }

  return {
    type: 4,
    data: {
      content: "Unknown command. Try `/research` or `/link`.",
      flags: 64,
    },
  };
}

async function runDiscordResearch(params: {
  interaction: DiscordInteraction;
  query: string;
  userId: string;
  userName: string;
  applicationId: string;
}) {
  const { interaction, query, userId, userName, applicationId } = params;
  const principal = await resolvePrincipal({
    kind: "channel_link",
    channel: "discord",
    external_user_id: userId,
  });

  if (!principal) {
    await replyInteraction(
      applicationId,
      interaction.token,
      "Not linked. Generate a code in MicroManus (`POST /api/v1/link/code`), then `/link code:YOURCODE`."
    );
    return;
  }

  const source: SessionSource = {
    platform: "discord",
    chat_id: interaction.channel_id || "dm",
    chat_type: interaction.guild_id ? "channel" : "dm",
    scope_id: interaction.guild_id || null,
    user_id: userId,
    user_name: userName,
  };

  let finalText = "";

  const onEvent = async (e: TurnEvent) => {
    if (e.type === "done" || e.type === "final") finalText = e.text ?? finalText;
    if (e.type === "error") finalText = e.message ?? "Research failed";
  };

  try {
    await handleTurn(
      {
        source,
        principal_id: principal.id,
        text: query,
        capability: "research.run",
        mode: "text",
      },
      onEvent
    );
  } catch (err) {
    finalText = err instanceof Error ? err.message : "Research failed";
  }

  await replyInteraction(
    applicationId,
    interaction.token,
    (finalText || "Research finished with no text output.").slice(0, 1900)
  );
}
