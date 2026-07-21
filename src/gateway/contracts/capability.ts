/**
 * Capability registry types — gateway waist, provider-agnostic.
 *
 * Capabilities are named operations (research.run, artifact.pdf, …).
 * Providers implement them. Surfaces never call providers directly.
 *
 * MicroManus product registers research.* on the micromanus provider.
 * A future standalone gateway host can register other tools the same way
 * without coupling to Discord or to any particular CLI brand.
 */

import type { TurnEventHandler } from "./events";
import type { SessionSource } from "./session";

export interface CapabilityDescriptor {
  /** e.g. "research.chat", "research.run", "artifact.pdf" */
  name: string;
  description: string;
  /** Implementing provider id, e.g. "micromanus" */
  provider: string;
  /** If true, invoke requires a resolved principal_id (billing identity). */
  requires_principal: boolean;
}

export interface CapabilityInvokeContext {
  source: SessionSource;
  principal_id: string | null;
  text: string;
  args?: Record<string, unknown>;
  onEvent: TurnEventHandler;
}

export type CapabilityHandler = (ctx: CapabilityInvokeContext) => Promise<void>;

export interface CapabilityEntry extends CapabilityDescriptor {
  handler: CapabilityHandler;
}
