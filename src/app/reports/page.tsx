"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowDownToLine, ExternalLink, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import Mascot from "@/components/Mascot";
import { timeAgo } from "@/lib/time";

interface ReportItem {
  id: string;
  filename: string;
  createdAt: string;
  chatId: string | null;
  chatTitle: string | null;
  url: string | null;
}

export default function ReportsPage() {
  const [items, setItems] = useState<ReportItem[] | null>(null);

  useEffect(() => {
    fetch("/api/artifacts")
      .then((r) => r.json())
      .then((d) => setItems(d.artifacts ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 pr-32">
            <Mascot state="writing" size={44} />
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-medium tracking-tight text-zinc-50">
                Reports
              </h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Every PDF report MicroManus has generated for you.
              </p>
            </div>
          </div>

          {items === null ? (
            <div className="mt-16 flex justify-center">
              <Loader2 size={22} strokeWidth={1.5} className="animate-spin text-zinc-600" />
            </div>
          ) : items.length === 0 ? (
            <div className="mt-16 flex flex-col items-center text-center">
              <Mascot state="idle" size={72} className="mb-3" />
              <p className="text-zinc-300 font-medium">No reports yet</p>
              <p className="text-zinc-500 text-sm mt-1">
                Ask MicroManus for a “PDF report” in any chat and it will show up here.
              </p>
              <Link
                href="/chat"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-600 text-white hover:bg-accent-500 transition-colors px-4 py-2 text-sm font-medium"
              >
                Start researching
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((r) => (
                <div
                  key={r.id}
                  data-testid="report-card"
                  className="mm-float group rounded-xl border border-zinc-800/70 bg-zinc-900/50 p-4 transition-colors hover:border-accent-500/40"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400">
                      <FileText size={18} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{r.filename}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {r.chatTitle ? `From “${r.chatTitle}”` : "Report"} · {timeAgo(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {r.url ? (
                      <>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                          <ExternalLink size={13} strokeWidth={1.5} />
                          Open
                        </a>
                        <a
                          href={r.url}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                          <ArrowDownToLine size={13} strokeWidth={1.5} />
                          Download
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">Link unavailable</span>
                    )}
                    {r.chatId && (
                      <Link
                        href={`/chat/${r.chatId}`}
                        className="ml-auto text-xs text-accent-400 hover:underline"
                      >
                        View chat
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
