/**
 * Turn / message event contracts for the gateway waist.
 * Surfaces emit MessageEvent → gateway runs a Turn → streams TurnEvent.
 */

import type { SessionSource } from "./session";

export type TurnMode = "text" | "voice";

/** Normalized inbound from any surface (Discord, WA, web, CLI attach, …). */
export interface MessageEvent {
  source: SessionSource;
  text?: string;
  /** Opaque handle for audio (STT later); gateway may resolve before turn. */
  audio_ref?: string;
  timestamp?: string;
  /** Optional surrounding channel context (read-only; never triggers a turn). */
  context?: Array<{ user_name?: string; text: string; at?: string }>;
}

export interface TurnRequest {
  source: SessionSource;
  /** Resolved principal for provider billing (MM user id when applicable). */
  principal_id?: string | null;
  text: string;
  mode?: TurnMode;
  /**
   * Capability to invoke. Default for MM product path: research.chat.
   * Standalone gateway hosts may route other capabilities later.
   */
  capability?: string;
  /** Opaque surface metadata (reply hints, etc.). */
  meta?: Record<string, unknown>;
}

export type TurnEventType =
  | "status"
  | "thought"
  | "tool_call"
  | "tool_result"
  | "artifact"
  | "partial"
  | "final"
  | "done"
  | "error";

/**
 * Streamed progress for any surface.
 * Web maps these to existing SSE frames; Discord/WA map to messages.
 */
export interface TurnEvent {
  type: TurnEventType;
  text?: string;
  message?: string;
  tool?: string;
  args?: unknown;
  summary?: string;
  artifact?: { id: string; filename: string; url: string };
  artifacts?: Array<{ id: string; filename: string; url: string }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
  };
  cost?: {
    costInput: number;
    costOutput: number;
    costCached: number;
    costTotal: number;
  };
  creditsRemaining?: number;
  /** Escape hatch for surface-specific fields. */
  [key: string]: unknown;
}

export type TurnEventHandler = (event: TurnEvent) => void | Promise<void>;
