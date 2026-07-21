/**
 * Provider:micromanus — research agent capability.
 *
 * Callable without NextRequest so future surfaces (Discord, WhatsApp, HTTP
 * connector) share one brain. Web route is only one surface entry.
 *
 * This is MM product logic (credits, BYOK, tools). It is NOT a host CLI runtime
 * and does not consume Claude/Grok vendor logins.
 */

import OpenAI from "openai";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { computeCost } from "@/lib/models";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/agent/tools";
import type { TurnEvent, TurnEventHandler } from "@/gateway/contracts";

export const MAX_ITERATIONS = 12;
export const HISTORY_LIMIT = 40;

export const SYSTEM_PROMPT = `You are MicroManus, a deep research AI agent. You run a tool-calling loop inspired by open deep-research agents: plan → search → read → reflect (think) → answer/report.

Tools:
- web_search: find sources (several focused queries)
- fetch_url: read a promising page in depth
- image_search: Wikimedia Commons free images with direct embeddable URLs (when the user wants images)
- think: reflection only — after a search/read batch, assess findings and plan the next step (call think alone, not mixed with web_search/fetch)
- create_pdf_report: write a downloadable PDF report

Research method (think like a human researcher with limited time — multi-round is normal):
1. Read the question carefully — what specific information is needed?
2. Round 1: broader discovery. Batch 2–4 focused web_search calls in ONE response (they run in parallel). Vary wording/angles.
3. After each search/read batch, call think alone: What did I learn? What is still missing or weakly sourced? If gaps remain, you MUST run another research round — do not answer early on thin evidence.
4. Later rounds: narrower follow-ups, different queries, or fetch_url on the best links. Batch independent web_search / fetch_url / image_search again in parallel. You may do several rounds (search → think → search → think → …) until confident.
5. Prefer 2–3 solid fetched sources over many shallow snippets when depth matters.
6. Stop only when you can answer confidently with current, citable facts — not because you already searched once. If the last two batches added nothing new, then stop.
7. Synthesize in your own words. Do not stitch quotes. Prefer concrete facts, numbers, dates, names.

Temporal grounding (critical — do not invent "now"):
- A following system message states the true current UTC date. Treat that as authoritative "today".
- For "latest / now / going on / currently / recent" questions: search with the current year (or no year), plus terms like "latest" or the current month/year. Prefer sources from the last 30–90 days when possible.
- Never default-append an older year than the current year from the date context unless the user asked about that year or a specific historical event.
- If search results are clearly older than the topic requires, run another search round with the current year before answering.
- State an as-of date in the answer when covering current events (using the current year/month from the date context). Never frame "now" using a year earlier than today.

Hard limits (prevent endless loops — not a ban on follow-up research):
- Simple factual questions: often 1 parallel batch is enough; still allow a second round if results are weak or off-topic.
- Typical research: 2–3 rounds (each round may include several parallel tool calls).
- Complex / multi-part / PDF reports: up to ~4 rounds; aim ≤ 10 web_search and ≤ 6 fetch_url total across all rounds, then answer or write the report.
- Always leave room for create_pdf_report when a report was requested
- Never refuse a needed follow-up search just because you already searched earlier in this turn

Images:
- When the user asks for images/photos/illustrations, call image_search before create_pdf_report.
- Embed only Direct URLs from image_search via ![short caption](url) inside the PDF markdown only.
- Prefer 2–4 relevant images max; each needs a real caption.

Quality bar:
- Cite with numbered markers [1], [2], [3] mapped to "## Sources". Space them like [1] [7], not [1][7]. Never "(Source: X, Y)" after every bullet.
- Balanced markdown only. Prefer **bold**; if you use *italic*, close every marker. No unpaired * or **.
- NEVER use emojis or icon characters in chat or PDF text.
- No tool logs, scratch notes, or meta-commentary in the final answer.
- If the question is ambiguous, state your interpretation briefly, then answer.

PDF reports:
- If the user asks for a "report", "PDF", "document", "write-up", or to expand a previous report, you MUST call create_pdf_report.
- Soft limit: at most 10 PDFs per user per UTC day (enforced by the tool). Prefer one solid report over many tiny ones.
- Follow-ups that add material → regenerate the FULL updated report and call create_pdf_report again.
- Renderer supports: #/##/###, bullets, numbered lists, tables, > blockquotes, **bold**/*italic*/\`code\`, [text](url), ---, ![caption](image-url).
- Rules:
  - Do NOT repeat the title as an H1 in the body; title is the page header. Start with a one-paragraph executive summary.
  - Heading hierarchy: ## major sections, ### sub-points.
  - Tables hold tabular data only; captions go in a paragraph BELOW the table.
  - Quotes on their own line with "> ".
  - End with "## Sources" as "[1] Short Title — https://full-url".
  - Never write "Page X of Y", timestamps, or debug lines into the body.
- After the PDF, write a short prose summary in chat only. Do NOT restate the filename or use emoji — the UI already shows a download card.

- Keep intermediate tool steps tight; put substance in the final answer.
- Answer in the language the user writes in.`;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Dynamic temporal context — kept out of SYSTEM_PROMPT for cache-friendly prefix. */
export function temporalContextMessage(): string {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const human = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const year = now.getUTCFullYear();
  return (
    `Current UTC date: ${isoDate} (${human}). Current year: ${year}.\n` +
    `Use this as "today" for research. When searching for current events, prefer ` +
    `queries with ${year} (or no year) — do not default to older years. ` +
    `Ground answers in the most recent reliable sources and say as-of dates when relevant.`
  );
}

