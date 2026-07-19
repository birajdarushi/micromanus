# ARCHITECTURE

One Next.js 16 (App Router) app serves UI + API. Supabase provides auth (Google/GitHub
OAuth), Postgres (RLS), and Storage (PDF artifacts). Razorpay handles payments (test
mode). The LLM is whatever OpenAI-compatible endpoint + key the **user** configures —
the app never ships a key. Deployed as a single Heroku web dyno (long-lived Node
process → SSE streaming works, no serverless timeout).

```
Browser ──(cookies/Supabase session)── Next.js on Heroku
   │                                        │
   │  SSE /api/agent  ◄──────────────┐      ├── Supabase Postgres (RLS)  ─ profiles/chats/messages/usage_events/payments…
   │                                 │      ├── Supabase Storage (artifacts bucket, signed URLs)
   │                                 │      ├── Razorpay REST (orders) + checkout.js (client)
   │                            agent loop  ├── Brave Search API (or DDG fallback)
   │                                 └──────┴── User's LLM endpoint (OpenAI-compatible)
```

## Auth & routing

- Supabase SSR cookies; `src/proxy.ts` (Next 16 proxy = middleware) refreshes the
  session on every request and enforces: unauthenticated → `/login`; authenticated
  hitting `/login` → `/chat`. Paywall/credits are enforced **server-side in APIs**
  (`/api/agent` checks `paywall_passed` and runs `consume_credit`), not just by client
  redirects — UI redirects are UX, API checks are the security boundary.
- OAuth flow: `signInWithOAuth({provider, redirectTo: origin+"/auth/callback"})` →
  `auth/callback/route.ts` exchanges the code → redirects to `/paywall` or `/chat`
  based on `profiles.paywall_passed`.
- `profiles` row is auto-created by a `SECURITY DEFINER` trigger on `auth.users` insert.

## Data model (see `supabase/migrations/0001_init.sql`)

- `profiles(id→auth.users, credits, paywall_passed)` — writes only via service role.
- `api_configs(user_id, base_url, api_key_encrypted, default_model)` — key is
  AES-256-GCM encrypted with `APP_ENCRYPTION_KEY` (server env); users can read their
  row (RLS) but the ciphertext is useless client-side; the API only ever returns a
  masked preview (`sk-ab…wxyz`).
- `chats(id, user_id, title, model)` / `messages(id, chat_id, role, content jsonb)` —
  `content = {text, steps?, artifacts?}`; RLS full-access to owner.
- `usage_events` — one row per agent run: input/output/cached token counts + the four
  cost columns (input/output/cached/total USD). Written by service role.
- `payments` (unique `order_id`, status created→paid guards double-grant),
  `coupon_redemptions` (unique (user, code)), `artifacts` (storage path registry).
- `consume_credit(uuid, int)` — atomic `UPDATE … WHERE credits >= amount RETURNING`,
  returns -1 on insufficient; negative amount = refund. All credit mutation goes
  through this or the billing routes; never trust the client.

## The agent loop (`src/app/api/agent/route.ts`)

1. Auth → chat ownership → paywall check → **consume 1 credit** (atomic; refunded if
   the run fails before producing any answer).
