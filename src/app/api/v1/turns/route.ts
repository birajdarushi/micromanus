import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { handleTurn } from "@/gateway/runner";
import { resolvePrincipal } from "@/gateway/principal-resolve";
import type { SessionSource, TurnEvent, TurnRequest } from "@/gateway/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseEncode(event: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Connector / CLI host entry (Context B → MM capabilities).
 * Auth: Bearer PAT (mm_…) or Supabase cookie session.
 * Body: { text, chatId?, platform?, capability?, source? }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let principalId: string | null = null;

  if (bearer.startsWith("mm_")) {
    const p = await resolvePrincipal({ kind: "service_token", token: bearer });
    principalId = p?.id ?? null;
  } else {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    principalId = user?.id ?? null;
  }

  if (!principalId) {
    return Response.json(
      { error: "Unauthorized — use Bearer mm_… PAT or sign in" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const text: string | undefined = body?.text?.trim() || body?.message?.trim();
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const chatId: string | undefined = body?.chatId;
  const platform = (body?.platform as string) || "cli_attach";
  const capability = (body?.capability as string) || "research.run";

  const source: SessionSource = body?.source ?? {
    platform,
    chat_id: chatId || body?.thread_id || "default",
    chat_type: "dm",
    user_id: principalId,
  };

  const turnReq: TurnRequest = {
    source,
    principal_id: principalId,
    text,
    mode: "text",
    capability,
    meta: chatId ? { chatId } : {},
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const onEvent = async (e: TurnEvent) => {
        try {
          controller.enqueue(sseEncode(e as Record<string, unknown>));
        } catch {
          /* ignore */
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
          /* ignore */
        }
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
