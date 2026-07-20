import PDFDocument from "pdfkit";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Palette + geometry
// ---------------------------------------------------------------------------
const INK = "#18181b"; // body
const INK_SOFT = "#3f3f46";
const MUTED = "#71717a";
const ACCENT = "#b45309"; // amber-700 — readable on white (bright amber links are unreadable)
const RULE = "#e4e4e7";
const QUOTE_BAR = "#fbbf24";
const HEADING = "#0c0c10";
const FOOTER_Y_FROM_BOTTOM = 34;

interface ImgAsset {
  buffer: Buffer;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Image prefetch: pull every ![alt](url) target, download, and normalise to a
// PNG buffer via sharp (handles webp/gif/svg-raster/huge files). A failure maps
// to `null` so the renderer can draw a labelled placeholder instead of leaking
// raw markdown. Never throws.
// ---------------------------------------------------------------------------
const IMG_RE = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const MAX_IMG_BYTES = 8 * 1024 * 1024;

function isBlockedHost(host: string): boolean {
  return (
    host === "localhost" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  );
}

async function fetchImage(url: string): Promise<ImgAsset | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (MicroManus research agent)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_IMG_BYTES) return null;

    // Normalise to PNG. `failOn:"none"` tolerates minor corruption; flatten any
    // alpha onto white so transparent PNGs don't render as black on the page.
    let pipeline = sharp(Buffer.from(ab), { failOn: "none", animated: false }).flatten({
      background: "#ffffff",
    });
    const meta = await pipeline.metadata();
    if (meta.width && meta.width > 1600) pipeline = pipeline.resize({ width: 1600 });
    const out = await pipeline.png().toBuffer({ resolveWithObject: true });
    if (!out.info.width || !out.info.height) return null;
    return { buffer: out.data, width: out.info.width, height: out.info.height };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function prefetchImages(markdown: string): Promise<Map<string, ImgAsset | null>> {
  const urls = new Set<string>();
  for (const m of markdown.matchAll(IMG_RE)) urls.add(m[2]);
  const map = new Map<string, ImgAsset | null>();
  await Promise.all(
    [...urls].map(async (u) => {
      map.set(u, await fetchImage(u));
    })
  );
  return map;
}

// ---------------------------------------------------------------------------
// Inline tokenizer: bold / italic / code / [text](url) links / bare URLs.
// ---------------------------------------------------------------------------
type Run =
  | { kind: "text"; text: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { kind: "link"; text: string; url: string };

// order matters: links before bare-url so [t](u) wins; bold(**) before italic(*)
const INLINE_RE = new RegExp(
  [
    "\\[([^\\]]+)\\]\\(\\s*([^)\\s]+)[^)]*\\)", // 1,2 [text](url)
    "\\*\\*([^*]+)\\*\\*", // 3 **bold**
    "__([^_]+)__", // 4 __bold__
    "\\*([^*]+)\\*", // 5 *italic*
    "`([^`]+)`", // 6 `code`
    "(https?:\\/\\/[^\\s)]+)", // 7 bare url
  ].join("|"),
  "g"
);

function tokenizeInline(s: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) runs.push({ kind: "text", text: s.slice(last, idx) });
    if (m[1] !== undefined) runs.push({ kind: "link", text: m[1], url: m[2] });
    else if (m[3] !== undefined) runs.push({ kind: "text", text: m[3], bold: true });
    else if (m[4] !== undefined) runs.push({ kind: "text", text: m[4], bold: true });
    else if (m[5] !== undefined) runs.push({ kind: "text", text: m[5], italic: true });
    else if (m[6] !== undefined) runs.push({ kind: "text", text: m[6], code: true });
    else if (m[7] !== undefined) runs.push({ kind: "link", text: shortenUrl(m[7]), url: m[7] });
    last = idx + m[0].length;
  }
  if (last < s.length) runs.push({ kind: "text", text: s.slice(last) });
  return runs.length ? runs : [{ kind: "text", text: s }];
}

