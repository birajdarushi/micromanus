"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  BookOpen,
  FileText,
  Wrench,
  Check,
  Loader2,
  Send,
  Cpu,
  ArrowDownToLine,
  ChevronRight,
  Brain,
  Link2 as LinkIcon,
  ChevronDown,
} from "lucide-react";
import Mascot, { type MascotState } from "@/components/Mascot";

interface ModelOption {
  id: string;
  label: string;
  provider: string;
}

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

const stepIcon: Record<string, typeof Search> = {
  web_search: Search,
  fetch_url: BookOpen,
  create_pdf_report: FileText,
};

const stepMascot: Record<string, MascotState> = {
  web_search: "search",
  fetch_url: "reading",
  create_pdf_report: "writing",
};

function stepLabel(s: Step): string {
  if (s.tool === "web_search") return `Searching “${s.args?.query ?? ""}”`;
  if (s.tool === "fetch_url") return `Reading ${s.args?.url ?? ""}`;
  if (s.tool === "create_pdf_report") return `Writing PDF report: ${s.args?.title ?? ""}`;
  return s.tool;
}

// The signature AgentThinkingLoop — a vertical timeline of Think → Tool → Observe.
// Collapsible so it doesn't take over the page: a compact chip that expands.
function ThinkingLoop({ steps, defaultOpen = false }: { steps: Step[]; defaultOpen?: boolean }) {
  const running = steps.some((s) => s.status === "running");
  const [open, setOpen] = useState(defaultOpen || running);
  if (!steps.length) return null;
  const summary = running
    ? "Researching…"
    : `Researched · ${steps.length} step${steps.length > 1 ? "s" : ""}`;
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="thinking-toggle"
        className="flex items-center gap-2 w-fit rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-mono text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
      >
        <Brain size={13} strokeWidth={1.5} className={running ? "text-amber-400" : "text-zinc-500"} />
        {summary}
        <ChevronRight
          size={13}
          strokeWidth={1.5}
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-4 mt-2 flex flex-col gap-3 border-l-2 border-zinc-800 pl-4 py-2 font-mono text-sm">
          {steps.map((s, i) => {
        const Icon = stepIcon[s.tool] ?? Wrench;
        const running = s.status === "running";
        return (
          <div
            key={i}
            className={`relative ${
              running
                ? "before:content-[''] before:absolute before:-left-[25px] before:top-1 before:w-4 before:h-4 before:bg-amber-400/20 before:rounded-full before:animate-ping"
                : ""
            }`}
          >
            <span
              className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full ${
                running ? "bg-amber-400" : "bg-zinc-700"
              }`}
            />
            <div className="flex items-center gap-2">
              <Icon
                size={14}
                strokeWidth={1.5}
                className={running ? "text-amber-400" : "text-zinc-500"}
              />
              <span className={running ? "text-zinc-200" : "text-zinc-400"}>
                {stepLabel(s)}
              </span>
              {running ? (
                <Loader2 size={13} strokeWidth={1.5} className="text-amber-400 animate-spin" />
              ) : (
                <Check size={13} strokeWidth={2} className="text-emerald-500" />
              )}
            </div>
            {s.summary && (
              <details className="mt-1 group">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400 select-none">
                  observation
                </summary>
                <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 whitespace-pre-wrap">
                  {s.summary}
                </div>
              </details>
            )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Collect every source URL the agent touched — read URLs, links in observations,
// and links in the final answer — for the Sources card (Perplexity-style).
function collectSources(steps: Step[] | undefined, text: string): string[] {
  const urls = new Set<string>();
  const urlRe = /https?:\/\/[^\s)<>\]"']+/g;
  (steps ?? []).forEach((s) => {
    if (s.tool === "fetch_url" && typeof s.args?.url === "string") urls.add(s.args.url);
    s.summary?.match(urlRe)?.forEach((u) => urls.add(u.replace(/[.,]+$/, "")));
  });
  text.match(urlRe)?.forEach((u) => urls.add(u.replace(/[.,]+$/, "")));
  return [...urls].slice(0, 24);
}

function hostname(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function SourcesCard({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50" data-testid="sources-card">
      <summary className="flex items-center gap-2 cursor-pointer select-none px-4 py-2.5 text-sm text-zinc-300 hover:text-zinc-100">
        <LinkIcon size={14} strokeWidth={1.5} className="text-amber-400" />
        Sources <span className="font-mono text-xs text-zinc-500">({urls.length})</span>
      </summary>
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {urls.map((u, i) => (
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs hover:text-amber-400 transition-colors group"
          >
            <span className="font-mono text-zinc-600 w-5 shrink-0">{i + 1}.</span>
            <span className="text-zinc-300 shrink-0 group-hover:text-amber-400">{hostname(u)}</span>
            <span className="truncate text-zinc-500">{u}</span>
          </a>
        ))}
      </div>
    </details>
  );
}

function ArtifactCardPDF({ artifact }: { artifact: Artifact }) {
  return (
    <div
      data-testid="artifact-card"
      className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-zinc-100 text-zinc-950 p-4 shadow-lg max-w-sm"
    >
      <span className="flex items-center gap-3 min-w-0">
        <FileText size={22} strokeWidth={1.5} className="text-orange-600 shrink-0" />
        <span className="truncate text-sm font-medium">{artifact.filename}</span>
      </span>
      <a
        href={artifact.url}
        target="_blank"
        rel="noreferrer"
        download
        data-testid="artifact-download"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-zinc-50 px-3 py-1.5 text-xs font-medium hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
      >
        <ArrowDownToLine size={14} strokeWidth={1.5} />
        Download
      </a>
    </div>
  );
}

// minimal markdown renderer: paragraphs, headings, bullets, links, bold, code, tables
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let k = 0; // single monotonic key source — avoids duplicate-key collisions
  let list: React.ReactNode[] = [];
  const flushList = () => {
    if (list.length) {
      out.push(
        <ul key={`k${k++}`} className="list-disc pl-5 space-y-1 my-2">
          {list}
        </ul>
      );
      list = [];
    }
  };
  const isTableSep = (l: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const splitRow = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const inline = (s: string, key: number) => {
    const parts: React.ReactNode[] = [];
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)<>\]]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    const pushText = (t: string) => {
      // order matters: **bold** before *italic* so ** isn't eaten as two *
      const segs = t.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).filter(Boolean);
      for (const seg of segs) {
        if (seg.startsWith("**") && seg.endsWith("**"))
          parts.push(<strong key={`${key}-${i++}`}>{seg.slice(2, -2)}</strong>);
        else if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2)
          parts.push(<em key={`${key}-${i++}`}>{seg.slice(1, -1)}</em>);
        else if (seg.startsWith("`") && seg.endsWith("`"))
          parts.push(
            <code
              key={`${key}-${i++}`}
              className="font-mono bg-zinc-800 rounded px-1 text-[0.85em]"
            >
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
          className="text-amber-400 hover:underline break-all"
        >
          {label}
        </a>
      );
      last = m.index + m[0].length;
    }
    pushText(s.slice(last));
    return parts;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // GFM table: header row, then a separator row, then body rows
    if (line.includes("|") && idx + 1 < lines.length && isTableSep(lines[idx + 1])) {
      flushList();
      const header = splitRow(line);
      const rows: string[][] = [];
      idx += 2;
      while (idx < lines.length && lines[idx].includes("|") && lines[idx].trim()) {
        rows.push(splitRow(lines[idx]));
        idx++;
      }
      idx--; // the for-loop will increment
      const tk = k++;
      out.push(
        <div key={`k${tk}`} className="my-3 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-900 text-left">
                {header.map((h, ci) => (
                  <th key={ci} className="px-3 py-2 font-medium border-b border-zinc-800 whitespace-nowrap">
                    {inline(h, tk * 1000 + ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-zinc-800/60 last:border-0">
                  {header.map((_, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      {inline(r[ci] ?? "", tk * 1000 + (ri + 1) * 50 + ci)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*[-*] /.test(line)) {
      list.push(<li key={`k${k++}`}>{inline(line.replace(/^\s*[-*] /, ""), idx)}</li>);
      continue;
    }
    flushList();
    if (line.startsWith("### "))
      out.push(
        <h4 key={`k${k++}`} className="font-heading font-medium mt-3 mb-1">
          {inline(line.slice(4), idx)}
        </h4>
      );
    else if (line.startsWith("## "))
      out.push(
        <h3 key={`k${k++}`} className="font-heading font-medium text-lg mt-4 mb-1 tracking-tight">
          {inline(line.slice(3), idx)}
        </h3>
      );
    else if (line.startsWith("# "))
      out.push(
        <h2 key={`k${k++}`} className="font-heading font-medium text-xl mt-4 mb-1 tracking-tight">
          {inline(line.slice(2), idx)}
        </h2>
      );
    else if (line.trim())
      out.push(
        <p key={`k${k++}`} className="my-1.5 leading-relaxed">
          {inline(line, idx)}
        </p>
      );
  }
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
  const [models, setModels] = useState<ModelOption[]>([]);
  const [savingModel, setSavingModel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []))
      .catch(() => {});
  }, []);

  async function changeModel(next: string) {
    if (!next || next === model || savingModel) return;
    const prev = model;
    setModel(next); // optimistic
    setSavingModel(true);
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: next }),
      });
      if (!res.ok) throw new Error("Failed to update model");
      toast.success(`Model set to ${next}`);
      window.dispatchEvent(new Event("mm:refresh"));
    } catch {
      setModel(prev); // revert
      toast.error("Couldn't change the model. Try again.");
    } finally {
      setSavingModel(false);
    }
  }

  useEffect(() => {
    fetch(`/api/chats/${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        setModel(d.chat?.model ?? "");
        setMessages(
          (d.messages ?? [])
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map(
              (m: {
                id: string;
                role: "user" | "assistant";
                content: { text?: string; steps?: Step[]; artifacts?: Artifact[] };
              }) => ({
                id: m.id,
                role: m.role,
                text: m.content?.text ?? "",
                steps: m.content?.steps?.map((s) => ({ ...s, status: "done" as const })),
                artifacts: m.content?.artifacts,
              })
            )
        );
      })
      .catch(() => {});
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveSteps, status]);

  // pick a mascot state for the live indicator based on the current step
  const activeStep = [...liveSteps].reverse().find((s) => s.status === "running");
  const liveMascot: MascotState = activeStep
    ? stepMascot[activeStep.tool] ?? "thinking"
    : "thinking";

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
      // keep the sidebar credit count accurate even on failure (credit refunded)
      window.dispatchEvent(new Event("mm:refresh"));
    } finally {
      setRunning(false);
    }
  }

  const isEmpty = messages.length === 0 && !running;

  const composerBox = (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/20 transition-colors">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={2}
        placeholder={running ? "Agent is researching…" : "Ask a deep research question…"}
        disabled={running}
        data-testid="chat-input"
        className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between px-2.5 pb-2.5 pt-0.5">
        {/* model picker inside the composer (Perplexity-style) */}
        <label className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer focus-within:ring-1 focus-within:ring-amber-400 max-w-[60%]">
          {savingModel ? (
            <Loader2 size={13} strokeWidth={1.5} className="text-amber-400 animate-spin shrink-0" />
          ) : (
            <Cpu size={13} strokeWidth={1.5} className="text-amber-400 shrink-0" />
          )}
          <select
            value={model}
            onChange={(e) => changeModel(e.target.value)}
            disabled={savingModel || running}
            data-testid="chat-model-select"
            aria-label="Model for this chat"
            className="bg-transparent text-zinc-300 font-mono text-xs focus:outline-none cursor-pointer disabled:opacity-60 truncate [&>option]:bg-zinc-900 [&>option]:text-zinc-200"
          >
            {model && !models.some((m) => m.id === model) && (
              <option value={model}>{model} (custom)</option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} strokeWidth={1.5} className="text-zinc-500 shrink-0" />
        </label>

        <button
          onClick={send}
          disabled={running || !input.trim()}
          data-testid="send-btn"
          aria-label="Send message"
          className="flex items-center justify-center rounded-xl bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors h-9 w-9 font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
        >
          {running ? (
            <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Send size={18} strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center px-4 pl-14 md:pl-4 shrink-0 sticky top-0 z-10">
        <div className="text-sm text-zinc-400 truncate">
          {messages[0]?.text?.slice(0, 70) || "New research"}
        </div>
      </header>

      {isEmpty ? (
        /* Empty state: centered composer (Perplexity/Claude new-chat look) */
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-2xl flex flex-col items-center text-center animate-in fade-in duration-300">
            <Mascot state="idle" size={84} className="mb-4" />
            <h1 className="font-heading text-2xl md:text-3xl font-medium tracking-tight text-zinc-50">
              What do you want to research?
            </h1>
            <p className="text-zinc-500 text-sm mt-2 mb-6">
              Ask anything. MicroManus searches the web, reads sources, and can write a PDF report.
            </p>
            <div className="w-full">{composerBox}</div>
            <p className="mt-3 font-mono text-[11px] text-zinc-600">
              Each message uses 1 credit · search → read → reason → report.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
            <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
              {messages.map((m) => (
                <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {m.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-zinc-800 text-zinc-100 px-5 py-3 text-sm whitespace-pre-wrap">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="shrink-0 pt-0.5">
                        <Mascot state="idle" size={30} />
                      </div>
                      <div className="min-w-0 flex-1 bg-transparent text-zinc-100">
                        {m.steps && m.steps.length > 0 && <ThinkingLoop steps={m.steps} />}
                        <div className="text-sm mt-1">
                          {renderMarkdown(m.text)}
                          {m.artifacts?.map((a) => (
                            <ArtifactCardPDF key={a.id} artifact={a} />
                          ))}
                          <SourcesCard urls={collectSources(m.steps, m.text)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(running || liveSteps.length > 0) && (
                <div className="flex gap-3 animate-in fade-in duration-300">
                  <div className="shrink-0 pt-0.5">
                    <Mascot state={liveMascot} size={30} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-mono text-xs text-zinc-500 mb-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      {status ?? "Working…"}
                    </span>
                    <ThinkingLoop steps={liveSteps} defaultOpen />
                    {liveArtifacts.map((a) => (
                      <div key={a.id} className="ml-4 mt-2 flex items-center gap-2 font-mono text-xs text-amber-400">
                        <FileText size={13} strokeWidth={1.5} />
                        {a.filename} ready
                      </div>
                    ))}
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
            <div className="max-w-4xl mx-auto">{composerBox}</div>
            <p className="max-w-4xl mx-auto mt-2 font-mono text-[11px] text-zinc-600">
              Each message uses 1 credit and runs a full research loop (search → read → reason →
              report).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
