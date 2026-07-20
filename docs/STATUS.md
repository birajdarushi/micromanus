# STATUS — single source of truth (update this file every session)

_Last updated: 2026-07-20 (session 5 — notifications/bg banner, image_search, PostHog, welcome email, agent prompt; build green. See SESSION-5-HANDOFF.md)._

## Session 5 — remaining enhancements (build-verified)

- ✅ **Track C:** reliable completion notifications + “research in progress” strip + “finished while away” banner (`lib/notify.ts`, ChatWindow).
- ✅ **image_search** tool (Wikimedia Commons) + system-prompt rules; PDF renderer already embeds images.
- ✅ **Agent loop** prompt: plan → multi-search → read → reflect → synthesize.
- ✅ **PostHog** (ClickHouse-backed) env-gated client analytics; identify user; agent run events.
- ✅ **Welcome HTML email + admin signup notify** via Gmail SMTP (env-gated; auth callback).
- ⏳ **Deploy** still pending; large uncommitted tree since `724f12f`.
- ⏳ Owner must paste optional: `NEXT_PUBLIC_POSTHOG_KEY`, `GMAIL_USER`/`GMAIL_APP_PASSWORD`, recommended `BRAVE_SEARCH_API_KEY`.

## Session 3b — live testing fixes & UX (all built + build-verified)
- **Own SVG mascots** (`components/Mascot.tsx`) — hand-drawn animated glow-blobs (float/blink/glow + per-state accessory: gear spins, globe rotates, dots twinkle, bars pulse). Replaced the PNG sprite system; old sliced PNGs deleted. Persistent animated avatar now sits next to each answer; the live avatar cycles tool-states.
- **Day/night mode** — `ThemeToggle` + mirrored zinc ramp in globals.css (Tailwind v4 vars); no-flash inline script.
- **Credits**: confirmed NO leak (5 coupon + 5 paid = 10 granted, 10 successful runs = 0). Real cause of "idle drain" was a stale sidebar count → now refreshes on every run outcome. Still flat 1-credit/run by design; actual $ cost tracked separately on usage page. Gemini added to pricing catalog so usage costs compute.
- **Agent robustness**: validate API key is ASCII before charging a credit (a prompt was pasted into the key field → ByteString crash); 429/503 retry with backoff; clear status-mapped errors (rate-limit / model-not-found / bad-key); settings auto-strips a trailing `/chat/completions` from base URL.
- **Chat UX**: collapsible thinking loop; markdown **tables** (web + PDF) and *italics*; Sources card (links used); PDF report structure overhaul (system prompt + header rule + tables + page numbers); artifact card = explicit Download button; per-chat ModelPicker moved into the composer; centered composer on empty chats; rename chat + in-app delete/rename modals (no native alert); buy-more-credits button (sidebar + usage).
- **Model fixes**: Gemini `gemini-2.5-flash` deprecated → use `gemini-flash-latest`; OpenRouter Hy3 = `tencent/hy3:free` (free tier ends 2026-07-21).
- ❗ Still TODO: commit + push to Heroku; deploy not done. `emergent styles` file at repo root is empty (0 bytes).


## ▶ DO THIS FIRST on next session — resume checklist

Supabase is now fully provisioned via MCP. Project ref: **oqavfibixcidikoadmge**,
URL `https://oqavfibixcidikoadmge.supabase.co`. Remaining path to a live app:

1. ❗ **OWNER: paste `SUPABASE_SERVICE_ROLE_KEY`** into `.env.local` (dashboard → Settings →
   API → service_role). This is the ONLY hard blocker left for deploy — the app's admin client
   (`createSupabaseAdmin`) needs it for credit grants, usage writes, message persistence. No MCP
   tool exposes it. `NEXT_PUBLIC_SUPABASE_ANON_KEY` + URL are already filled and verified.
2. ❗ **OWNER: confirm Supabase Auth URL config** (dashboard → Auth → URL Configuration):
   Site URL = `https://micromanus-sid-8b56d69b5666.herokuapp.com`; Additional Redirect URLs =
   `https://micromanus-sid-8b56d69b5666.herokuapp.com/auth/callback` + `http://localhost:3000/auth/callback`.
   (Not doable via MCP.) OAuth Google+GitHub providers already enabled by owner.
3. Local smoke: `npm run dev`, hit /login (once service_role key is in).
4. Push env to Heroku: `heroku config:set $(grep -v '^#' .env.local | xargs) -a micromanus-sid`.
5. Deploy: `git push https://git.heroku.com/micromanus-sid.git master:main` (local branch is
   `master`; Heroku default is `main` — push master→main). Watch `heroku logs --tail`.
6. Run TESTING.md end-to-end on the live URL (owner provides OpenRouter + Gemini keys via the app UI).
7. Remaining build work (does NOT need the service_role key — can proceed anytime): **usage page**
   (`src/app/usage/page.tsx` still missing), **full DESIGN-SYSTEM.md redesign**, custom-model
   escape hatch in settings.

## Session 3 progress (Supabase provisioning — DONE)

- ✅ Confirmed Supabase MCP tools load; project `oqavfibixcidikoadmge` reachable.
- ✅ Applied `0001_init.sql` via MCP `apply_migration`. Verified all 8 tables exist with RLS
  enabled, `artifacts` storage bucket exists (private), `on_auth_user_created` trigger + both
  functions (`consume_credit`, `handle_new_user`) present.
