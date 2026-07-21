/**
 * Base platform adapter interface (Hermes-inspired).
 * Each surface implements normalize-in + deliver-out.
 */

import type { MessageEvent, SessionSource, TurnEvent } from "@/gateway/contracts";

export type SendResult = { ok: true } | { ok: false; error: string };

export abstract class BasePlatformAdapter {
  abstract readonly platform: string;

  /** Connect / start listeners. Return false if misconfigured. */
  abstract connect(): Promise<boolean>;

  abstract disconnect(): Promise<void>;

  /** Deliver a final or status text to the originating chat. */
  abstract send(
    source: SessionSource,
    text: string,
    meta?: Record<string, unknown>
  ): Promise<SendResult>;

  /** Optional: map platform wire payload → MessageEvent (null = ignore). */
  normalizeInbound?(raw: unknown): MessageEvent | null;

  /** Optional: map turn stream events to platform UX. */
  async onTurnEvent?(
    source: SessionSource,
    event: TurnEvent
  ): Promise<void> {
    if (event.type === "final" || event.type === "done") {
      const text = event.text ?? "";
      if (text) await this.send(source, text);
    } else if (event.type === "error") {
      await this.send(source, event.message ?? "Error");
    }
  }
}
