// Agent tool implementations: web search (Brave), URL fetch, image search, PDF report.
import type OpenAI from "openai";
import { generatePdfReport } from "./pdf";

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information. Returns top results with title, url and snippet. Use multiple focused queries for deep research. For latest/now/current events, use the current year from context (or omit the year) — do not default to past years.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query. Prefer current year for recent topics; only pin an older year if the user asked for that period.",
          },
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
      name: "image_search",
      description:
        "Search Wikimedia Commons for freely-licensed images. Returns direct image URLs safe to embed with ![caption](url) in a PDF report. Use whenever the user asks to include images, photos, diagrams, or illustrations.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to find (be specific: subject + context)" },
          count: { type: "number", description: "Number of images (1-6), default 4" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "think",
      description:
        "Reflect and plan next steps (no web access). Call after searches/reads to assess what you found, what's missing, and what to do next. Do not call in parallel with other tools.",
      parameters: {
        type: "object",
        properties: {
          reflection: {
            type: "string",
            description:
              "What you learned, what's still missing, and the next action (search more / read / write answer / PDF).",
          },
        },
        required: ["reflection"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_pdf_report",
      description:
        "Generate a downloadable PDF report artifact for the user. Use when the user asks for a report/document. Provide a title and full markdown content (headings with #, ## and bullet lists with - are supported). Images: use ![caption](direct-image-url) from image_search results.",
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
      case "image_search":
        return { result: await imageSearch(String(args.query ?? ""), Number(args.count ?? 4)) };
      case "think": {
        const reflection = String(args.reflection ?? "").trim();
        return {
          result: reflection
            ? `Noted. Continue with your plan:\n${reflection}`
            : "Empty reflection — note findings and decide the next tool call.",
        };
      }
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

  // 1) SerpAPI (Google results) — preferred when configured
  const serpKey = process.env.SERPAPI_API_KEY?.trim();
  if (serpKey) {
    try {
      const url =
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}` +
        `&num=${n}&api_key=${encodeURIComponent(serpKey)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = await res.json();
        type Organic = { title?: string; link?: string; snippet?: string };
        const organic: Organic[] = data?.organic_results ?? [];
        if (organic.length) {
          return organic
            .slice(0, n)
            .map(
              (r, i) =>
                `${i + 1}. ${r.title ?? "(no title)"}\n   URL: ${r.link ?? ""}\n   ${r.snippet ?? ""}`
            )
            .join("\n\n");
        }
        // SerpAPI sometimes returns answer_box / knowledge_graph with no organic
        const answer = data?.answer_box?.answer || data?.answer_box?.snippet;
        if (answer) {
          return `1. ${data.answer_box?.title ?? "Answer"}\n   URL: ${data.answer_box?.link ?? ""}\n   ${answer}`;
        }
      } else {
        console.error("[web_search] SerpAPI HTTP", res.status);
      }
    } catch (e) {
      console.error("[web_search] SerpAPI error:", e instanceof Error ? e.message : e);
    }
    // fall through to Brave / DDG on SerpAPI failure
  }

  // 2) Brave Search API
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (braveKey) {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${n}`,
      { headers: { "X-Subscription-Token": braveKey, Accept: "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      type BraveResult = { title?: string; url?: string; description?: string };
      const results: BraveResult[] = data?.web?.results ?? [];
      if (results.length) {
        return results
          .slice(0, n)
          .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description ?? ""}`)
          .join("\n\n");
      }
    }
  }

  // 3) DuckDuckGo HTML (keyless fallback)
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (MicroManus research agent)" },
  });
  if (!res.ok) return `Search failed: HTTP ${res.status}`;
  const html = await res.text();
  const items: string[] = [];
  const re =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/g;
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

/** Wikimedia Commons image search — keyless, license-clean direct thumb URLs. */
async function imageSearch(query: string, count: number): Promise<string> {
  if (!query.trim()) return "Error: empty query";
  const n = Math.min(Math.max(count || 4, 1), 6);
  // Prefer standard thumb widths Wikimedia accepts (non-standard e.g. 480px → 400).
  const width = 640;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6", // File:
    gsrlimit: String(n),
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata|size",
    iiurlwidth: String(width),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "MicroManusResearchBot/1.0 (deep research agent; educational)" },
    });
    if (!res.ok) return `Image search failed: HTTP ${res.status}`;
    const data = await res.json();
    type Info = {
      thumburl?: string;
      url?: string;
      mime?: string;
      extmetadata?: {
        ImageDescription?: { value?: string };
        Artist?: { value?: string };
        LicenseShortName?: { value?: string };
      };
    };
    const pages: Record<string, { title?: string; imageinfo?: Info[] }> = data?.query?.pages ?? {};
    const rows = Object.values(pages)
      .map((p) => {
        const info = p.imageinfo?.[0];
        if (!info) return null;
        const mime = info.mime ?? "";
        if (mime && !mime.startsWith("image/")) return null;
        const direct = info.thumburl || info.url;
        if (!direct) return null;
        const title = (p.title ?? "Image").replace(/^File:/, "");
        const desc = stripTags(info.extmetadata?.ImageDescription?.value ?? "").slice(0, 160);
        const license = info.extmetadata?.LicenseShortName?.value ?? "see Commons";
        const artist = stripTags(info.extmetadata?.Artist?.value ?? "").slice(0, 80);
        return {
          title,
          url: direct,
          desc,
          license,
          artist,
        };
      })
      .filter(Boolean) as Array<{
      title: string;
      url: string;
      desc: string;
      license: string;
      artist: string;
    }>;

    if (!rows.length) {
      return "No images found. Try a simpler query (e.g. subject + year) or a proper name.";
    }

    return (
      `Found ${rows.length} Wikimedia Commons image(s). Embed in the PDF as ![short caption](url) using the Direct URL exactly:\n\n` +
      rows
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n` +
            `   Direct URL: ${r.url}\n` +
            `   Caption hint: ${r.desc || r.title}\n` +
            `   Credit: ${r.artist || "Wikimedia Commons"} · ${r.license}`
        )
        .join("\n\n")
    );
  } catch (e) {
    return `Image search failed: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    clearTimeout(timer);
  }
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