- ✅ **Security hardening** — `0002_lock_down_functions.sql`: `get_advisors(security)` flagged that
  `consume_credit`/`handle_new_user` (SECURITY DEFINER) were EXECUTE-able by `anon`/`authenticated`.
  A signed-in user could POST `/rest/v1/rpc/consume_credit` with a negative `p_amount` to grant
  themselves unlimited credits. Revoked EXECUTE from public/anon/authenticated, granted to
  service_role only (the app only ever calls it via the admin client). Advisors now clean (0 lints).
- ✅ Filled `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy anon JWT) in `.env.local`; URL already matched.
- ✅ `npm run build` passes clean (exit 0).

## Session 2 progress

- `heroku create micromanus-sid` → app + URL reserved: **https://micromanus-sid-8b56d69b5666.herokuapp.com**
  (git remote `https://git.heroku.com/micromanus-sid.git`). Buildpack set to `heroku/nodejs`.
- Added `Procfile` (`web: npm start -- -p $PORT`) and `"engines": {"node": "22.x"}` in `package.json`.
- `npm run build` verified clean (Turbopack, no env vars needed at build time — Supabase/crypto
  env access is all lazy, at request time).
- First commit made (`511cba9`, root commit on `master` — note: branch is `master`, not `main`).
- `.env.local` created (gitignored) with Razorpay keys + generated `APP_ENCRYPTION_KEY` filled in;
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` still **blank** — Supabase MCP is
  not yet authenticated in this session (owner must authenticate the Supabase MCP), so these can't be fetched
  yet. **Not pushed to Heroku yet** — proxy.ts reads the Supabase URL/anon key on every request
  (middleware), so deploying now would 500 on every route until those two keys are set.

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
| 13 | Cost & stats page per chat | 🟡 code done (session 3) | `api/usage` aggregation + `src/app/usage/page.tsx` — totals bento + per-chat table w/ input/output/cached token & cost-split columns. Build verified; not yet exercised with real data |
| 14 | Cost split by input/output/cache tokens, per selected model | 🟡 | `usage_events` table + `computeCost()` |
| 15 | Public web URL (Heroku) | ⏳ | nothing deployed |
| 16 | Self-explanatory UX | 🟡 code done (session 3) — full DESIGN-SYSTEM.md redesign applied to every page (obsidian+amber, Outfit/Inter/JetBrains, lucide icons, mascots, data-testid, sonner). Build green; pending human visual review |

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

1. ~~**`src/app/usage/page.tsx` is missing**~~ ✅ DONE (session 3) — built with the totals
   stat-card grid + per-chat table (runs, input/output/cached tokens, in/out/cache/total cost),
   matching the current app styling. Will get restyled in the full DESIGN-SYSTEM.md redesign pass.
2. ~~**Full redesign to DESIGN-SYSTEM.md**~~ ✅ DONE (session 3). Installed `lucide-react` +
   `sonner`. Fonts loaded via `next/font/google` (Outfit→`font-heading`, Inter→`font-sans`,
   JetBrains Mono→`font-mono`) wired into Tailwind v4 `@theme inline` in globals.css; dark forced
   (`dark` class + obsidian body). Amber-400 accent everywhere (all indigo removed). All emojis
   replaced with lucide icons (stroke 1.5). `data-testid` on every interactive element. sonner
   toasts (bottom-right). **Mascots**: sliced the sprite sheet into 20 named PNGs in
   `public/mascots/` (one-off `sharp` script, trim+centre, rendered with `.mascot`
   `mix-blend-screen` so the near-black drops out). New `src/components/Mascot.tsx`. Pages redone:
   login (idle hero + full-bleed bg), paywall (lock + PaywallCard glass), chat home (idle),
   chat window (**AgentThinkingLoop** timeline w/ amber pulsing dot + collapsible observations,
   spec chat bubbles, light `ArtifactCard_PDF` w/ FileText, live mascot swap per tool), usage
   (StatsWidget grid + stats mascot), settings (gear + amber). Build green; dev server renders
   /login 200, mascots serve, middleware auth-guard 307s /paywall, dev log clean. **Not yet
   visually reviewed in a browser by a human** — recommend a quick look once deployed.
3. ~~**Custom model escape hatch**~~ ✅ DONE (session 3) — settings page now has an "Advanced:
   custom model id" checkbox that swaps the catalog `<select>` for a free-text model-id input
   (base URL was already free text). Effective model is sent to `/api/settings` (backend already
   accepted arbitrary ids). On reload, a saved model not in the catalog auto-restores custom mode.
   UI hints OpenRouter free ids + the Gemini OpenAI-compat endpoint. Unknown ids → tokens tracked,
   cost $0 (per `getModel()`/`computeCost()`). Build verified.
4. **Verify `npm run build` passes** — never yet run. Expect possible issues:
   `proxy.ts` naming (Next 16 uses proxy.ts — verify export shape), tailwind v4
   class usage, ESLint strictness. Fix until clean.
5. **Provision Supabase** (task #4): owner must authenticate the Supabase MCP → authenticate;
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

- [ ] Run `authenticate the Supabase MCP` → authenticate Supabase MCP (needed before migrations).
- [ ] Paste `SUPABASE_SERVICE_ROLE_KEY` (+ anon key if MCP can't fetch) into `.env.local`.
- [ ] Create Google OAuth client + GitHub OAuth app (callback:
      `https://oqavfibixcidikoadmge.supabase.co/auth/v1/callback`) and enter them in
      Supabase dashboard → Auth → Providers.
- [ ] (Recommended) Free Brave Search API key → `BRAVE_SEARCH_API_KEY`.
- [ ] Provide OpenRouter + Gemini test keys at test time (entered through the app UI
      like a real user would — do NOT bake into env).
- [ ] Friend-test the deployed URL before emailing Siddarth.
