"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  input: number;
  output: number;
  cachedIn: number;
  hint: string;
}

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const welcome = params.get("welcome") === "1";

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models ?? []);
        if (d.config) {
          setBaseUrl(d.config.baseUrl);
          setModel(d.config.defaultModel);
          setKeyPreview(d.config.keyPreview);
        } else if (d.models?.length) {
          setModel(d.models[0].id);
          setBaseUrl(d.models[0].hint);
        }
      })
      .catch(() => {});
  }, []);

  const selected = models.find((m) => m.id === model);

  function onModelChange(id: string) {
    setModel(id);
    const m = models.find((x) => x.id === id);
    // auto-fill the provider's default endpoint if the field is empty or was a hint
    if (m && (!baseUrl || models.some((x) => x.hint === baseUrl))) {
      setBaseUrl(m.hint);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, defaultModel: model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMsg({ kind: "ok", text: "Saved. You're ready to research!" });
      setApiKey("");
      if (welcome) setTimeout(() => router.push("/chat"), 900);
      else {
        const r = await fetch("/api/settings").then((x) => x.json());
        setKeyPreview(r.config?.keyPreview ?? null);
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  const groups: Array<[string, ModelInfo[]]> = ["anthropic", "openai", "kimi"].map((p) => [
    p,
    models.filter((m) => m.provider === p),
  ]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">
          MicroManus never ships with a key — bring your own OpenAI-compatible API key
          and endpoint. It is encrypted at rest (AES-256-GCM).
        </p>

        {welcome && (
          <div className="mt-4 rounded-lg border border-indigo-800 bg-indigo-950/50 text-indigo-300 p-3 text-sm">
            🎉 You&apos;re unlocked! One last step: add your LLM API key below.
          </div>
        )}

        <form onSubmit={save} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Model</label>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            >
              {groups.map(([provider, list]) =>
                list.length ? (
                  <optgroup
                    key={provider}
                    label={
                      provider === "anthropic" ? "Claude (Anthropic)" : provider === "openai" ? "OpenAI" : "Kimi (Moonshot)"
                    }
                  >
                    {list.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — ${m.input}/M in · ${m.output}/M out
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )}
            </select>
            {selected && (
              <p className="text-xs text-zinc-500 mt-1.5">
                Pricing used for cost tracking: ${selected.input}/M input · $
                {selected.output}/M output · ${selected.cachedIn}/M cached input.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              API base URL (OpenAI-compatible)
            </label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              Works with OpenAI, Anthropic (<code>https://api.anthropic.com/v1</code>),
              Moonshot (<code>https://api.moonshot.ai/v1</code>) or any router like
              OpenRouter (<code>https://openrouter.ai/api/v1</code>).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">API key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder={keyPreview ? `Saved: ${keyPreview} — enter a new key to replace` : "sk-…"}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !baseUrl || !model || (!apiKey && !keyPreview)}
            className="rounded-lg bg-indigo-500 hover:bg-indigo-400 transition px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Validating & saving…" : "Save settings"}
          </button>

          {msg && (
            <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>
              {msg.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <Suspense>
        <SettingsInner />
      </Suspense>
    </AppShell>
  );
}
