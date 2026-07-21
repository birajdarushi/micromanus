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
 * Set Interactions Endpoint URL to:
 *   https://<your-host>/api/surfaces/discord/interactions
 * Register slash commands: research, link (see docs/GATEWAY.md).
 */
export async function POST(req: NextRequest) {
  if (!discordConfigured()) {
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
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: unknown;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const response = await handleDiscordInteraction(
    interaction as Parameters<typeof handleDiscordInteraction>[0]
  );
  return Response.json(response);
}
