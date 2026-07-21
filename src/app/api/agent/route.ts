import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { computeCost } from "@/lib/models";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/agent/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITERATIONS = 12;
const HISTORY_LIMIT = 40;

const SYSTEM_PROMPT = `You are MicroManus, a deep research AI agent. You run a tool-calling loop inspired by open deep-research agents: plan → search → read → reflect (think) → answer/report.

Tools:
- web_search: find sources (several focused queries)
- fetch_url: read a promising page in depth
- image_search: Wikimedia Commons free images with direct embeddable URLs (when the user wants images)
- think: reflection only — after search/read, assess findings and plan the next step (do not call in parallel with other tools)
- create_pdf_report: write a downloadable PDF report

Research method (think like a human researcher with limited time):
1. Read the question carefully — what specific information is needed?
2. Start broader, then narrow: multiple focused web_search queries (vary wording). Prefer 2–4 searches for non-trivial questions.
3. After each search (or batch of reads), call think: What key facts did I find? What's missing? Enough to answer, or search more?
4. fetch_url the most credible pages (primary sources, official docs, reputable outlets). Prefer 2–3 solid sources over many shallow ones.
5. Stop when you can answer confidently — do not keep searching for perfection. If the last two searches returned similar info, stop.
6. Synthesize in your own words. Do not stitch quotes. Prefer concrete facts, numbers, dates, names.

Temporal grounding (critical — do not invent "now"):
- A following system message states the true current UTC date. Treat that as authoritative "today".
- For "latest / now / going on / currently / recent" questions: search with the current year (or no year), plus terms like "latest" or the current month/year. Prefer sources from the last 30–90 days when possible.
- Never default-append an older year than the current year from the date context unless the user asked about that year or a specific historical event.
- If search results are clearly older than the topic requires, run another search with the current year before answering.
- State an as-of date in the answer when covering current events (using the current year/month from the date context). Never frame "now" using a year earlier than today.

Hard limits (prevent endless loops):
- Simple questions: 2–3 search calls max
- Complex research / PDF reports: aim ≤ 6 web_search calls and ≤ 4 fetch_url calls before writing the answer
- Always leave room for create_pdf_report when a report was requested

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

/** Dynamic temporal context — kept out of the static SYSTEM_PROMPT so the
 *  main prompt stays a cache-friendly stable prefix. Regenerated every request. */
function temporalContextMessage(): string {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
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

function sseEncode(event: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const chatId: string | undefined = body?.chatId;
  const userText: string | undefined = body?.message?.trim();
  if (!chatId || !userText) {
    return Response.json({ error: "chatId and message are required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // ownership check
  const { data: chat } = await admin
    .from("chats")
    .select("id, user_id, model, title")
    .eq("id", chatId)
    .single();
  if (!chat || chat.user_id !== user.id) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  // paywall + credits
  const { data: profile } = await admin
    .from("profiles")
    .select("credits, paywall_passed")
    .eq("id", user.id)
    .single();
  if (!profile?.paywall_passed) {
    return Response.json({ error: "paywall", message: "Unlock MicroManus first." }, { status: 402 });
  }

  // API config
  const { data: cfg } = await admin
    .from("api_configs")
    .select("base_url, api_key_encrypted, default_model")
    .eq("user_id", user.id)
    .single();
  if (!cfg) {
    return Response.json(
      { error: "no_api_key", message: "Add your API key in Settings first." },
      { status: 428 }
    );
  }

  // decrypt + validate the key BEFORE charging a credit, so a bad key never
  // costs the user a run.
  let apiKey: string;
  try {
    apiKey = decryptSecret(cfg.api_key_encrypted);
  } catch {
    return Response.json({ error: "key_decrypt_failed" }, { status: 500 });
  }
  // API keys go into an Authorization header (printable ASCII only). A non-ASCII
  // value (e.g. a prompt pasted into the key field) would otherwise crash the
  // request with a cryptic ByteString error mid-run.
  if (!/^[\x21-\x7E]+$/.test(apiKey)) {
    return Response.json(
      {
        error: "no_api_key",
        message:
          "Your saved API key looks invalid (it contains spaces or non-ASCII characters). Re-enter a valid provider key in Settings.",
      },
      { status: 428 }
    );
  }

  // consume 1 credit per agent run (atomic)
  const { data: remaining, error: creditErr } = await admin.rpc("consume_credit", {
    p_user_id: user.id,
    p_amount: 1,
  });
  if (creditErr || remaining === -1) {
    return Response.json(
      { error: "no_credits", message: "You are out of credits." },
      { status: 402 }
    );
  }

  const model = chat.model || cfg.default_model;
  const client = new OpenAI({ apiKey, baseURL: cfg.base_url });

  // load history and persist the new user message
  const { data: history } = await admin
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  await admin.from("messages").insert({
    chat_id: chatId,
    user_id: user.id,
    role: "user",
    content: { text: userText },
  });

  // set title on first message
  if ((history?.length ?? 0) === 0) {
    await admin
      .from("chats")
      .update({ title: userText.slice(0, 60), updated_at: new Date().toISOString() })
      .eq("id", chatId);
  } else {
    await admin.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  }

  // Build conversation. Stable system prompt first (cache-friendly prefix),
  // then dynamic "today" context, then persisted turns, then the new user message.
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: temporalContextMessage() },
  ];
  for (const m of history ?? []) {
    const c = m.content as { text?: string; status?: string };
    // skip in-flight progress rows (empty text / running) — not model turns
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

  // Progress row so a user who closes the tab can reopen the chat and still see
  // live steps until the run finishes (server keeps working either way).
  const { data: progressRow } = await admin
    .from("messages")
    .insert({
      chat_id: chatId,
      user_id: user.id,
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: Record<string, unknown>) => {
        try {
          controller.enqueue(sseEncode(e));
        } catch {
          /* client disconnected — run continues, progress is in DB */
        }
      };
      // heartbeat: keep Heroku's 55s idle window open during long LLM calls
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Call the model, retrying on transient rate limits (429) / overload (503)
      // with exponential backoff. Free-tier providers (e.g. Gemini) throttle by
      // requests-per-minute, and one agent run makes many sequential calls.
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
              send({
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
        send({ type: "status", text: "Thinking…" });
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
            if (msg.content) send({ type: "thought", text: msg.content });

            for (const tc of msg.tool_calls) {
              if (tc.type !== "function") continue;
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.function.arguments || "{}");
              } catch {
                /* leave empty */
              }
              send({ type: "tool_call", tool: tc.function.name, args });

              const outcome = await executeTool(tc.function.name, args, {
                userId: user.id,
                chatId,
              });
              if (outcome.artifact) {
                artifacts.push(outcome.artifact);
                send({ type: "artifact", artifact: outcome.artifact });
              }
              const summary =
                outcome.result.length > 200
                  ? outcome.result.slice(0, 200) + "…"
                  : outcome.result;
              steps.push({ tool: tc.function.name, args, summary });
              send({ type: "tool_result", tool: tc.function.name, summary });
              await persistProgress({ status: "running" });

              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: outcome.result,
              });
            }
            continue; // loop again: think → act → observe
          }

          finalText = msg.content ?? "";
          break;
        }

        if (!finalText) {
          finalText =
            "I ran out of research steps before finishing. Here is what I gathered so far — please ask me to continue.";
        }

        // finalize progress row + usage/cost
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
            user_id: user.id,
            role: "assistant",
            content: { text: finalText, steps, artifacts, status: "done" },
          });
        }
        await admin.from("usage_events").insert({
          user_id: user.id,
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

        send({
          type: "done",
          text: finalText,
          artifacts,
          usage: totals,
          cost,
          creditsRemaining: remaining,
        });
      } catch (err) {
        const status = (err as { status?: number })?.status;
        let message = err instanceof Error ? err.message : "Agent failed";
        // provider errors come through as bodyless "NNN status code" — translate
        // the common ones into something actionable.
        if (status === 429) {
          message =
            "The model provider rate-limited this request (free-tier requests-per-minute limit). Wait a minute and try again, or switch to a model/provider with higher limits.";
        } else if (status === 404) {
          message = `Model "${model}" wasn't found at this endpoint — it may be deprecated or misspelled. Pick a current model in Settings.`;
        } else if (status === 401 || status === 403) {
          message =
            "The provider rejected your API key (401/403). Re-check the key and base URL in Settings.";
        }
        // refund the credit on hard failure before any answer was produced
        if (!finalText) {
          await admin.rpc("consume_credit", { p_user_id: user.id, p_amount: -1 });
        }
        await persistProgress({ text: message, status: "error" });
        send({ type: "error", message });
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
