# Reference repos (inspiration only)

Cloned under `reference/` (gitignored — not part of the deployable app).

| Repo | Path | What we took |
|---|---|---|
| [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) | `reference/open_deep_research` | Plan → multi-search → **reflect (`think` tool)** → compress → final report; hard tool budgets; prefer primary sources |
| [karpathy/autoresearch](https://github.com/karpathy/autoresearch) | `reference/autoresearch` | Tight agent loop + written `program.md`-style instructions; measure progress and stop when the metric is good enough (here: “can answer confidently”) |

## How they feed MicroManus

We do **not** run LangGraph or Python training inside this Next.js app. Patterns are folded into:

- `src/app/api/agent/route.ts` — system prompt (research method + hard limits)
- `src/lib/agent/tools.ts` — `think` reflection tool (mirrors open_deep_research `think_tool`)

To refresh clones:

```bash
cd reference
rm -rf open_deep_research autoresearch
git clone --depth 1 https://github.com/langchain-ai/open_deep_research.git
git clone --depth 1 https://github.com/karpathy/autoresearch.git
```

## Note on autoresearch

Karpathy’s repo is an autonomous **ML training** experiment loop (edit `train.py`, train 5 min, keep/discard). The transferable idea is the **disciplined overnight agent loop + instruction file**, not the GPU training code. Open Deep Research is the closer match for web research + report writing.