function shortenUrl(url: string, max = 58): string {
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (display.length <= max) return display;
  return display.slice(0, max - 14) + "…" + display.slice(-13);
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
export async function renderPdf(title: string, markdown: string): Promise<Buffer> {
  const images = await prefetchImages(markdown);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usable = right - left;
    const bottom = () => doc.page.height - doc.page.margins.bottom - FOOTER_Y_FROM_BOTTOM;
    const bodySize = 10.5;

    const spaceLeft = () => bottom() - doc.y;
    const atPageTop = () => doc.y <= doc.page.margins.top + 1;
    // add a page only if we aren't already on a fresh one
    const pageBreak = () => {
      if (!atPageTop()) doc.addPage();
    };
    // run `fn` with the left margin bumped `px` right, so wrapped lines respect
    // the indent (pdfkit wraps to the margin, not to doc.x). Restores after.
    const withIndent = (px: number, fn: () => void) => {
      const orig = doc.page.margins.left;
      doc.page.margins.left = orig + px;
      doc.x = orig + px;
      try {
        fn();
      } finally {
        doc.page.margins.left = orig;
        doc.x = orig;
      }
    };

    // --- inline rich-text writer (bold/italic/code/links, wraps naturally) ---
    const fontFor = (r: Extract<Run, { kind: "text" }>) =>
      r.code
        ? "Courier"
        : r.bold && r.italic
          ? "Helvetica-BoldOblique"
          : r.bold
            ? "Helvetica-Bold"
            : r.italic
              ? "Helvetica-Oblique"
              : "Helvetica";

    const writeRich = (
      text: string,
      opts: { size?: number; color?: string; indent?: number; lineGap?: number; align?: "left" | "justify" } = {}
    ) => {
      const size = opts.size ?? bodySize;
      const color = opts.color ?? INK;
      const runs = tokenizeInline(text);
      runs.forEach((r, i) => {
        const cont = i < runs.length - 1;
        const base = {
          continued: cont,
          indent: i === 0 ? opts.indent ?? 0 : 0,
          lineGap: opts.lineGap ?? 3,
          align: opts.align ?? "left",
        };
        if (r.kind === "link") {
          doc
            .font("Helvetica")
            .fontSize(size)
            .fillColor(ACCENT)
            .text(r.text, { ...base, link: r.url, underline: true });
        } else {
          doc
            .font(fontFor(r))
            .fontSize(size)
            .fillColor(r.code ? INK_SOFT : color)
            .text(r.text, base);
        }
      });
      doc.fillColor(INK);
    };

    // --- images ---
    const drawImage = (url: string, alt: string) => {
      const asset = images.get(url) ?? null;
      const capGap = 6;
      if (!asset) {
        // labelled placeholder — never leak the raw markdown
        if (spaceLeft() < 90) pageBreak();
        const h = 60;
        const y = doc.y;
        doc.save().rect(left, y, usable, h).lineWidth(1).dash(3, { space: 3 }).strokeColor(RULE).stroke().restore();
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor(MUTED)
          .text(`[image unavailable]${alt ? " — " + alt : ""}`, left, y + h / 2 - 6, {
            width: usable,
            align: "center",
            lineBreak: false,
          });
        doc.y = y + h;
        doc.moveDown(0.6);
        return;
      }
      const maxW = usable;
      const maxH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 60;
      let w = Math.min(asset.width, maxW);
      let h = (asset.height / asset.width) * w;
      if (h > maxH) {
        h = maxH;
        w = (asset.width / asset.height) * h;
      }
      const capH = alt ? 16 : 0;
      if (spaceLeft() < h + capH + capGap) pageBreak();
      const x = left + (usable - w) / 2;
      doc.image(asset.buffer, x, doc.y, { width: w, height: h });
      doc.y += h;
      if (alt) {
        doc.moveDown(0.3);
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor(MUTED)
          .text(alt, left, doc.y, { width: usable, align: "center" });
      }
      doc.fillColor(INK);
      doc.x = left;
      doc.moveDown(0.7);
    };

    // --- tables ---
    const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
    const splitRow = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

    const drawTable = (header: string[], rows: string[][]) => {
      const cols = header.length;
      const colW = usable / cols;
      const pad = 6;
      const cf = 9.5;
      const cellHeight = (cells: string[], bold: boolean) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(cf);
        let max = 0;
        cells.forEach((c) => {
          const h = doc.heightOfString(stripInline(c) || " ", { width: colW - pad * 2 });
          if (h > max) max = h;
        });
        return max + pad * 2;
      };
      const drawRow = (cells: string[], bold: boolean, fill?: string) => {
        const h = cellHeight(cells, bold);
        if (doc.y + h > bottom()) pageBreak();
        const y = doc.y;
        if (fill) doc.rect(left, y, usable, h).fill(fill);
        doc.fillColor(bold ? HEADING : INK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(cf);
        cells.forEach((c, i) => {
          doc.text(stripInline(c) || "", left + i * colW + pad, y + pad, { width: colW - pad * 2 });
        });
        doc.strokeColor(RULE).lineWidth(0.75).rect(left, y, usable, h).stroke();
        for (let i = 1; i < cols; i++) {
          doc.moveTo(left + i * colW, y).lineTo(left + i * colW, y + h).stroke();
        }
        doc.y = y + h;
      };
      doc.moveDown(0.4);
      drawRow(header, true, "#faf6ee");
      rows.forEach((r) => drawRow(header.map((_, i) => r[i] ?? ""), false));
      doc.moveDown(0.6);
      doc.fillColor(INK);
      doc.x = left; // cells left doc.x in the last column — reset for the next block
    };

    // --- header ---
    doc.font("Helvetica-Bold").fontSize(24).fillColor(HEADING).text(title, { align: "left" });
    doc.moveDown(0.35);
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(`MicroManus · Research Report · ${dateStr}`);
    doc.moveDown(0.55);
    const ry = doc.y;
    doc.moveTo(left, ry).lineTo(right, ry).lineWidth(1.5).strokeColor(QUOTE_BAR).stroke();
    doc.moveDown(1);
    doc.fillColor(INK);

    // --- normalise input: strip fences, collapse blank runs ---
    const rawLines = markdown.replace(/\r\n/g, "\n").split("\n");
    const lines: string[] = [];
    let blankPending = false;
    for (const l of rawLines) {
      if (!l.trim()) {
        blankPending = lines.length > 0;
        continue;
      }
      if (blankPending) lines.push("");
      blankPending = false;
      lines.push(l);
    }
    // drop a leading `# Title` that just repeats the header we already rendered
    if (lines.length && /^#\s+/.test(lines[0])) {
      const h = stripInline(lines[0].replace(/^#\s+/, "")).trim().toLowerCase();
      if (h === title.trim().toLowerCase()) lines.shift();
    }

    let inSources = false;
    let sourceNo = 0;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].replace(/\s+$/, "");

      if (!line.trim()) {
        doc.moveDown(0.35);
        continue;
      }

      // horizontal rule
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        doc.moveDown(0.3);
        const y = doc.y;
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor(RULE).stroke();
        doc.moveDown(0.5);
        continue;
      }

      // table
      if (line.includes("|") && idx + 1 < lines.length && isTableSep(lines[idx + 1])) {
        const header = splitRow(line);
        const rows: string[][] = [];
        idx += 2;
        while (idx < lines.length && lines[idx].includes("|") && lines[idx].trim()) {
          rows.push(splitRow(lines[idx]));
          idx++;
        }
        idx--;
        drawTable(header, rows);
        continue;
      }

      // block image (own line, possibly with surrounding whitespace)
      const imgOnly = line.trim().match(/^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)$/);
      if (imgOnly) {
        drawImage(imgOnly[2], imgOnly[1]);
        continue;
      }

      // blockquote (collect consecutive)
      if (/^\s*>\s?/.test(line)) {
        const quote: string[] = [];
        while (idx < lines.length && /^\s*>\s?/.test(lines[idx])) {
          quote.push(lines[idx].replace(/^\s*>\s?/, ""));
          idx++;
        }
        idx--;
        if (spaceLeft() < 40) pageBreak();
        doc.moveDown(0.3);
        const yStart = doc.y;
        withIndent(18, () => writeRich(quote.join(" "), { color: INK_SOFT, size: 11 }));
        const yEnd = doc.y;
        doc.save().rect(left, yStart, 3, yEnd - yStart).fill(QUOTE_BAR).restore();
        doc.moveDown(0.5);
        continue;
      }

      // headings
      const hMatch = line.match(/^(#{1,4})\s+(.*)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const txt = stripInline(hMatch[2]).trim();
        inSources = /^sources\b/i.test(txt) || /^references\b/i.test(txt);
        sourceNo = 0;
        if (spaceLeft() < 60) pageBreak();
        if (level === 1) {
          doc.moveDown(0.5).font("Helvetica-Bold").fontSize(18).fillColor(HEADING).text(txt);
        } else if (level === 2) {
          doc.moveDown(0.55).font("Helvetica-Bold").fontSize(14).fillColor(HEADING).text(txt);
          const y = doc.y + 2;
          doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();
          doc.moveDown(0.35);
        } else {
          doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11.5).fillColor(INK_SOFT).text(txt);
          doc.moveDown(0.1);
        }
        doc.fillColor(INK);
        continue;
      }

      // list item
      const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const numbered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (bullet || numbered) {
        const content = (bullet ? bullet[2] : numbered![3]).trim();
        // Sources section -> numbered bibliography with hyperlinked short display
        if (inSources) {
          sourceNo++;
          const linkM = content.match(/\[([^\]]+)\]\(\s*([^)\s]+)[^)]*\)/);
          const urlM = content.match(/(https?:\/\/[^\s)]+)/);
          const display = linkM
            ? `[${linkM[1]}](${linkM[2]})`
            : urlM
              ? `[${shortenUrl(urlM[1])}](${urlM[1]})`
              : content;
          withIndent(18, () => writeRich(`${sourceNo}.  ${display}`, { size: 9.5, lineGap: 2 }));
          doc.moveDown(0.15);
          continue;
        }
        if (bullet) {
          withIndent(14, () => writeRich(`•  ${content}`, { size: bodySize, lineGap: 2 }));
        } else {
          withIndent(14, () =>
            writeRich(`${numbered![2]}.  ${content}`, { size: bodySize, lineGap: 2 })
          );
        }
        doc.moveDown(0.1);
        continue;
      }

      // paragraph
      writeRich(line, { size: bodySize, lineGap: 3 });
      doc.moveDown(0.25);
    }

    // --- footers: real page-number field, drawn once per buffered page ---
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = doc.page.height - FOOTER_Y_FROM_BOTTOM;
      doc.moveTo(left, fy - 6).lineTo(right, fy - 6).lineWidth(0.5).strokeColor(RULE).stroke();
      // The footer sits inside the bottom margin; writing text there would make
      // pdfkit think content overflowed and auto-append a blank page (which is
      // what jammed "Page 1 of NPage 2 of N" onto a trailing page). Zeroing the
      // bottom margin for the write suppresses that.
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(`Page ${i + 1} of ${range.count}`, left, fy, {
          width: usable,
          align: "center",
          lineBreak: false,
        });
      doc.page.margins.bottom = savedBottom;
    }

    doc.flushPages();
    doc.end();
  });
}

// plain-text fallback for contexts where inline styling can't be applied
// (table cells, heading text) — strips markdown emphasis/link syntax.
function stripInline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(\s*[^)\s]+[^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
