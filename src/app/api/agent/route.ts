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

const SYSTEM_PROMPT = `You are MicroManus, a deep research AI agent. You operate in a loop: think about what information you need, call tools, read the results, and decide the next step — repeating until you can give a complete, well-sourced answer.

Tools available:
- web_search: search the web (use several focused queries for research tasks)
- fetch_url: read a promising page in depth
- create_pdf_report: generate a downloadable PDF report artifact

Guidelines:
- For research questions, search first — do not answer purely from memory when current facts matter. Cross-check across multiple sources.
- Cite sources inline with their URLs in your final answer.
- When the user asks for a report or document, do the research first, then call create_pdf_report with a complete, well-structured markdown body (use # headings and bullet lists), then summarize the report in chat and mention the PDF is attached.
- Keep intermediate steps focused; put the substance in the final answer.
- Answer in the language the user writes in.`;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

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

  let apiKey: string;
  try {
    apiKey = decryptSecret(cfg.api_key_encrypted);
  } catch {
    return Response.json({ error: "key_decrypt_failed" }, { status: 500 });
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
  // then persisted turns, then the new user message.
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of history ?? []) {
    const text = (m.content as { text?: string })?.text ?? "";
    if (!text) continue;
    if (m.role === "user") messages.push({ role: "user", content: text });
    else if (m.role === "assistant") messages.push({ role: "assistant", content: text });
  }
  messages.push({ role: "user", content: userText });

  const totals = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  const steps: Array<{ tool: string; args: unknown; summary: string }> = [];
  const artifacts: Array<{ id: string; filename: string; url: string }> = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: Record<string, unknown>) => {
        try {
          controller.enqueue(sseEncode(e));
        } catch {
          /* client disconnected */
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

      let finalText = "";
      try {
        send({ type: "status", text: "Thinking…" });

        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const completion = await client.chat.completions.create({
            model,
            messages,
            tools: TOOL_DEFINITIONS,
            tool_choice: "auto",
          });

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

        // persist assistant turn + usage/cost
        const cost = computeCost(model, totals);
        await admin.from("messages").insert({
          chat_id: chatId,
          user_id: user.id,
          role: "assistant",
          content: { text: finalText, steps, artifacts },
        });
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
        const message = err instanceof Error ? err.message : "Agent failed";
        // refund the credit on hard failure before any answer was produced
        if (!finalText) {
          await admin.rpc("consume_credit", { p_user_id: user.id, p_amount: -1 });
        }
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
