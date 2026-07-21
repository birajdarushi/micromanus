/**
 * Web surface adapter — maps HTTP chat body → TurnRequest.
 * Context A: MicroManus product UI.
 */

import type { SessionSource, TurnRequest } from "@/gateway/contracts";

export function webSessionSource(params: {
  userId: string;
  chatId: string;
  userName?: string | null;
}): SessionSource {
  return {
    platform: "web",
    chat_id: params.chatId,
    chat_type: "dm",
    user_id: params.userId,
    user_name: params.userName ?? null,
  };
}

export function webTurnRequest(params: {
  userId: string;
  chatId: string;
  message: string;
  userName?: string | null;
}): TurnRequest {
  return {
    source: webSessionSource(params),
    principal_id: params.userId,
    text: params.message,
    mode: "text",
    capability: "research.chat",
    meta: { chatId: params.chatId },
  };
}
