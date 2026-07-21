/**
 * MicroManus product provider — research + (later) credits/artifacts capabilities.
 * Separate from the gateway waist and from any host CLI runtime.
 */
export { runAgentTurn, SYSTEM_PROMPT, temporalContextMessage } from "./research";
export type { RunAgentTurnParams, AgentTurnHttpError, AgentTurnReady } from "./research";