export interface RunAgentTurnParams {
  /** MM principal (profiles / auth.users id). */
  userId: string;
  chatId: string;
  message: string;
  onEvent: TurnEventHandler;
  /** Optional keep-alive for SSE/Heroku (e.g. enqueue ": ping"). */
  onPing?: () => void;
}

export type AgentTurnHttpError = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

export type AgentTurnReady = {
  ok: true;
  /** Execute the tool loop; emits onEvent until done/error. */
  execute: () => Promise<void>;
};

/**
 * Validate ownership/paywall/key, charge one credit, prepare the run.
 * Call `execute()` to stream events (does not depend on NextRequest).
 */
export async function runAgentTurn(
  params: RunAgentTurnParams
): Promise<AgentTurnHttpError | AgentTurnReady> {
  const { userId, chatId, message: userText, onEvent, onPing } = params;
  const admin = createSupabaseAdmin();

  const { data: chat } = await admin
    .from("chats")
    .select("id, user_id, model, title")
    .eq("id", chatId)
    .single();
  if (!chat || chat.user_id !== userId) {
    return { ok: false, status: 404, body: { error: "Chat not found" } };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("credits, paywall_passed")
    .eq("id", userId)
    .single();
  if (!profile?.paywall_passed) {
    return {
      ok: false,
      status: 402,
      body: { error: "paywall", message: "Unlock MicroManus first." },
    };
  }

  const { data: cfg } = await admin
    .from("api_configs")
    .select("base_url, api_key_encrypted, default_model")
    .eq("user_id", userId)
    .single();
  if (!cfg) {
    return {
      ok: false,
      status: 428,
      body: {
        error: "no_api_key",
        message: "Add your API key in Settings first.",
      },
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(cfg.api_key_encrypted);
  } catch {
    return { ok: false, status: 500, body: { error: "key_decrypt_failed" } };
  }
  if (!/^[\x21-\x7E]+$/.test(apiKey)) {
    return {
      ok: false,
      status: 428,
      body: {
        error: "no_api_key",
        message:
          "Your saved API key looks invalid (it contains spaces or non-ASCII characters). Re-enter a valid provider key in Settings.",
      },
    };
  }

  const { data: remaining, error: creditErr } = await admin.rpc("consume_credit", {
    p_user_id: userId,
    p_amount: 1,
  });
  if (creditErr || remaining === -1) {
    return {
      ok: false,
      status: 402,
      body: { error: "no_credits", message: "You are out of credits." },
    };
  }

  const model = chat.model || cfg.default_model;
  const client = new OpenAI({ apiKey, baseURL: cfg.base_url });

  const { data: history } = await admin
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  await admin.from("messages").insert({
    chat_id: chatId,
    user_id: userId,
    role: "user",
    content: { text: userText },
  });

  // First user message: set a human title only if this is not a gateway lane
  // (gateway chats use stable titles like "gw:<hash>" for Discord/WA continuity).
  if ((history?.length ?? 0) === 0) {
    const { data: chatRow } = await admin
      .from("chats")
      .select("title")
      .eq("id", chatId)
      .single();
    const isGatewayLane = (chatRow?.title ?? "").startsWith("gw:");
    if (!isGatewayLane) {
      await admin
        .from("chats")
        .update({ title: userText.slice(0, 60), updated_at: new Date().toISOString() })
        .eq("id", chatId);
    } else {
      await admin
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
    }
  } else {
    await admin.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: temporalContextMessage() },
  ];
  for (const m of history ?? []) {
    const c = m.content as { text?: string; status?: string };
    if (c?.status === "running") continue;
    const text = c?.text ?? "";
    if (!text) continue;
    if (m.role === "user") messages.push({ role: "user", content: text });
    else if (m.role === "assistant") messages.push({ role: "assistant", content: text });
  }
  messages.push({ role: "user", content: userText });

  const totals = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  const steps: Array<{ tool: string; args: unknown; summary: string }> = [];
  const artifacts: Array<{ id: string; filename: string; url: string }> = [];

  const { data: progressRow } = await admin
    .from("messages")
    .insert({
      chat_id: chatId,
      user_id: userId,
      role: "assistant",
      content: { text: "", steps: [], artifacts: [], status: "running" },
    })
    .select("id")
    .single();
  const progressId: string | null = progressRow?.id ?? null;

  const persistProgress = async (patch: {
    text?: string;
    status: "running" | "done" | "error";
  }) => {
    if (!progressId) return;
    await admin
      .from("messages")
      .update({
        content: {
          text: patch.text ?? "",
          steps,
          artifacts,
          status: patch.status,
        },
      })
      .eq("id", progressId);
  };

  const send = async (e: TurnEvent) => {
    try {
      await onEvent(e);
    } catch {
      /* surface disconnected — run continues; progress in DB */
    }
  };

  const execute = async () => {
    const heartbeat = onPing
      ? setInterval(() => {
          try {
            onPing();
          } catch {
            /* ignore */
          }
        }, 15_000)
      : null;

    const callModel = async () => {
      const maxRetries = 4;
      let delay = 3000;
      for (let attempt = 0; ; attempt++) {
        try {
          return await client.chat.completions.create({
            model,
            messages,
            tools: TOOL_DEFINITIONS,
            tool_choice: "auto",
          });
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if ((status === 429 || status === 503) && attempt < maxRetries) {
            await send({
              type: "status",
              text: `Rate limited by the model provider — waiting ${Math.round(
                delay / 1000
              )}s (retry ${attempt + 1}/${maxRetries})…`,
            });
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * 2, 20_000);
            continue;
          }
          throw e;
        }
      }
    };

    let finalText = "";
    try {
      await send({ type: "status", text: "Thinking…" });
      await persistProgress({ status: "running" });

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const completion = await callModel();

        const usage = completion.usage;
        if (usage) {
          const cached =
            (usage.prompt_tokens_details as { cached_tokens?: number } | undefined)
              ?.cached_tokens ?? 0;
          totals.inputTokens += usage.prompt_tokens ?? 0;
          totals.outputTokens += usage.completion_tokens ?? 0;
          totals.cachedTokens += cached;
        }

        const choice = completion.choices?.[0];
        const msg = choice?.message;
        if (!msg) throw new Error("Empty response from model");

        if (msg.tool_calls?.length) {
          messages.push({
            role: "assistant",
            content: msg.content ?? null,
            tool_calls: msg.tool_calls,
          });
          if (msg.content) await send({ type: "thought", text: msg.content });

          // Parse + announce every tool call, then run independent tools in parallel
          // so multi-query research (several web_search / fetch_url) finishes in one wave.
          type PendingTool = {
            id: string;
            name: string;
            args: Record<string, unknown>;
          };
          const pending: PendingTool[] = [];
          for (const tc of msg.tool_calls) {
            if (tc.type !== "function") continue;
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              /* leave empty */
            }
            pending.push({ id: tc.id, name: tc.function.name, args });
            await send({ type: "tool_call", tool: tc.function.name, args });
          }

          if (pending.length > 1) {
            await send({
              type: "status",
              text: `Running ${pending.length} tools in parallel…`,
            });
          }

          const outcomes = await Promise.all(
            pending.map(async (p) => {
              const outcome = await executeTool(p.name, p.args, {
                userId,
                chatId,
              });
              return { ...p, outcome };
            })
          );

          // Preserve tool_call order when feeding results back to the model.
          for (const { id, name, args, outcome } of outcomes) {
            if (outcome.artifact) {
              artifacts.push(outcome.artifact);
              await send({ type: "artifact", artifact: outcome.artifact });
            }
            const summary =
              outcome.result.length > 200
                ? outcome.result.slice(0, 200) + "…"
                : outcome.result;
            steps.push({ tool: name, args, summary });
            await send({ type: "tool_result", tool: name, summary });
            messages.push({
              role: "tool",
              tool_call_id: id,
              content: outcome.result,
            });
          }
          await persistProgress({ status: "running" });
          continue;
        }

        finalText = msg.content ?? "";
        break;
      }

      if (!finalText) {
        finalText =
          "I ran out of research steps before finishing. Here is what I gathered so far — please ask me to continue.";
      }

      const cost = computeCost(model, totals);
      if (progressId) {
        await admin
          .from("messages")
          .update({
            content: { text: finalText, steps, artifacts, status: "done" },
          })
          .eq("id", progressId);
      } else {
        await admin.from("messages").insert({
          chat_id: chatId,
          user_id: userId,
          role: "assistant",
          content: { text: finalText, steps, artifacts, status: "done" },
        });
      }
      await admin.from("usage_events").insert({
        user_id: userId,
        chat_id: chatId,
        model,
        input_tokens: totals.inputTokens,
        output_tokens: totals.outputTokens,
        cached_tokens: totals.cachedTokens,
        cost_input_usd: cost.costInput,
        cost_output_usd: cost.costOutput,
        cost_cached_usd: cost.costCached,
        cost_total_usd: cost.costTotal,
      });

      await send({
        type: "done",
        text: finalText,
        artifacts,
        usage: totals,
        cost,
        creditsRemaining: remaining as number,
      });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      let message = err instanceof Error ? err.message : "Agent failed";
      if (status === 429) {
        message =
          "The model provider rate-limited this request (free-tier requests-per-minute limit). Wait a minute and try again, or switch to a model/provider with higher limits.";
      } else if (status === 404) {
        message = `Model "${model}" wasn't found at this endpoint — it may be deprecated or misspelled. Pick a current model in Settings.`;
      } else if (status === 401 || status === 403) {
        message =
          "The provider rejected your API key (401/403). Re-check the key and base URL in Settings.";
      }
      if (!finalText) {
        await admin.rpc("consume_credit", { p_user_id: userId, p_amount: -1 });
      }
      await persistProgress({ text: message, status: "error" });
      await send({ type: "error", message });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  };

  return { ok: true, execute };
}
