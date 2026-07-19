# STATUS — single source of truth (update this file every session)

_Last updated: 2026-07-20 (session 1 — scaffold + full backend + first-pass UI built; nothing provisioned or deployed yet)._

## Legend
✅ done & written · 🟡 written but NOT yet verified (no build/deploy/DB yet) · ⏳ not started · ❗ blocker needing the owner

---

## Requirement ledger (assignment → state)

| # | Requirement | State | Where |
|---|---|---|---|
| 1 | Social login (Google/GitHub only) | 🟡 code done | `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/proxy.ts` — ❗ providers must be enabled in Supabase dashboard |
| 2 | Paywall after signup, bypass via coupon `SID_DRDROID` | 🟡 code done | `src/app/paywall/page.tsx`, `api/billing/coupon` |
| 3 | Real card payment ($5 ≈ ₹425, Razorpay test) → 5 credits | 🟡 code done | `api/billing/order` + `api/billing/verify` (HMAC verify, idempotent grant) |
| 4 | 5 credits either way | 🟡 | `src/lib/billing.ts` (`CREDITS_PER_UNLOCK=5`), 1 credit per agent run, atomic `consume_credit()` RPC w/ refund on hard failure |
| 5 | Chat UI with internet access + conversation threads | 🟡 code done | `components/ChatWindow.tsx`, `AppShell.tsx`, `api/chats*` |
| 6 | Context held within a chat | 🟡 | history replayed from `messages` table in `api/agent` (limit 40 turns) |
| 7 | Agent loop: think → tool call → observe → repeat | 🟡 | `api/agent/route.ts` (max 12 iterations) + `lib/agent/tools.ts` (web_search/fetch_url/create_pdf_report) |
| 8 | New chats capability | 🟡 | sidebar "+ New chat", `POST /api/chats` |
| 9 | PDF report artifact | 🟡 | `lib/agent/pdf.ts` (pdfkit → Supabase Storage `artifacts` bucket → 7-day signed URL) |
| 10 | Caching with OpenAI-compatible key & endpoint | 🟡 | stable system-prompt prefix (cache-friendly), `cached_tokens` read from `usage.prompt_tokens_details`, priced at discounted rate in `lib/models.ts` |
| 11 | User brings own key (never pre-loaded) | 🟡 | `api/settings` — AES-256-GCM encrypted at rest (`lib/crypto.ts`), soft-validated with a 1-token probe |
| 12 | 3–4 latest Claude/OpenAI/Kimi models | 🟡 | `lib/models.ts` catalog w/ per-model pricing (see gaps below re: OpenRouter/Gemini test models) |
| 13 | Cost & stats page per chat | 🟡 | `api/usage` aggregation + `src/app/usage/page.tsx` — **⚠ USAGE PAGE UI NOT YET WRITTEN** (API exists, page missing!) |
| 14 | Cost split by input/output/cache tokens, per selected model | 🟡 | `usage_events` table + `computeCost()` |
| 15 | Public web URL (Heroku) | ⏳ | nothing deployed |
| 16 | Self-explanatory UX | 🟡 first pass; **full redesign to DESIGN-SYSTEM.md pending** |

## What was completed this session

1. **Repo**: git init (`main`), repo-local user `birajdarushi`, remote `origin` set. No commits yet.
2. **Scaffold**: Next.js 16.2.10 (App Router, src dir, Tailwind v4, TS), React 19, Node 22.
   `serverExternalPackages: ["pdfkit"]` in `next.config.ts` (pdfkit .afm fonts must not be bundled).
3. **DB schema**: `supabase/migrations/0001_init.sql` — profiles (credits, paywall_passed,
   auto-created via auth trigger), api_configs (encrypted key), chats, messages,
   usage_events (token+cost columns), payments, coupon_redemptions, artifacts, RLS on
   everything, `consume_credit()` SECURITY DEFINER RPC, private `artifacts` storage bucket.
