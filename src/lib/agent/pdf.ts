import PDFDocument from "pdfkit";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ToolContext } from "./tools";

// Renders simple markdown (#/##/### headings, - bullets, **bold** stripped) into a PDF,
// uploads to the private `artifacts` bucket, records it, returns a signed URL.
export async function generatePdfReport(
  title: string,
  markdown: string,
  ctx: ToolContext
): Promise<{ id: string; filename: string; url: string }> {
  const buffer = await renderPdf(title, markdown);

  const admin = createSupabaseAdmin();
  const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "report";
  const filename = `${safeTitle}.pdf`;
  const storagePath = `${ctx.userId}/${ctx.chatId}/${Date.now()}-${filename}`;

  const { error: upErr } = await admin.storage
    .from("artifacts")
    .upload(storagePath, buffer, { contentType: "application/pdf" });
  if (upErr) throw new Error(`artifact upload failed: ${upErr.message}`);

  const { data: row, error: insErr } = await admin
    .from("artifacts")
    .insert({ user_id: ctx.userId, chat_id: ctx.chatId, filename, storage_path: storagePath })
    .select("id")
    .single();
  if (insErr) throw new Error(`artifact record failed: ${insErr.message}`);

  const { data: signed, error: signErr } = await admin.storage
    .from("artifacts")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
  if (signErr || !signed) throw new Error(`artifact signing failed: ${signErr?.message}`);

  return { id: row.id, filename, url: signed.signedUrl };
}

function renderPdf(title: string, markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    doc.font("Helvetica-Bold").fontSize(24).fillColor("#0c0c10").text(title, { align: "left" });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#8a8a90")
      .text(`MicroManus research report · ${new Date().toUTCString()}`);
    doc.moveDown(0.5);
    // amber rule under the header
    const ruleY = doc.y;
    doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(1.5).strokeColor("#fbbf24").stroke();
    doc.moveDown(1);
    doc.fillColor("#18181b");

    const inline = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
    const isTableSep = (l: string) =>
      /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
    const splitRow = (l: string) =>
      l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => inline(c.trim()));

    const drawTable = (header: string[], rows: string[][]) => {
      const startX = doc.page.margins.left;
      const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const cols = header.length;
      const colW = usable / cols;
      const padding = 5;
      const cellFont = 9.5;

      const rowHeight = (cells: string[], bold: boolean) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(cellFont);
        let max = 0;
        cells.forEach((c) => {
          const h = doc.heightOfString(c || "", { width: colW - padding * 2 });
          if (h > max) max = h;
        });
        return max + padding * 2;
      };

      const drawRow = (cells: string[], bold: boolean, fill?: string) => {
        const h = rowHeight(cells, bold);
        // page break if the row won't fit
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
        }
        const y = doc.y;
        if (fill) doc.rect(startX, y, usable, h).fill(fill);
        doc.fillColor("#111111").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(cellFont);
        cells.forEach((c, i) => {
          doc.text(c || "", startX + i * colW + padding, y + padding, {
            width: colW - padding * 2,
          });
        });
        // borders
        doc.strokeColor("#cccccc").lineWidth(0.5);
        doc.rect(startX, y, usable, h).stroke();
        for (let i = 1; i < cols; i++) {
          doc.moveTo(startX + i * colW, y).lineTo(startX + i * colW, y + h).stroke();
        }
        doc.y = y + h;
      };

      doc.moveDown(0.4);
      drawRow(header, true, "#f0f0f0");
      rows.forEach((r) => {
        const cells = header.map((_, i) => r[i] ?? "");
        drawRow(cells, false);
      });
      doc.moveDown(0.6);
      doc.fillColor("#111111");
    };

    const lines = markdown.split("\n");
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trimEnd();

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
        doc.font("Helvetica").fontSize(10.5);
        continue;
      }

      if (!line.trim()) {
        doc.moveDown(0.4);
        continue;
      }
      if (line.startsWith("### ")) {
        doc.moveDown(0.3).font("Helvetica-Bold").fontSize(12).text(inline(line.slice(4)));
        doc.font("Helvetica").fontSize(10.5);
      } else if (line.startsWith("## ")) {
        doc.moveDown(0.5).font("Helvetica-Bold").fontSize(14).text(inline(line.slice(3)));
        doc.font("Helvetica").fontSize(10.5);
      } else if (line.startsWith("# ")) {
        doc.moveDown(0.6).font("Helvetica-Bold").fontSize(17).text(inline(line.slice(2)));
        doc.font("Helvetica").fontSize(10.5);
      } else if (/^\s*[-*] /.test(line)) {
        doc.font("Helvetica").fontSize(10.5).text(`• ${inline(line.replace(/^\s*[-*] /, ""))}`, {
          indent: 14,
          lineGap: 2,
        });
      } else if (/^\s*\d+\. /.test(line)) {
        doc.font("Helvetica").fontSize(10.5).text(inline(line.trim()), { indent: 14, lineGap: 2 });
      } else {
        doc.font("Helvetica").fontSize(10.5).text(inline(line), { lineGap: 2 });
      }
    }

    // page numbers (footer)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#a1a1aa")
        .text(
          `Page ${i + 1} of ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 38,
          {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: "center",
            lineBreak: false,
          }
        );
    }

    doc.end();
  });
}
