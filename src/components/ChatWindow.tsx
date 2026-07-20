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
  Globe,
  Sparkles,
  TrendingUp,
  GitCompare,
  FileOutput,
  ArrowUpRight,
  Image as ImageIcon,
} from "lucide-react";
import Mascot, { type MascotState } from "@/components/Mascot";
import Dropdown, { type DropdownOption } from "@/components/Dropdown";
import {
  requestNotifyPermission,
  notifyResearchComplete,
  playDoneChime,
} from "@/lib/notify";
import { captureEvent } from "@/components/PostHogProvider";

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
  image_search: ImageIcon,
  think: Brain,
  create_pdf_report: FileText,
};

// Empty-state starter prompts (prefill the composer) and capability chips.
const SUGGESTIONS = [
  { icon: Search, title: "Deep research", sub: "In-depth analysis", prompt: "Do deep research on " },
  { icon: GitCompare, title: "Compare", sub: "Compare topics", prompt: "Compare " },
  { icon: TrendingUp, title: "Market research", sub: "Trends & insights", prompt: "Give me a market analysis of " },
  { icon: FileText, title: "Custom report", sub: "PDF report", prompt: "Write a detailed PDF report on " },
];
const CAPABILITIES = [
  { icon: Globe, title: "Web search", sub: "Real-time results" },
  { icon: BookOpen, title: "Source reading", sub: "Read & understand" },
  { icon: ImageIcon, title: "Image search", sub: "Wikimedia embeds" },
  { icon: FileOutput, title: "Report generation", sub: "PDF export" },
];

const stepMascot: Record<string, MascotState> = {
  web_search: "search",
  fetch_url: "reading",
  image_search: "search",
  think: "thinking",
  create_pdf_report: "writing",
};

function stepLabel(s: Step): string {
  if (s.tool === "web_search") return `Searching “${s.args?.query ?? ""}”`;
  if (s.tool === "fetch_url") return `Reading ${s.args?.url ?? ""}`;
  if (s.tool === "image_search") return `Finding images “${s.args?.query ?? ""}”`;
  if (s.tool === "think") {
    const r = String(s.args?.reflection ?? "");
    return r ? `Reflecting: ${r.slice(0, 80)}${r.length > 80 ? "…" : ""}` : "Reflecting…";
  }
  if (s.tool === "create_pdf_report") return `Writing PDF report: ${s.args?.title ?? ""}`;
  return s.tool;
}

