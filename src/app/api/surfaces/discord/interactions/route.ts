import { NextRequest } from "next/server";
import {
  discordConfigured,
  handleDiscordInteraction,
  verifyDiscordSignature,
} from "@/gateway/platforms/discord/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Discord Interactions endpoint.
 * Must return within ~3s. Heavy work continues after deferred (type 5) ACK.
 *
 * Interactions URL:
 *   https://rushiraj.birajdar.in/api/surfaces/discord/interactions
 */
export async function POST(req: NextRequest) {
  if (!discordConfigured()) {
    console.error("[discord] not configured");
    return Response.json(
      { error: "Discord not configured (DISCORD_BOT_TOKEN / DISCORD_PUBLIC_KEY)" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  const ok = verifyDiscordSignature(rawBody, signature, timestamp);
  if (!ok) {
    console.error("[discord] bad signature", {
      hasSig: !!signature,
      hasTs: !!timestamp,
      bodyLen: rawBody.length,
      keyLen: (process.env.DISCORD_PUBLIC_KEY || "").trim().length,
    });
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: { type?: number; data?: { name?: string } };
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  // PING must be instant
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  const response = await handleDiscordInteraction(
    interaction as Parameters<typeof handleDiscordInteraction>[0]
  );
  return Response.json(response);
}
