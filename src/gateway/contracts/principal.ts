/**
 * Principal — who is authorized / billed when a capability needs identity.
 *
 * This is intentionally separate from AgentRuntime login (Claude/Grok/etc.).
 * - Principal: MM user (or future host account) for credits & provider keys
 * - AgentRuntime: already-logged-in CLI brain; credentials stay in that runtime
 *
 * Two product contexts share this type but resolve differently:
 * 1) MM product: cookie | channel link | pairing → profiles.id
 * 2) Standalone gateway/CLI host: device pair / local owner → optional principal
 *    when invoking MM; no principal needed for pure local-runtime turns
 */

export type PrincipalKind =
  | "mm_user" // Supabase auth.users / profiles.id
  | "device_owner" // paired laptop / CLI host owner
  | "service" // internal service account
  | "anonymous"; // not allowed for MM billed capabilities

export interface Principal {
  kind: PrincipalKind;
  /** Stable id (MM user uuid for mm_user). */
  id: string;
  /** Optional display */
  label?: string | null;
}

export type SurfaceAuthKind =
  | "user_session" // web Supabase cookie
  | "channel_link" // discord/whatsapp → channel_identities
  | "device_pair" // CLI/host device trust
  | "service_token" // PAT / service bearer
  | "local_loopback"; // localhost-only (never from public internet)

export interface SurfaceAuthContext {
  kind: SurfaceAuthKind;
  /** Raw proof material (token, cookie user id already resolved, etc.). */
  token?: string;
  external_user_id?: string;
  channel?: string;
}