// The signature AgentThinkingLoop — a vertical timeline of Think → Tool → Observe.
// Outer chip collapses the whole loop; each step's observation expands inline
// (click the step row — no modal).
function ThinkingLoop({ steps, defaultOpen = false }: { steps: Step[]; defaultOpen?: boolean }) {
  const anyRunning = steps.some((s) => s.status === "running");
  const [open, setOpen] = useState(defaultOpen || anyRunning);
  // which step observations are expanded (by index)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (defaultOpen || anyRunning) setOpen(true);
  }, [defaultOpen, anyRunning, steps.length]);

  if (!steps.length) return null;
  const summary = anyRunning
    ? "Researching…"
    : `Researched · ${steps.length} step${steps.length > 1 ? "s" : ""}`;

  const toggleObs = (i: number) =>
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="thinking-toggle"
        className="flex items-center gap-2 w-fit rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-mono text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
      >
        <Brain size={13} strokeWidth={1.5} className={anyRunning ? "text-accent-400" : "text-zinc-500"} />
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
            const hasObs = Boolean(s.summary);
            const isOpen = Boolean(expanded[i]);
            const preview = (s.summary ?? "").split("\n").find((l) => l.trim())?.slice(0, 90);
            return (
              <div
                key={i}
                className={`relative ${
                  running
                    ? "before:content-[''] before:absolute before:-left-[25px] before:top-1 before:w-4 before:h-4 before:bg-accent-400/20 before:rounded-full before:animate-ping"
                    : ""
                }`}
              >
                <span
                  className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full ${
                    running ? "bg-accent-400" : "bg-zinc-700"
                  }`}
                />
                <button
                  type="button"
                  disabled={!hasObs}
                  onClick={() => hasObs && toggleObs(i)}
                  onDoubleClick={() => hasObs && toggleObs(i)}
                  data-testid="observation-toggle"
                  className={`w-full text-left rounded-md px-1 -mx-1 py-0.5 transition-colors ${
                    hasObs
                      ? "cursor-pointer hover:bg-zinc-900/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500"
                      : "cursor-default"
                  }`}
                  aria-expanded={hasObs ? isOpen : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      className={running ? "text-accent-400 shrink-0" : "text-zinc-500 shrink-0"}
                    />
                    <span
                      className={`truncate ${running ? "text-zinc-200" : "text-zinc-400"}`}
                    >
                      {stepLabel(s)}
                    </span>
                    {running ? (
                      <Loader2
                        size={13}
                        strokeWidth={1.5}
                        className="text-accent-400 animate-spin shrink-0"
                      />
                    ) : (
                      <Check size={13} strokeWidth={2} className="text-emerald-500 shrink-0" />
                    )}
                    {hasObs && (
                      <ChevronRight
                        size={13}
                        strokeWidth={1.5}
                        className={`ml-auto shrink-0 text-zinc-600 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    )}
                  </div>
                  {hasObs && !isOpen && preview && (
                    <p className="mt-1 pl-5 text-[11px] text-zinc-600 truncate">{preview}…</p>
                  )}
                </button>
                {hasObs && isOpen && (
                  <div
                    data-testid="observation-body"
                    className="mt-1.5 ml-5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-400 whitespace-pre-wrap break-words max-h-64 overflow-y-auto"
                  >
                    {s.summary}
                  </div>
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
        <LinkIcon size={14} strokeWidth={1.5} className="text-accent-400" />
        Sources <span className="font-mono text-xs text-zinc-500">({urls.length})</span>
      </summary>
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {urls.map((u, i) => (
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs hover:text-accent-400 transition-colors group"
          >
            <span className="font-mono text-zinc-600 w-5 shrink-0">{i + 1}.</span>
            <span className="text-zinc-300 shrink-0 group-hover:text-accent-400">{hostname(u)}</span>
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
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-zinc-50 px-3 py-1.5 text-xs font-medium hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
      >
        <ArrowDownToLine size={14} strokeWidth={1.5} />
        Download
      </a>
    </div>
  );
}

/** Citation chip — fixed baseline (no <sup>/translate mix that jumps up/down). */
function CiteChip({ n }: { n: string }) {
  return (
    <span className="mx-0.5 inline-flex h-[1.1em] min-w-[1.1em] items-center justify-center rounded bg-zinc-800 px-1 align-baseline font-mono text-[0.7em] font-medium leading-none text-accent-400 relative -top-[0.35em]">
      {n}
    </span>
  );
}

/**
 * Normalize messy model markdown before render:
 * - strip emoji / PDF filename spam
 * - close unclosed **bold** on a line (fixes visible stray *)
 * - turn bare trailing refs like "…breakout 2 3." into [2] [3]
 * - space jammed [1][2] → [1] [2]
 */
function cleanAssistantText(text: string): string {
  let t = text;
  t = t.replace(/\p{Extended_Pictographic}/gu, "");
  t = t
    .split("\n")
    .filter((line) => {
      const s = line.trim();
      if (!s) return true;
      if (/^\*{0,2}\s*.+\.pdf\s*\*{0,2}$/i.test(s)) return false;
      if (/downloadable/i.test(s) && /\.pdf/i.test(s)) return false;
      if (/^\(?downloadable\)?\.?$/i.test(s)) return false;
      return true;
    })
    .map((line) => {
      let L = line;
      L = L.replace(/\*{0,2}\s*[A-Za-z0-9._-]+\.pdf\s*\*{0,2}/gi, "");
      L = L.replace(/\(\s*downloadable\s*\)/gi, "");
      L = L.replace(/\*{3,}/g, "**");
      // jam citations → spaced
      L = L.replace(/\]\[(\d+)\]/g, "] [$1]");
      // close unclosed ** on this line (common: **1. Heading without closing)
      const dbl = L.match(/\*\*/g)?.length ?? 0;
      if (dbl % 2 === 1) L = `${L}**`;
      // close unclosed single-asterisk italic (ignore list markers "* ")
      const strippedList = L.replace(/^\s*\* /, "  ");
      // count * that are not part of **
      const singles = strippedList.replace(/\*\*/g, "").match(/\*/g)?.length ?? 0;
      if (singles % 2 === 1 && !/^\s*\* /.test(L)) L = `${L}*`;
      // bare trailing citation numbers: "…cost 3." / "…breakout 2 3."
      // (skip if digit is part of a range like 3–6 or 20–30 or $55)
      L = L.replace(
        /([A-Za-z)\]”"'])\s+(\d{1,2}(?:\s+\d{1,2}){0,4})([.,;:]?)(\s*)$/g,
        (full, pre: string, nums: string, punct: string, trail: string) => {
          // don't rewrite if the line still has a range/currency nearby in the nums blob
          if (/[-–—:$%]/.test(nums)) return full;
          const parts = nums.trim().split(/\s+/);
          if (parts.some((p) => Number(p) < 1 || Number(p) > 40)) return full;
          return `${pre} ${parts.map((p) => `[${p}]`).join(" ")}${punct}${trail}`;
        }
      );
      return L;
    })
    .join("\n");
  t = t.replace(/\(\s*downloadable\s*\)/gi, "");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

// Markdown: paragraphs, headings, bullets, links, bold, italic, code, tables, citations.
function renderMarkdown(raw: string): React.ReactNode {
  const text = cleanAssistantText(raw);
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let k = 0;
  let ul: React.ReactNode[] = [];
  let ol: React.ReactNode[] = [];
  const flushUl = () => {
    if (!ul.length) return;
    out.push(
      <ul key={`k${k++}`} className="list-disc pl-5 space-y-1.5 my-2">
        {ul}
      </ul>
    );
    ul = [];
  };
  const flushOl = () => {
    if (!ol.length) return;
    out.push(
      <ol key={`k${k++}`} className="list-decimal pl-5 space-y-2 my-2">
        {ol}
      </ol>
    );
    ol = [];
  };
  const flushLists = () => {
    flushUl();
    flushOl();
  };
  const isTableSep = (l: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const splitRow = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  const inline = (s: string, key: number): React.ReactNode[] => {
    // Tokenize: code, bold, italic, [n] cites, markdown links, bare URLs
    const re =
      /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(__[^_\n]+?__)|(\*(?!\s)[^*\n]+?\*)|(_(?!\s)[^_\n]+?_)|(\[\d+\])|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)<>\]]+)/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    const pushPlain = (chunk: string) => {
      if (chunk) parts.push(chunk);
    };
    while ((m = re.exec(s))) {
      pushPlain(s.slice(last, m.index));
      const full = m[0];
      if (m[1]) {
        parts.push(
          <code
            key={`${key}-${i++}`}
            className="font-mono bg-zinc-800 rounded px-1 py-0.5 text-[0.85em] text-zinc-200"
          >
            {full.slice(1, -1)}
          </code>
        );
      } else if (m[2] || m[3]) {
        const inner = full.slice(2, -2);
        parts.push(
          <strong key={`${key}-${i++}`} className="font-medium text-zinc-50">
            {inline(inner, key * 100 + i)}
          </strong>
        );
      } else if (m[4] || m[5]) {
        const inner = full.slice(1, -1);
        parts.push(
          <em key={`${key}-${i++}`} className="italic text-zinc-200">
            {inline(inner, key * 100 + i)}
          </em>
        );
      } else if (m[6]) {
        parts.push(<CiteChip key={`${key}-c${i++}`} n={full.slice(1, -1)} />);
      } else if (m[7]) {
        parts.push(
          <a
            key={`${key}-${i++}`}
            href={m[9]}
            target="_blank"
            rel="noreferrer"
            className="text-accent-400 hover:underline break-all"
          >
            {m[8]}
          </a>
        );
      } else {
        parts.push(
          <a
            key={`${key}-${i++}`}
            href={full}
            target="_blank"
            rel="noreferrer"
            className="text-accent-400 hover:underline break-all"
          >
            {full}
          </a>
        );
      }
      last = m.index + full.length;
    }
    pushPlain(s.slice(last));
    return parts;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (line.includes("|") && idx + 1 < lines.length && isTableSep(lines[idx + 1])) {
      flushLists();
      const header = splitRow(line);
      const rows: string[][] = [];
      idx += 2;
      while (idx < lines.length && lines[idx].includes("|") && lines[idx].trim()) {
        rows.push(splitRow(lines[idx]));
        idx++;
      }
      idx--;
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

    // **1. Title** or **1. Title (unclosed, fixed by cleaner) → ordered list
    const boldNum = trimmed.match(/^\*\*(\d+)\.\s+(.+?)\*\*$/);
    const plainNum = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (boldNum || plainNum) {
      flushUl();
      const num = boldNum ? boldNum[1] : plainNum![1];
      const body = boldNum ? boldNum[2] : plainNum![2];
      ol.push(
        <li key={`k${k++}`} value={Number(num)} className="leading-relaxed pl-1">
          {boldNum ? (
            <strong className="font-medium text-zinc-50">{inline(body, idx)}</strong>
          ) : (
            inline(body, idx)
          )}
        </li>
      );
      continue;
    }

    if (/^\s*[-*] /.test(line)) {
      flushOl();
      ul.push(<li key={`k${k++}`}>{inline(line.replace(/^\s*[-*] /, ""), idx)}</li>);
      continue;
    }

    flushLists();
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
    else if (trimmed)
      out.push(
        <p key={`k${k++}`} className="my-1.5 leading-relaxed">
          {inline(line, idx)}
        </p>
      );
  }
  flushLists();
  return out;
}

export default function ChatWindow({ initialChatId }: { initialChatId?: string }) {
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const catalog: ModelOption[] = d.models ?? [];
        setModels(catalog);
        // in a draft (new) chat, seed the model from the user's saved default
        if (!chatId) setModel((prev) => prev || d.config?.defaultModel || catalog[0]?.id || "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus the composer on mount, and let the user just start typing anywhere
  // to focus it (skip when already typing in a field or using modifiers).
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement)?.isContentEditable) return;
      if (e.key.length === 1 || e.key === "/") {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function changeModel(next: string) {
    if (!next || next === model || savingModel) return;
    const prev = model;
    setModel(next); // optimistic
    // draft chat (not yet created): just keep it locally; it's saved on first send
    if (!chatId) return;
    setSavingModel(true);
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: next }),
      });
      if (!res.ok) throw new Error("Failed to update model");
      window.dispatchEvent(new Event("mm:refresh"));
    } catch {
      setModel(prev); // revert
      toast.error("Couldn't change the model. Try again.");
    } finally {
      setSavingModel(false);
    }
  }

  useEffect(() => {
    if (!chatId) return; // draft chat: nothing to load
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
    // keep the composer focused so the user can keep typing
    setTimeout(() => inputRef.current?.focus(), 0);
    // warm notification permission (optional; chime is the primary signal)
    requestNotifyPermission();
    captureEvent("agent_run_started", { has_chat: Boolean(chatId) });

    try {
      // create the chat on first send (no empty chats sitting in the sidebar)
      let cid = chatId;
      if (!cid) {
        const cres = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
        });
        const cdata = await cres.json();
        if (!cres.ok) throw new Error(cdata.error ?? "Could not start chat");
        cid = cdata.chat.id as string;
        setChatId(cid);
        // update the URL without a remount so the stream keeps running
        window.history.replaceState(null, "", `/chat/${cid}`);
        window.dispatchEvent(new Event("mm:refresh"));
      }

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: cid, message: text }),
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
            const answer = ev.text ?? "";
            setMessages((m) => [
              ...m,
              {
                id: `a-${Date.now()}`,
                role: "assistant",
                text: answer,
                steps: steps.map((s) => ({ ...s, status: "done" as const })),
                artifacts: ev.artifacts,
              },
            ]);
            setLiveSteps([]);
            setLiveArtifacts([]);
            setStatus(null);
            window.dispatchEvent(new Event("mm:refresh"));
            captureEvent("agent_run_done", {
              steps: steps.length,
              artifacts: (ev.artifacts ?? []).length,
            });
            // Primary signal: soft chime (works without Notification permission).
            playDoneChime();
            // Best-effort OS notification only if the tab is in the background.
            notifyResearchComplete(answer.slice(0, 140) || "Your research is ready.", cid);
            toast.success("Research complete");
          } else if (ev.type === "error") {
            throw new Error(ev.message ?? "Agent failed");
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStatus(null);
      setLiveSteps([]);
      // keep the sidebar credit count accurate even on failure (credit refunded)
      window.dispatchEvent(new Event("mm:refresh"));
      captureEvent("agent_run_error", { message: message.slice(0, 80) });
    } finally {
      setRunning(false);
    }
  }

  const isEmpty = messages.length === 0 && !running;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  const modelOptions: DropdownOption[] = models.map((m) => ({
    value: m.id,
    label: m.label,
    hint: m.provider,
  }));

  const pickSuggestion = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  };

  const composerBox = (
    <div className="mm-float rounded-2xl border border-zinc-800/70 bg-zinc-900 transition-colors focus-within:border-accent-500/80 focus-within:ring-1 focus-within:ring-accent-500/25">
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={2}
        autoFocus
        placeholder="Ask a deep research question…"
        data-testid="chat-input"
        className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm text-zinc-100 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none placeholder:text-zinc-500"
      />
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-0.5">
        {/* our own model picker (not the native select) */}
        <Dropdown
          value={model}
          onChange={changeModel}
          options={modelOptions}
          disabled={savingModel}
          fallbackLabel={model ? `${model} (custom)` : undefined}
          aria-label="Model for this chat"
          data-testid="chat-model-select"
          className="max-w-[70%]"
          icon={
            savingModel ? (
              <Loader2 size={13} strokeWidth={1.5} className="text-accent-400 animate-spin shrink-0" />
            ) : (
              <Cpu size={13} strokeWidth={1.5} className="text-accent-400 shrink-0" />
            )
          }
        />

        <button
          onClick={send}
          disabled={running || !input.trim()}
          data-testid="send-btn"
          aria-label="Send message"
          className="flex shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white hover:bg-accent-500 transition-colors h-9 w-9 font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
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
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between gap-3 px-4 pl-14 md:pl-4 pr-36 shrink-0 sticky top-0 z-10">
        <div className="text-sm text-zinc-400 truncate min-w-0">
          {messages[0]?.text?.slice(0, 70) || "New research"}
        </div>
        {/* Credits pill is rendered by AppShell in this top-right space. */}
      </header>

      {running && (
        <div
          className="shrink-0 flex items-center gap-2 border-b border-accent-500/25 bg-accent-500/10 px-4 py-2 font-mono text-xs text-accent-300"
          data-testid="run-status-running"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
          Research in progress
        </div>
      )}

      {isEmpty ? (
        /* Empty state: mascot + suggestions + floating composer + capabilities */
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-3xl flex flex-col items-center text-center animate-in fade-in duration-300">
              <div className="relative mb-5">
                <div className="pointer-events-none absolute inset-0 -z-10 scale-[1.7] rounded-full bg-gradient-to-tr from-accent-500/40 via-fuchsia-500/20 to-transparent blur-2xl" />
                <Mascot state="idle" size={92} />
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-medium tracking-tight text-zinc-50">
                What do you want to <span className="text-accent-400">research?</span>
              </h1>
              <p className="text-zinc-500 text-sm mt-3 mb-7 max-w-md">
                Ask anything. MicroManus searches the web, reads sources, and can write a PDF report.
              </p>

              {/* suggestion cards — prefill the composer */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-5">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => pickSuggestion(s.prompt)}
                      data-testid="suggestion-card"
                      className="mm-float group rounded-xl border border-zinc-800/70 bg-zinc-900/50 p-3.5 text-left transition-colors hover:border-accent-500/50 hover:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400">
                          <Icon size={16} strokeWidth={1.5} />
                        </span>
                        <ArrowUpRight
                          size={15}
                          strokeWidth={1.5}
                          className="text-zinc-600 transition-colors group-hover:text-accent-400"
                        />
                      </div>
                      <div className="mt-2.5 text-sm font-medium text-zinc-100">{s.title}</div>
                      <div className="text-xs text-zinc-500">{s.sub}</div>
                    </button>
                  );
                })}
              </div>

              <div className="w-full">{composerBox}</div>
              <p className="mt-3 font-mono text-[11px] text-zinc-600">
                Each message uses 1 credit · search → read → reason → report.
              </p>

              {/* capability row — what the agent can do */}
              <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                {CAPABILITIES.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.title}
                      className="flex items-center gap-2.5 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-3 py-2.5 text-left"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/60 text-accent-400">
                        <Icon size={15} strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-zinc-200">{c.title}</span>
                        <span className="block text-[11px] text-zinc-500 truncate">{c.sub}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
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
                    <div className={m.id === lastAssistantId ? "flex gap-3" : ""}>
                      {m.id === lastAssistantId && (
                        <div className="shrink-0 pt-0.5">
                          <Mascot state="idle" size={30} />
                        </div>
                      )}
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
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
                      {status ?? "Working…"}
                    </span>
                    <ThinkingLoop steps={liveSteps} defaultOpen />
                    {liveArtifacts.map((a) => (
                      <div key={a.id} className="ml-4 mt-2 flex items-center gap-2 font-mono text-xs text-accent-400">
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

          <div className="px-4 pb-4 pt-2 shrink-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
            <div className="max-w-4xl mx-auto">{composerBox}</div>
            <p className="max-w-4xl mx-auto mt-2 text-center font-mono text-[11px] text-zinc-600">
              Each message uses 1 credit and runs a full research loop (search → read → reason →
              report).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
