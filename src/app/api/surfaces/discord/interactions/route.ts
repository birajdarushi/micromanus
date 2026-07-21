import { NextRequest, after } from "next/server";
import {
  discordConfigured,
  processDeferredInteraction,
  quickAck,
  verifyDiscordSignature,
  type DiscordInteraction,
} from "@/gateway/platforms/discord/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Discord Interactions endpoint (must respond < 3s).
 *
 * URL to set in Developer Portal:
 *   https://rushiraj.birajdar.in/api/surfaces/discord/interactions
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  if (!discordConfigured()) {
    console.error("[discord] not configured");
    return Response.json({ error: "Discord not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  const ok = await verifyDiscordSignature(rawBody, signature, timestamp);
  if (!ok) {
    console.error("[discord] bad signature", {
      ms: Date.now() - t0,
      hasSig: Boolean(signature),
      hasTs: Boolean(timestamp),
      bodyLen: rawBody.length,
      keyPrefix: (process.env.DISCORD_PUBLIC_KEY || "").trim().slice(0, 8),
    });
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  console.info("[discord] interaction", {
    type: interaction.type,
    cmd: interaction.data?.name,
    ms: Date.now() - t0,
  });

  // Instant ACK
  const ack = quickAck(interaction);

  // Schedule heavy work only when we deferred (type 5)
  if ((ack as { type?: number }).type === 5) {
    after(async () => {
      try {
        await processDeferredInteraction(interaction);
      } catch (e) {
        console.error("[discord] after() failed", e);
      }
    });
  }

  console.info("[discord] ack", { type: (ack as { type?: number }).type, ms: Date.now() - t0 });
  return Response.json(ack);
}

/** Health check — open in browser to confirm deploy + env. */
export async function GET() {
  return Response.json({
    ok: true,
    configured: discordConfigured(),
    applicationId: process.env.DISCORD_APPLICATION_ID || null,
    publicKeyPrefix: (process.env.DISCORD_PUBLIC_KEY || "").slice(0, 8) || null,
    interactionsUrl:
      "https://rushiraj.birajdar.in/api/surfaces/discord/interactions",
  });
}
