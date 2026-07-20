"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import Mascot from "@/components/Mascot";

interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  input: number;
  output: number;
  cachedIn: number;
  hint: string;
}

const inputClass =
  "w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20";

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const welcome = params.get("welcome") === "1";

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const catalog: ModelInfo[] = d.models ?? [];
        setModels(catalog);
        if (d.config) {
          setBaseUrl(d.config.baseUrl);
          setKeyPreview(d.config.keyPreview);
          // if the saved model isn't in the catalog, it's a custom id — restore custom mode
          if (catalog.some((m) => m.id === d.config.defaultModel)) {
            setModel(d.config.defaultModel);
          } else {
            setCustomMode(true);
            setCustomModel(d.config.defaultModel);
            if (catalog.length) setModel(catalog[0].id);
          }
        } else if (catalog.length) {
          setModel(catalog[0].id);
          setBaseUrl(catalog[0].hint);
        }
      })
      .catch(() => {});
  }, []);

  const selected = models.find((m) => m.id === model);
  // the model id actually sent to the server / used for pricing
  const effectiveModel = customMode ? customModel.trim() : model;

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
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, defaultModel: effectiveModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Saved. You're ready to research.");
      setApiKey("");
      if (welcome) setTimeout(() => router.push("/chat"), 900);
      else {
        const r = await fetch("/api/settings").then((x) => x.json());
        setKeyPreview(r.config?.keyPreview ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const groups: Array<[string, ModelInfo[]]> = ["anthropic", "openai", "kimi", "google"].map(
    (p) => [p, models.filter((m) => m.provider === p)]
  );

  const groupLabel = (p: string) =>
    p === "anthropic"
      ? "Claude (Anthropic)"
      : p === "openai"
      ? "OpenAI"
      : p === "kimi"
      ? "Kimi (Moonshot)"
      : "Gemini (Google)";

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <Mascot state="settings" size={44} />
          <div>
            <h1 className="font-heading text-2xl font-medium tracking-tight text-zinc-50">
              Settings
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5 flex items-center gap-1.5">
              <ShieldCheck size={14} strokeWidth={1.5} className="text-amber-400 shrink-0" />
              Bring your own OpenAI-compatible key — encrypted at rest (AES-256-GCM).
            </p>
          </div>
        </div>

        {welcome && (
          <div className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/5 text-amber-300 p-3 text-sm">
            You&apos;re unlocked. One last step: add your LLM API key below.
          </div>
        )}

        <form onSubmit={save} className="mt-8 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium">Model</label>
              <label className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={customMode}
                  onChange={(e) => setCustomMode(e.target.checked)}
                  data-testid="custom-model-toggle"
                  className="accent-amber-400"
                />
                Advanced: custom model id
              </label>
            </div>

            {!customMode ? (
              <>
                <select
                  value={model}
                  onChange={(e) => onModelChange(e.target.value)}
                  data-testid="model-select"
                  className={`${inputClass} font-mono`}
                >
                  {groups.map(([provider, list]) =>
                    list.length ? (
                      <optgroup key={provider} label={groupLabel(provider)}>
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
                  <p className="font-mono text-xs text-zinc-500 mt-1.5">
                    Pricing used for cost tracking: ${selected.input}/M input · $
                    {selected.output}/M output · ${selected.cachedIn}/M cached input.
                  </p>
                )}
              </>
            ) : (
              <>
                <input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. moonshotai/kimi-k2:free"
                  data-testid="custom-model-input"
                  className={`${inputClass} font-mono`}
                />
                <p className="font-mono text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  Enter any model id your endpoint accepts — e.g. OpenRouter free models
                  (<code className="text-zinc-400">moonshotai/kimi-k2:free</code>,{" "}
                  <code className="text-zinc-400">z-ai/glm-4.5-air:free</code>) or Gemini
                  (<code className="text-zinc-400">gemini-2.5-flash</code> with base URL{" "}
                  <code className="text-zinc-400">
                    https://generativelanguage.googleapis.com/v1beta/openai/
                  </code>
                  ). Tokens are tracked; unknown ids record cost as $0.
                </p>
              </>
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
              data-testid="base-url-input"
              className={`${inputClass} font-mono`}
            />
            <p className="font-mono text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Works with OpenAI, Anthropic (
              <code className="text-zinc-400">https://api.anthropic.com/v1</code>), Moonshot (
              <code className="text-zinc-400">https://api.moonshot.ai/v1</code>) or any router
              like OpenRouter (
              <code className="text-zinc-400">https://openrouter.ai/api/v1</code>).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">API key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder={keyPreview ? `Saved: ${keyPreview} — enter a new key to replace` : "sk-…"}
              data-testid="api-key-input"
              className={`${inputClass} font-mono`}
            />
          </div>

          <button
            type="submit"
            disabled={busy || !baseUrl || !effectiveModel || (!apiKey && !keyPreview)}
            data-testid="save-settings-btn"
            className="rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-500 transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
          >
            {busy ? "Validating & saving…" : "Save settings"}
          </button>
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
