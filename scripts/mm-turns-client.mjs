/**
 * Minimal Context-B client: call MM research via PAT.
 * Usage:
 *   MM_URL=https://… MM_PAT=mm_… node scripts/mm-turns-client.mjs "what is causing wildfires in spain?"
 */

const base = (process.env.MM_URL || "http://localhost:3000").replace(/\/$/, "");
const pat = process.env.MM_PAT;
const text = process.argv.slice(2).join(" ") || "Hello from connector client";

if (!pat) {
  console.error("Set MM_PAT=mm_…");
  process.exit(1);
}

const res = await fetch(`${base}/api/v1/turns`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text, platform: "cli_attach" }),
});

if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const parts = buf.split("\n\n");
  buf = parts.pop() || "";
  for (const part of parts) {
    for (const line of part.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === "status") console.log("[status]", ev.text);
        else if (ev.type === "tool_call") console.log("[tool]", ev.tool, ev.args);
        else if (ev.type === "done") console.log("\n" + (ev.text || ""));
        else if (ev.type === "error") console.error("[error]", ev.message);
      } catch {
        /* ignore */
      }
    }
  }
}
