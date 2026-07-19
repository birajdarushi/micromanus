import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ChatStats {
  chatId: string | null;
  title: string;
  model: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costInput: number;
  costOutput: number;
  costCached: number;
  costTotal: number;
  lastActivity: string;
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: events, error }, { data: chats }] = await Promise.all([
    supabase
      .from("usage_events")
      .select(
        "chat_id, model, input_tokens, output_tokens, cached_tokens, cost_input_usd, cost_output_usd, cost_cached_usd, cost_total_usd, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("chats").select("id, title"),
  ]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const titles = new Map((chats ?? []).map((c) => [c.id, c.title]));
  const byChat = new Map<string, ChatStats>();

  for (const e of events ?? []) {
    const key = e.chat_id ?? "deleted";
    let s = byChat.get(key);
    if (!s) {
      s = {
        chatId: e.chat_id,
        title: e.chat_id ? titles.get(e.chat_id) ?? "Deleted chat" : "Deleted chat",
        model: e.model,
        runs: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        costInput: 0,
        costOutput: 0,
        costCached: 0,
        costTotal: 0,
        lastActivity: e.created_at,
      };
      byChat.set(key, s);
    }
    s.runs += 1;
    s.inputTokens += e.input_tokens;
    s.outputTokens += e.output_tokens;
    s.cachedTokens += e.cached_tokens;
    s.costInput += Number(e.cost_input_usd);
    s.costOutput += Number(e.cost_output_usd);
    s.costCached += Number(e.cost_cached_usd);
    s.costTotal += Number(e.cost_total_usd);
    if (e.created_at > s.lastActivity) s.lastActivity = e.created_at;
  }

  const chatStats = [...byChat.values()].sort((a, b) =>
    b.lastActivity.localeCompare(a.lastActivity)
  );
  const totals = chatStats.reduce(
    (acc, s) => ({
      runs: acc.runs + s.runs,
      inputTokens: acc.inputTokens + s.inputTokens,
      outputTokens: acc.outputTokens + s.outputTokens,
      cachedTokens: acc.cachedTokens + s.cachedTokens,
      costTotal: acc.costTotal + s.costTotal,
    }),
    { runs: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, costTotal: 0 }
  );

  return Response.json({ chats: chatStats, totals });
}