2. Decrypt the user's key; construct `new OpenAI({apiKey, baseURL})` with the chat's
   model (fixed per chat at creation from the user's default).
3. Rebuild conversation: stable system prompt (byte-identical every run → provider
   prompt-cache-friendly prefix) + last 40 persisted turns + new user message.
4. Loop (≤12 iterations): non-streamed `chat.completions.create` with `tools` →
   if `tool_calls`: emit SSE `tool_call`, execute (`web_search` / `fetch_url` /
   `create_pdf_report`), emit `tool_result` (+`artifact`), append `role:"tool"`
   messages, repeat. Else: that's the final answer.
5. Accumulate `usage` across iterations (incl. `prompt_tokens_details.cached_tokens`),
   `computeCost()` per the model catalog, persist assistant message
   (+steps+artifacts) and one `usage_event` row. Emit SSE `done` with usage/cost.

**SSE protocol** (`data: {json}\n\n`): `status`, `thought`, `tool_call{tool,args}`,
`tool_result{tool,summary}`, `artifact{id,filename,url}`, `done{text,artifacts,usage,
cost,creditsRemaining}`, `error{message}`. Comment frames `: ping` every 15s keep
Heroku's 55s idle-connection window open during long model calls. The client
(`ChatWindow.tsx`) parses frames incrementally from `res.body.getReader()`.

**Why non-streamed completions inside the loop:** token-streaming + tool-call
assembly + usage reporting is inconsistent across OpenAI-compatible providers
(Anthropic compat, Moonshot, Gemini compat, OpenRouter). Discrete iterations with
live step events give resilient cross-provider behavior; per-step visibility keeps
the UX alive. Revisit only after everything else ships.

## Tools (`src/lib/agent/tools.ts`)

- `web_search(query, count)` — Brave API when `BRAVE_SEARCH_API_KEY` is set, else
  DuckDuckGo HTML fallback (keyless). Returns numbered title/URL/snippet list.
- `fetch_url(url)` — 15s timeout, http(s) only, SSRF guard (blocks localhost/private
  ranges/.internal), HTML→text strip, 12k char cap.
- `create_pdf_report(title, markdown)` — `lib/agent/pdf.ts` renders simple markdown
  (#/##/### , bullets, bold-strip) via pdfkit → uploads to private `artifacts`
  bucket → inserts `artifacts` row → returns 7-day signed URL. Registered as an SSE
  `artifact` event and stored on the assistant message for history.

## Billing

- **Coupon**: `POST /api/billing/coupon` — constant compare vs `COUPON_CODE`
  (default `SID_DRDROID`), unique-constraint idempotency, +5 credits,
  `paywall_passed=true`.
- **Card**: `POST /api/billing/order` creates a Razorpay order (INR 42500 paise
  default; `PAYWALL_CURRENCY`/`PAYWALL_AMOUNT` env overrides) and a `payments` row →
  client opens checkout.js → `POST /api/billing/verify` recomputes
  `HMAC_SHA256(order_id|payment_id, key_secret)` with `timingSafeEqual`, flips the
  payments row created→paid (idempotent), grants +5 credits.
- **Metering**: 1 credit per agent run. Cost tracking (USD) is informational —
  the product bills credits, the stats page shows real LLM cost.

## Model catalog & cost (`src/lib/models.ts`)

Per-model USD/1M pricing: input, output, cachedIn. `computeCost` prices
`(input - cached)` at input rate, `cached` at the discounted cache rate, output at
output rate. `getModel()` also substring-matches router-style ids
(`anthropic/claude-sonnet-4-6` → catalog entry). Unknown models record tokens with
$0 cost (visible, not wrong). Catalog: Claude Opus 4.8 / Sonnet 4.6 / Haiku 4.5,
GPT-5.1 / GPT-5 / GPT-5-mini / GPT-4.1, Kimi K2 Thinking / K2 0905 / kimi-latest.

## Security posture

- User LLM keys: AES-256-GCM at rest, decrypted only inside `/api/agent` and the
  settings probe; masked preview in GET.
- RLS everywhere; mutations that matter (credits, usage, payments, configs) go
  through the service role on the server.
- Razorpay signature verification with timing-safe compare; order↔user binding
  checked; double-grant guarded twice (status transition + unique order).
- SSRF guard on `fetch_url`; artifacts bucket private w/ signed URLs; secrets only in
  env; `razorx.env`/`.env.local` gitignored.

## Observability / ops

- Heroku: `heroku logs --tail` for request + console logs. Agent route logs errors to
  console; SSE `error` events surface to the UI.
- `usage_events` doubles as a trace: per-run model, tokens, cost, timestamps.
- Future (nice-to-have, post-submission): request ids per agent run, per-iteration
  `usage_events` granularity, Sentry.
