"use client";

import { useEffect, useState } from "react";
import Mascot from "@/components/Mascot";

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

interface Totals {
  runs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costTotal: number;
}

const nf = new Intl.NumberFormat("en-US");
function tokens(n: number) {
  return nf.format(n);
}
function usd(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-2 hover:-translate-y-1 transition-transform duration-200">
      <div className="font-sans text-xs text-zinc-400 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-3xl font-light tracking-tight text-zinc-50">{value}</div>
      {sub && <div className="font-mono text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function UsageInner() {
  const [chats, setChats] = useState<ChatStats[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed to load usage");
        return d;
      })
      .then((d) => {
        setChats(d.chats ?? []);
        setTotals(d.totals ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load usage"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-10 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 pr-32">
          <Mascot state="stats" size={44} />
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-2xl font-medium tracking-tight text-zinc-50">
              Cost &amp; stats
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Token usage and cost per chat, split by input, output, and cached tokens.
            </p>
          </div>
        </div>

        {loading && <p className="mt-8 font-mono text-sm text-zinc-500">Loading usage…</p>}
        {error && <p className="mt-8 font-mono text-sm text-red-500">{error}</p>}

        {!loading && !error && totals && (
          <>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <StatCard
                label="Total cost"
                value={usd(totals.costTotal)}
                sub={`${totals.runs} run${totals.runs === 1 ? "" : "s"} · 1 credit each`}
              />
              <StatCard label="Input tokens" value={tokens(totals.inputTokens)} />
              <StatCard label="Output tokens" value={tokens(totals.outputTokens)} />
              <StatCard
                label="Cached tokens"
                value={tokens(totals.cachedTokens)}
                sub="billed at cache rate"
              />
            </div>

            {chats.length === 0 ? (
              <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-10 text-center font-mono text-sm text-zinc-500">
                No usage yet. Start a chat and run the agent to see cost and token stats here.
              </div>
            ) : (
              <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900 text-left font-mono text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3 font-medium">Chat</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-3 py-3 font-medium text-right">Runs</th>
                      <th className="px-3 py-3 font-medium text-right">Input</th>
                      <th className="px-3 py-3 font-medium text-right">Output</th>
                      <th className="px-3 py-3 font-medium text-right">Cached</th>
                      <th className="px-3 py-3 font-medium text-right">In $</th>
                      <th className="px-3 py-3 font-medium text-right">Out $</th>
                      <th className="px-3 py-3 font-medium text-right">Cache $</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {chats.map((c) => (
                      <tr key={c.chatId ?? "deleted"} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                        <td className="px-4 py-3 max-w-[16rem] truncate text-zinc-200" title={c.title}>
                          {c.title}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">{c.model}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-400">{tokens(c.runs)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">{tokens(c.inputTokens)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">{tokens(c.outputTokens)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-400">{tokens(c.cachedTokens)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-500">{usd(c.costInput)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-500">{usd(c.costOutput)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-500">{usd(c.costCached)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-amber-400">{usd(c.costTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-800 bg-zinc-900 font-medium">
                      <td className="px-4 py-3 text-zinc-300" colSpan={2}>
                        All chats
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">{tokens(totals.runs)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">{tokens(totals.inputTokens)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">{tokens(totals.outputTokens)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">{tokens(totals.cachedTokens)}</td>
                      <td className="px-3 py-3" colSpan={3} />
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">{usd(totals.costTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function UsagePage() {
  return <UsageInner />;
}
