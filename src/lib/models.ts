// Model catalog with per-provider pricing (USD per 1M tokens).
// Cost is computed per usage event: input / output / cached tokens priced separately.
// cachedIn = price for tokens served from the provider's prompt cache.
//
// Pricing last reviewed: 2026-07-20 against Anthropic + OpenAI public rate cards.
// Update when providers publish new list prices.

export type Provider = "anthropic" | "openai" | "kimi" | "google";

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  // USD per 1M tokens
  input: number;
  output: number;
  cachedIn: number;
  // suggested base URL for a direct (non-router) key
  hint: string;
}

/** ISO date string of last pricing review (shown in Settings). */
export const PRICING_AS_OF = "2026-07-20";

export const MODELS: ModelInfo[] = [
  // ---- Anthropic (OpenAI-compatible endpoint or router) ----
  // Cache reads ≈ 10% of input list price (Anthropic prompt-cache read tier).
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    input: 15.0,
    output: 75.0,
    cachedIn: 1.5,
    hint: "https://api.anthropic.com/v1",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    input: 3.0,
    output: 15.0,
    cachedIn: 0.3,
    hint: "https://api.anthropic.com/v1",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    input: 1.0,
    output: 5.0,
    cachedIn: 0.1,
    hint: "https://api.anthropic.com/v1",
  },

  // ---- OpenAI ----
  // Cached input typically 50% of standard input (OpenAI automatic caching).
  {
    id: "gpt-5.1",
    label: "GPT-5.1",
    provider: "openai",
    input: 1.25,
    output: 10.0,
    cachedIn: 0.125,
    hint: "https://api.openai.com/v1",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    provider: "openai",
    input: 1.25,
    output: 10.0,
    cachedIn: 0.125,
    hint: "https://api.openai.com/v1",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    provider: "openai",
    input: 0.25,
    output: 2.0,
    cachedIn: 0.025,
    hint: "https://api.openai.com/v1",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    input: 2.0,
    output: 8.0,
    cachedIn: 0.5,
    hint: "https://api.openai.com/v1",
  },

  // ---- Kimi (Moonshot AI) ----
  {
    id: "kimi-k2-thinking",
    label: "Kimi K2 Thinking",
    provider: "kimi",
    input: 0.6,
    output: 2.5,
    cachedIn: 0.15,
    hint: "https://api.moonshot.ai/v1",
  },
  {
    id: "kimi-k2-0905-preview",
    label: "Kimi K2 (0905)",
    provider: "kimi",
    input: 0.6,
    output: 2.5,
    cachedIn: 0.15,
    hint: "https://api.moonshot.ai/v1",
  },
  {
    id: "kimi-latest",
    label: "Kimi Latest",
    provider: "kimi",
    input: 0.6,
    output: 2.5,
    cachedIn: 0.15,
    hint: "https://api.moonshot.ai/v1",
  },

  // ---- Gemini (Google OpenAI-compatible) ----
  {
    id: "gemini-flash-latest",
    label: "Gemini Flash (latest)",
    provider: "google",
    input: 0.3,
    output: 2.5,
    cachedIn: 0.075,
    hint: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  {
    id: "gemini-flash-lite-latest",
    label: "Gemini Flash Lite",
    provider: "google",
    input: 0.1,
    output: 0.4,
    cachedIn: 0.025,
    hint: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    input: 0.3,
    output: 2.5,
    cachedIn: 0.075,
    hint: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "google",
    input: 0.3,
    output: 2.5,
    cachedIn: 0.075,
    hint: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
];

export function getModel(id: string): ModelInfo | undefined {
  return (
    MODELS.find((m) => m.id === id) ??
    MODELS.find((m) => id.endsWith(m.id) || id.includes(m.id))
  );
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface CostBreakdown {
  costInput: number;
  costOutput: number;
  costCached: number;
  costTotal: number;
}

export function computeCost(modelId: string, u: Usage): CostBreakdown {
  const m = getModel(modelId);
  const input = m ? ((u.inputTokens - u.cachedTokens) * m.input) / 1_000_000 : 0;
  const cached = m ? (u.cachedTokens * m.cachedIn) / 1_000_000 : 0;
  const output = m ? (u.outputTokens * m.output) / 1_000_000 : 0;
  const clamp = (n: number) => Math.max(0, n);
  return {
    costInput: clamp(input),
    costOutput: clamp(output),
    costCached: clamp(cached),
    costTotal: clamp(input) + clamp(output) + clamp(cached),
  };
}
