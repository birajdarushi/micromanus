/**
 * Discord surface — light module for verify + command routing.
 * Heavy research is loaded dynamically after Discord gets its 3s ACK.
 */

import { verifyKey } from "discord-interactions";
import type { SessionSource, TurnEvent } from "@/gateway/contracts";

const DISCORD_API = "https://discord.com/api/v10";

export function discordConfigured(): boolean {
  return !!(
    process.env.DISCORD_BOT_TOKEN?.trim() &&
    process.env.DISCORD_PUBLIC_KEY?.trim()
  );
}

/** Official Discord Ed25519 verification (async). */
export async function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): Promise<boolean> {
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim();
  if (!publicKey || !signature || !timestamp) return false;
  try {
    return await verifyKey(rawBody, signature, timestamp, publicKey);
  } catch (e) {
    console.error("[discord] verifyKey threw", e instanceof Error ? e.message : e);
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
    const res =
      i === 0
        ? await discordRequest(
            "PATCH",
            `/webhooks/${applicationId}/${interactionToken}/messages/@original`,
            { content: chunks[i] }
          )
        : await discordRequest(
            "POST",
            `/webhooks/${applicationId}/${interactionToken}`,
            { content: chunks[i] }
          );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[discord] follow-up failed", res.status, t.slice(0, 400));
    }
  }
}

function chunkText(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}

export type DiscordInteraction = {
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
    options?: Array<{ name: string; type: number; value?: string | number }>;
  };
};

/** Fast path: decide ACK body only (no DB / no agent). */
export function quickAck(interaction: DiscordInteraction): object {
  if (interaction.type === 1) return { type: 1 }; // PONG

  if (interaction.type !== 2) {
    return {
      type: 4,
      data: { content: "Unsupported interaction.", flags: 64 },
    };
  }

  const cmd = interaction.data?.name ?? "";
  const opt = String(
    interaction.data?.options?.find((o) => o.name === "query")?.value ??
      interaction.data?.options?.find((o) => o.name === "code")?.value ??
      ""
  ).trim();

  if (cmd === "link") {
    if (!opt) {
      return {
        type: 4,
        data: {
          content:
            "Usage: `/link code:ABCD1234` — generate a code in MicroManus → Settings.",
          flags: 64,
        },
      };
    }
    return { type: 5 }; // defer
  }

  if (cmd === "research") {
    if (!opt) {
      return {
        type: 4,
        data: { content: "Usage: `/research query:…`", flags: 64 },
      };
    }
    return { type: 5 }; // defer
  }

  return {
    type: 4,
    data: {
      content: "Unknown command. Try `/research` or `/link`.",
      flags: 64,
    },
  };
}

/** Background work after Discord has been ACKed (type 5 defer). */
export async function processDeferredInteraction(
  interaction: DiscordInteraction
): Promise<void> {
  if (interaction.type !== 2) return;

  const userId = interaction.member?.user?.id || interaction.user?.id || "";
  const userName =
    interaction.member?.user?.username || interaction.user?.username || "";
  const cmd = interaction.data?.name ?? "";
  const opt = String(
    interaction.data?.options?.find((o) => o.name === "query")?.value ??
      interaction.data?.options?.find((o) => o.name === "code")?.value ??
      ""
  ).trim();
  const applicationId =
    interaction.application_id || process.env.DISCORD_APPLICATION_ID || "";

  if (cmd === "link" && opt) {
    try {
      const { claimLinkCode } = await import("@/gateway/pairing");
      const result = await claimLinkCode({
        code: opt,
        channel: "discord",
        externalId: userId,
        meta: { username: userName },
      });
      await replyInteraction(
        applicationId,
        interaction.token,
        result.ok
          ? "Linked to your MicroManus account. Use `/research` next."
          : `Link failed: ${result.error}`
      );
    } catch (err) {
      console.error("[discord] link error", err);
      await replyInteraction(
        applicationId,
        interaction.token,
        err instanceof Error ? err.message : "Link failed"
      );
    }
    return;
  }

  if (cmd === "research" && opt) {
    try {
      const { resolvePrincipal } = await import("@/gateway/principal-resolve");
      const { handleTurn } = await import("@/gateway/runner");

      const principal = await resolvePrincipal({
        kind: "channel_link",
        channel: "discord",
        external_user_id: userId,
      });

      if (!principal) {
        await replyInteraction(
          applicationId,
          interaction.token,
          "Not linked. MicroManus → Settings → Generate link code, then `/link code:YOURCODE`."
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
        if (e.type === "done" || e.type === "final")
          finalText = e.text ?? finalText;
        if (e.type === "error") finalText = e.message ?? "Research failed";
      };

      await handleTurn(
        {
          source,
          principal_id: principal.id,
          text: opt,
          capability: "research.run",
          mode: "text",
        },
        onEvent
      );

      await replyInteraction(
        applicationId,
        interaction.token,
        (finalText || "Research finished with no text output.").slice(0, 1900)
      );
    } catch (err) {
      console.error("[discord] research error", err);
      await replyInteraction(
        applicationId,
        interaction.token,
        err instanceof Error ? err.message : "Research failed"
      );
    }
  }
}
