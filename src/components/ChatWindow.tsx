"use client";

import { useEffect, useRef, useState } from "react";

interface Artifact {
  id: string;
  filename: string;
  url: string;
}

interface Step {
  tool: string;
  args?: Record<string, unknown>;
  summary?: string;
  status: "running" | "done";
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: Step[];
  artifacts?: Artifact[];
}

interface AgentEvent {
  type: string;
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  summary?: string;
  artifact?: Artifact;
  artifacts?: Artifact[];
  message?: string;
  creditsRemaining?: number;
  cost?: { costTotal: number };
}

function stepLabel(s: Step): string {
  if (s.tool === "web_search") return `Searching: “${s.args?.query ?? ""}”`;
  if (s.tool === "fetch_url") return `Reading: ${s.args?.url ?? ""}`;
  if (s.tool === "create_pdf_report") return `Writing PDF report: ${s.args?.title ?? ""}`;
  return s.tool;
}

// minimal markdown renderer: paragraphs, headings, bullets, links, bold, code
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flushList = () => {
    if (list.length) {
      out.push(
        <ul key={out.length} className="list-disc pl-5 space-y-1 my-2">
          {list}
        </ul>
      );
      list = [];
    }
  };
  const inline = (s: string, key: number) => {
    const parts: React.ReactNode[] = [];
    // links first, then bold/code inside remaining text
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)<>\]]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    const pushText = (t: string) => {
      const segs = t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
      for (const seg of segs) {
        if (seg.startsWith("**") && seg.endsWith("**"))
          parts.push(<strong key={`${key}-${i++}`}>{seg.slice(2, -2)}</strong>);
        else if (seg.startsWith("`") && seg.endsWith("`"))
          parts.push(
            <code key={`${key}-${i++}`} className="bg-zinc-800 rounded px-1 text-[0.85em]">
              {seg.slice(1, -1)}
            </code>
          );
        else parts.push(seg);
      }
    };
    while ((m = linkRe.exec(s))) {
      pushText(s.slice(last, m.index));
      const href = m[2] ?? m[3];
      const label = m[1] ?? m[3];
      parts.push(
        <a
          key={`${key}-${i++}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 hover:underline break-all"
        >
          {label}
        </a>
      );
      last = m.index + m[0].length;
    }
    pushText(s.slice(last));
    return parts;
  };

  lines.forEach((line, idx) => {
    if (/^\s*[-*] /.test(line)) {
      list.push(<li key={idx}>{inline(line.replace(/^\s*[-*] /, ""), idx)}</li>);
      return;
    }
    flushList();
    if (line.startsWith("### "))
      out.push(<h4 key={idx} className="font-semibold mt-3 mb-1">{inline(line.slice(4), idx)}</h4>);
    else if (line.startsWith("## "))
      out.push(<h3 key={idx} className="font-semibold text-lg mt-4 mb-1">{inline(line.slice(3), idx)}</h3>);
    else if (line.startsWith("# "))
      out.push(<h2 key={idx} className="font-semibold text-xl mt-4 mb-1">{inline(line.slice(2), idx)}</h2>);
    else if (line.trim())
      out.push(<p key={idx} className="my-1.5 leading-relaxed">{inline(line, idx)}</p>);
  });
  flushList();
  return out;
}

export default function ChatWindow({ chatId }: { chatId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<Step[]>([]);
  const [liveArtifacts, setLiveArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chats/${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        setModel(d.chat?.model ?? "");
        setMessages(
          (d.messages ?? [])
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { id: string; role: "user" | "assistant"; content: { text?: string; steps?: Step[]; artifacts?: Artifact[] } }) => ({
              id: m.id,
              role: m.role,
              text: m.content?.text ?? "",
              steps: m.content?.steps?.map((s) => ({ ...s, status: "done" as const })),
              artifacts: m.content?.artifacts,
            }))
        );
      })
      .catch(() => {});
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveSteps, status]);

  async function send() {
    const text = input.trim();
    if (!text || running) return;
    setInput("");
    setError(null);
    setRunning(true);
    setStatus("Starting agent…");
    setLiveSteps([]);
    setLiveArtifacts([]);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "no_credits" || data.error === "paywall") {
          throw new Error("You're out of credits — visit the paywall to top up.");
        }
        if (data.error === "no_api_key") {
          throw new Error("Add your API key in Settings first.");
        }
        throw new Error(data.message ?? data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const steps: Step[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let ev: AgentEvent;
          try {
            ev = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (ev.type === "status") setStatus(ev.text ?? null);
          else if (ev.type === "thought") setStatus(ev.text ?? null);
          else if (ev.type === "tool_call") {
            const step: Step = { tool: ev.tool ?? "", args: ev.args, status: "running" };
            steps.push(step);
            setLiveSteps([...steps]);
            setStatus(null);
          } else if (ev.type === "tool_result") {
            const s = [...steps].reverse().find((x) => x.tool === ev.tool && x.status === "running");
            if (s) {
              s.status = "done";
              s.summary = ev.summary;
            }
            setLiveSteps([...steps]);
          } else if (ev.type === "artifact" && ev.artifact) {
            setLiveArtifacts((a) => [...a, ev.artifact!]);
          } else if (ev.type === "done") {
            setMessages((m) => [
              ...m,
              {
                id: `a-${Date.now()}`,
                role: "assistant",
                text: ev.text ?? "",
                steps: steps.map((s) => ({ ...s, status: "done" as const })),
                artifacts: ev.artifacts,
              },
            ]);
            setLiveSteps([]);
            setLiveArtifacts([]);
            setStatus(null);
            window.dispatchEvent(new Event("mm:refresh"));
          } else if (ev.type === "error") {
            throw new Error(ev.message ?? "Agent failed");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus(null);
      setLiveSteps([]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0 pl-14 md:pl-6">
        <div className="text-sm text-zinc-400 truncate">
          {messages[0]?.text?.slice(0, 70) || "New research"}
        </div>
        {model && (
          <span className="text-xs rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-zinc-300 shrink-0">
            {model}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && !running && (
            <div className="text-center text-zinc-500 mt-20">
              <div className="text-3xl mb-3">🔬</div>
              <p className="text-sm">
                Ask a research question. Try:{" "}
                <em>
                  “Create a report explaining the recent forest fires in California —
                  causes and prevention.”
                </em>
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div className="max-w-[95%]">
                  {m.steps && m.steps.length > 0 && (
                    <details className="mb-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs">
                      <summary className="cursor-pointer px-3 py-2 text-zinc-400">
                        🛠 {m.steps.length} research step{m.steps.length > 1 ? "s" : ""}
                      </summary>
                      <div className="px-3 pb-2 space-y-1.5">
                        {m.steps.map((s, i) => (
                          <div key={i} className="text-zinc-500">
                            <span className="text-zinc-300">{stepLabel(s)}</span>
                            {s.summary && <div className="pl-3 mt-0.5 line-clamp-2">{s.summary}</div>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="rounded-2xl rounded-bl-sm bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm">
                    {renderMarkdown(m.text)}
                    {m.artifacts?.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/70 px-3 py-2 hover:bg-zinc-800 transition text-indigo-300"
                      >
                        📄 <span className="truncate">{a.filename}</span>
                        <span className="ml-auto text-xs text-zinc-500">Download PDF</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {(running || liveSteps.length > 0) && (
            <div className="max-w-[95%]">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm space-y-2">
                {liveSteps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-zinc-400 text-xs">
                    <span>{s.status === "running" ? "⏳" : "✅"}</span>
                    <div>
                      <div className="text-zinc-300">{stepLabel(s)}</div>
                      {s.summary && <div className="text-zinc-500 line-clamp-2">{s.summary}</div>}
                    </div>
                  </div>
                ))}
                {liveArtifacts.map((a) => (
                  <div key={a.id} className="text-xs text-indigo-300">📄 {a.filename} ready</div>
                ))}
                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                  <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                  {status ?? "Working…"}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 text-red-300 px-4 py-2.5 text-sm">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-zinc-800 p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={running ? "Agent is researching…" : "Ask a deep research question…"}
            disabled={running}
            className="flex-1 resize-none rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={running || !input.trim()}
            className="rounded-xl bg-indigo-500 hover:bg-indigo-400 transition px-5 text-sm font-medium disabled:opacity-50"
          >
            {running ? "…" : "Send"}
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-[11px] text-zinc-600">
          Each message uses 1 credit and runs a full research loop (search → read → reason → report).
        </p>
      </div>
    </div>
  );
}
