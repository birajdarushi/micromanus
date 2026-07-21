/**
 * WhatsApp Cloud API surface (Context A — MM product).
 * Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET (optional)
 */

import { createHmac, timingSafeEqual } from "crypto";
import { handleTurn } from "@/gateway/runner";
import { resolvePrincipal } from "@/gateway/principal-resolve";
import { claimLinkCode } from "@/gateway/pairing";
import type { SessionSource, TurnEvent } from "@/gateway/contracts";

export function whatsappConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_TOKEN?.trim() &&
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
    process.env.WHATSAPP_VERIFY_TOKEN?.trim()
  );
}

export function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN?.trim() &&
    challenge
  ) {
    return challenge;
  }
  return null;
}

/** Optional HMAC of raw body when WHATSAPP_APP_SECRET is set. */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true; // optional
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = signatureHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const chunks = chunkText(body, 3500);
  for (const text of chunks) {
    await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  }
}

function chunkText(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}

type WaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

type WaPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WaMessage[];
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
      };
    }>;
  }>;
};

export async function handleWhatsAppWebhook(payload: WaPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const messages = value?.messages ?? [];
      const contactName = value?.contacts?.[0]?.profile?.name;

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;
        const from = msg.from;
        const text = msg.text.body.trim();
        if (!text) continue;

        // link CODE
        const linkMatch = text.match(/^link\s+([A-Za-z0-9]{6,12})$/i);
        if (linkMatch) {
          const result = await claimLinkCode({
            code: linkMatch[1]!,
            channel: "whatsapp",
            externalId: from,
            meta: { name: contactName },
          });
          await sendWhatsAppText(
            from,
            result.ok
              ? "Linked to MicroManus. Send a research question anytime."
              : `Link failed: ${result.error}`
          );
          continue;
        }

        const principal = await resolvePrincipal({
          kind: "channel_link",
          channel: "whatsapp",
          external_user_id: from,
        });

        if (!principal) {
          await sendWhatsAppText(
            from,
            "Not linked. In MicroManus create a link code (Settings / API), then send: link YOURCODE"
          );
          continue;
        }

        const source: SessionSource = {
          platform: "whatsapp",
          chat_id: from,
          chat_type: "dm",
          user_id: from,
          user_name: contactName ?? null,
        };

        let finalText = "";
        const onEvent = async (e: TurnEvent) => {
          if (e.type === "done" || e.type === "final") finalText = e.text ?? finalText;
          if (e.type === "error") finalText = e.message ?? "Research failed";
        };

        try {
          await sendWhatsAppText(from, "Researching…");
          await handleTurn(
            {
              source,
              principal_id: principal.id,
              text,
              capability: "research.run",
              mode: "text",
            },
            onEvent
          );
          await sendWhatsAppText(
            from,
            finalText || "Done (no text). Try again with a clearer question."
          );
        } catch (err) {
          await sendWhatsAppText(
            from,
            err instanceof Error ? err.message : "Research failed"
          );
        }
      }
    }
  }
}