4. **Backend routes** (all Node runtime): `api/agent` (SSE agent loop w/ 15s heartbeats
   for Heroku's 55s idle window, credit consume+refund, usage/cost recording),
   `api/chats`, `api/chats/[id]`, `api/settings`, `api/billing/{order,verify,coupon}`,
   `api/me`, `api/usage`, `auth/callback`.
5. **Libs**: `lib/models.ts` (catalog+pricing), `lib/crypto.ts` (AES-GCM),
   `lib/agent/tools.ts` (Brave search w/ DuckDuckGo-HTML fallback when no
   `BRAVE_SEARCH_API_KEY`; SSRF-guarded fetch_url; PDF tool), `lib/agent/pdf.ts`,
   `lib/billing.ts`, `lib/supabase/{server,client}.ts`, `src/proxy.ts` (auth guard).
6. **UI (first pass — will be restyled)**: login, paywall (Razorpay checkout.js + coupon),
   settings (model/baseURL/key with per-model pricing hints), chat home, chat thread
   (SSE consumption, live tool steps, artifacts, minimal markdown renderer), AppShell sidebar.
7. **Docs**: this /docs set. Mascot sprite sheet copied to `docs/assets/` and `public/mascots/`.

## NOT done — ordered work queue for next session

1. **`src/app/usage/page.tsx` is missing** — the API (`/api/usage`) exists but the page
   was never written (session was interrupted mid-UI). Build it per DESIGN-SYSTEM.md
   (StatsWidget bento grid + per-chat table with input/output/cached token & cost columns).
2. **Full redesign to DESIGN-SYSTEM.md** — the current UI uses placeholder indigo/emoji
   styling that **violates the design spec** (no emojis allowed, amber accent, Outfit/
   Inter/JetBrains Mono fonts, lucide-react icons, data-testid attributes, mascots).
   Every page needs a pass. Install: `lucide-react`, `sonner`; load fonts via
   `next/font/google` (Outfit, Inter, JetBrains_Mono).
3. **Custom model escape hatch**: settings only allows catalog models. For testing with
   OpenRouter free models (e.g. `moonshotai/kimi-k2:free`, `z-ai/glm-4.5-air:free`) and
   Gemini (`gemini-2.5-flash` via `https://generativelanguage.googleapis.com/v1beta/openai/`),
   add: (a) an "Advanced: custom model id" text input in settings, (b) catalog entries
   or price-passthrough for those (unknown models already record tokens with cost 0 —
   acceptable, but `getModel()` substring matching already maps
   `anthropic/claude-*`-style OpenRouter ids to catalog pricing).
4. **Verify `npm run build` passes** — never yet run. Expect possible issues:
   `proxy.ts` naming (Next 16 uses proxy.ts — verify export shape), tailwind v4
   class usage, ESLint strictness. Fix until clean.
5. **Provision Supabase** (task #4): owner must run `claude /mcp` → authenticate;
   then apply `0001_init.sql` via MCP `apply_migration`; enable Google+GitHub providers
   (needs OAuth client ids — see SETUP-DEPLOY.md); set Site URL + redirect URLs to the
   Heroku domain; get anon key; owner pastes `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`.
6. **`.env.local`** — create from the template in SETUP-DEPLOY.md; generate
   `APP_ENCRYPTION_KEY` (`openssl rand -hex 32`); copy Razorpay keys from `razorx.env`.
7. **Deploy to Heroku** (task #5): `heroku create micromanus` (or similar name),
   `heroku config:set` all env vars, `git push heroku main`. Procfile not yet written
   (`web: npm start` — Heroku Node buildpack auto-builds). Set `NODE_ENV`, check
   `npm start` binds `$PORT` (Next does via `next start -p $PORT`? — Heroku sets PORT
   env and `next start` respects it; verify `package.json` start script is `next start`).
8. **End-to-end smoke test** with owner's OpenRouter free-model key + Gemini key
   (TESTING.md checklist), then friend-test, then email URL to Siddarth.
9. **Commit + push to GitHub** — remember `Co-Authored-By: Claude Fable 5` trailer;
   NEVER commit `razorx.env`/`.env.local` (already gitignored — verify with `git status`).

## Known gaps / risks / decisions on record

- **Payment currency**: defaults to INR ₹425 (`PAYWALL_CURRENCY`/`PAYWALL_AMOUNT` env
  override to USD 500 if desired). Rationale: Razorpay test accounts reliably support
  INR; USD needs international payments enabled. Display says "₹425 (≈ $5)".
- **Search provider**: Brave API used only if `BRAVE_SEARCH_API_KEY` set; otherwise a
  DuckDuckGo HTML-scrape fallback (works keyless but brittle — get a free Brave key
  before submission; owner action, 2 min at brave.com/search/api).
- **Agent responses are not token-streamed** — deliberate: non-streamed completions per
  iteration + SSE step events. Robust across providers (usage reporting in streaming
  mode is inconsistent across OpenAI-compat providers). UX still shows live steps.
- **Anthropic direct keys**: Anthropic's OpenAI-compat endpoint is
  `https://api.anthropic.com/v1` — works with the `openai` npm client. Kimi:
  `https://api.moonshot.ai/v1`. Both listed as hints in settings.
- **usage_events granularity**: one row per agent run (aggregated across loop
  iterations), not per LLM call. Satisfies the rubric; simpler.
- **Credit refund**: on agent hard-failure before any answer, credit is refunded via
  `consume_credit(user, -1)`.
- **tool_calls typing**: `api/agent` pushes `msg.tool_calls` back verbatim; typed loosely
  — if the build complains about `ChatCompletionMessageToolCall` vs param types, cast.
- **Heroku SSE**: initial response must start <30s (we emit a status event immediately);
  15s heartbeats prevent the 55s idle reset. Long single LLM calls are therefore safe.
- **`.mcp.json`** is committed-safe (no secrets — just the Supabase MCP URL).

## Owner (human) action items — ask when needed

- [ ] Run `claude /mcp` → authenticate Supabase MCP (needed before migrations).
- [ ] Paste `SUPABASE_SERVICE_ROLE_KEY` (+ anon key if MCP can't fetch) into `.env.local`.
- [ ] Create Google OAuth client + GitHub OAuth app (callback:
      `https://oqavfibixcidikoadmge.supabase.co/auth/v1/callback`) and enter them in
      Supabase dashboard → Auth → Providers.
- [ ] (Recommended) Free Brave Search API key → `BRAVE_SEARCH_API_KEY`.
- [ ] Provide OpenRouter + Gemini test keys at test time (entered through the app UI
      like a real user would — do NOT bake into env).
- [ ] Friend-test the deployed URL before emailing Siddarth.
