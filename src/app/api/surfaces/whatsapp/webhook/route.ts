import { NextRequest } from "next/server";
import {
  handleWhatsAppWebhook,
  verifyWhatsAppSignature,
  verifyWhatsAppWebhook,
  whatsappConfigured,
} from "@/gateway/platforms/whatsapp/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meta webhook verification */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const challengeOut = verifyWhatsAppWebhook(mode, token, challenge);
  if (challengeOut != null) {
    return new Response(challengeOut, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Inbound WhatsApp messages */
export async function POST(req: NextRequest) {
  if (!whatsappConfigured()) {
    return Response.json({ error: "WhatsApp not configured" }, { status: 503 });
  }
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWhatsAppSignature(rawBody, sig)) {
    return new Response("invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  // Ack quickly; process async so Meta doesn't retry on long research
  void handleWhatsAppWebhook(payload as Parameters<typeof handleWhatsAppWebhook>[0]);
  return Response.json({ ok: true });
}
