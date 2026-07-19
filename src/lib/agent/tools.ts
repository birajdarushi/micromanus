// Agent tool implementations: web search (Brave), URL fetch, PDF report artifact.
import type OpenAI from "openai";
import { generatePdfReport } from "./pdf";

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information. Returns top results with title, url and snippet. Use multiple focused queries for deep research.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          count: { type: "number", description: "Number of results (1-10), default 6" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Fetch a web page and return its readable text content (truncated). Use after web_search to read promising sources in depth.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Absolute http(s) URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_pdf_report",
      description:
        "Generate a downloadable PDF report artifact for the user. Use when the user asks for a report/document. Provide a title and full markdown content (headings with #, ## and bullet lists with - are supported).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Report title" },
          markdown: { type: "string", description: "Full report body in simple markdown" },
        },
        required: ["title", "markdown"],
      },
    },
  },
];

export interface ToolContext {
  userId: string;
  chatId: string;
}

export interface ToolOutcome {
  result: string; // fed back to the model
  artifact?: { id: string; filename: string; url: string }; // surfaced to the UI
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "web_search":
        return { result: await webSearch(String(args.query ?? ""), Number(args.count ?? 6)) };
      case "fetch_url":
        return { result: await fetchUrl(String(args.url ?? "")) };
      case "create_pdf_report": {
        const artifact = await generatePdfReport(
          String(args.title ?? "Report"),
          String(args.markdown ?? ""),
          ctx
        );
        return {
          result: `PDF report "${artifact.filename}" created successfully. It is now available to the user as a downloadable artifact. Mention it in your reply.`,
          artifact,
        };
      }
      default:
        return { result: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { result: `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function webSearch(query: string, count: number): Promise<string> {
  if (!query) return "Error: empty query";
  const n = Math.min(Math.max(count || 6, 1), 10);
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (key) {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${n}`,
      { headers: { "X-Subscription-Token": key, Accept: "application/json" } }
    );
    if (!res.ok) return `Search failed: HTTP ${res.status}`;
    const data = await res.json();
    type BraveResult = { title?: string; url?: string; description?: string };
    const results: BraveResult[] = data?.web?.results ?? [];
    if (!results.length) return "No results found.";
    return results
      .slice(0, n)
      .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description ?? ""}`)
      .join("\n\n");
  }
  // fallback: DuckDuckGo HTML (no key required)
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (MicroManus research agent)" },
  });
  if (!res.ok) return `Search failed: HTTP ${res.status}`;
  const html = await res.text();
  const items: string[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && items.length < n) {
    const url = decodeDdgUrl(m[1]);
    items.push(`${items.length + 1}. ${stripTags(m[2])}\n   URL: ${url}\n   ${stripTags(m[3])}`);
  }
  return items.length ? items.join("\n\n") : "No results found.";
}

function decodeDdgUrl(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    return u.searchParams.get("uddg") ?? href;
  } catch {
    return href;
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_PAGE_CHARS = 12_000;

async function fetchUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Error: invalid URL";
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return "Error: only http(s) URLs allowed";
  // basic SSRF guard
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return "Error: URL not allowed";
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (MicroManus research agent)" },
      redirect: "follow",
    });
    if (!res.ok) return `Fetch failed: HTTP ${res.status}`;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/") && !type.includes("json") && !type.includes("xml")) {
      return `Unsupported content type: ${type}`;
    }
    const html = await res.text();
    const text = htmlToText(html);
    return text.length > MAX_PAGE_CHARS
      ? text.slice(0, MAX_PAGE_CHARS) + "\n\n[content truncated]"
      : text;
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(html: string): string {
  return stripTags(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<(p|div|br|li|h[1-6]|tr)[^>]*>/gi, "\n$&")
  );
}
