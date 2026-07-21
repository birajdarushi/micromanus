import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { handleTurn } from "@/gateway/runner";
import { webTurnRequest } from "@/gateway/platforms/web";
import type { TurnEvent } from "@/gateway/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseEncode(event: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Web surface → gateway → research.chat capability.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const chatId: string | undefined = body?.chatId;
  const userText: string | undefined = body?.message?.trim();
  if (!chatId || !userText) {
    return Response.json({ error: "chatId and message are required" }, { status: 400 });
  }

  const turnReq = webTurnRequest({
    userId: user.id,
    chatId,
    message: userText,
    userName: user.email,
  });

  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;
      const onEvent = async (e: TurnEvent) => {
        try {
          controller.enqueue(sseEncode(e as Record<string, unknown>));
        } catch {
          /* disconnected */
        }
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);
      try {
        await handleTurn(turnReq, onEvent);
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        streamController = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
