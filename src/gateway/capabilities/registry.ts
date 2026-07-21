/**
 * Capability registry — gateway waist.
 * Surfaces never call providers directly; they invoke named capabilities.
 */

import type {
  CapabilityDescriptor,
  CapabilityEntry,
  CapabilityHandler,
  CapabilityInvokeContext,
} from "@/gateway/contracts";

const entries = new Map<string, CapabilityEntry>();

export function registerCapability(
  descriptor: CapabilityDescriptor,
  handler: CapabilityHandler
): void {
  entries.set(descriptor.name, { ...descriptor, handler });
}

export function getCapability(name: string): CapabilityEntry | undefined {
  return entries.get(name);
}

export function listCapabilities(): CapabilityDescriptor[] {
  return [...entries.values()].map(({ handler: _h, ...d }) => d);
}

export async function invokeCapability(
  name: string,
  ctx: CapabilityInvokeContext
): Promise<void> {
  const entry = entries.get(name);
  if (!entry) {
    await ctx.onEvent({
      type: "error",
      message: `Unknown capability: ${name}`,
    });
    return;
  }
  if (entry.requires_principal && !ctx.principal_id) {
    await ctx.onEvent({
      type: "error",
      message: "This capability requires a linked MicroManus account.",
    });
    return;
  }
  await entry.handler(ctx);
}
