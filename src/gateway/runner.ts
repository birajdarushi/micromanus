/**
 * Gateway turn runner — product-agnostic waist.
 * Surfaces build a TurnRequest; this routes to a capability.
 */

import type { TurnEventHandler, TurnRequest } from "@/gateway/contracts";
import { buildSessionKey } from "@/gateway/contracts";
import { invokeCapability } from "@/gateway/capabilities/registry";
// Side-effect: register Provider:micromanus capabilities
import "@/providers/micromanus/register";

export interface HandleTurnResult {
  session_key: string;
  capability: string;
}

/**
 * Run one turn through the capability router.
 * Default capability for MM product: research.chat
 */
export async function handleTurn(
  request: TurnRequest,
  onEvent: TurnEventHandler
): Promise<HandleTurnResult> {
  const capability = request.capability ?? "research.chat";
  const session_key = buildSessionKey(request.source);

  await invokeCapability(capability, {
    source: request.source,
    principal_id: request.principal_id ?? null,
    text: request.text,
    args: (request.meta as Record<string, unknown> | undefined) ?? undefined,
    onEvent,
  });

  return { session_key, capability };
}
