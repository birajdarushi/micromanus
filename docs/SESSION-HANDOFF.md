# SESSION HANDOFF — MicroManus

_Generated 2026-07-20 (end of session 3). Companion to `docs/STATUS.md` (the living source of truth). Read this to understand everything that happened across this long session and exactly where to resume._

---

## 0. TL;DR — resume in 60 seconds

- **What it is:** MicroManus — a deep-research AI agent (DrDroid assignment). Next.js 16 App Router + Supabase + OpenAI-compatible BYO-key agent loop + Razorpay billing.
- **State:** Fully built and **runs locally** (dev server green). Supabase is **provisioned + hardened**. **Not deployed** to Heroku yet.
- **The one thing before deploy:** nothing blocking anymore — env is complete. Just needs local sign-off → push env to Heroku → `git push …master:main`.
- **Uncommitted work:** the final UX batch (avatar-on-last, focus fixes, create-on-send, notifications, hover, prompt) is **NOT committed**. Everything before it is committed as `724f12f`.
- **Test user:** `it.rushiraj@gmail.com` (uuid `edfc1fb9-c650-4876-9ffb-2966abb4dfe4`), currently **0 credits** (all 10 legitimately spent).

---

## 1. Project facts & credentials

| Thing | Value |
|---|---|
| Supabase project ref | `oqavfibixcidikoadmge` |
| Supabase URL | `https://oqavfibixcidikoadmge.supabase.co` |
| Heroku app | `micromanus-sid` → `https://micromanus-sid-8b56d69b5666.herokuapp.com` (reserved, **not deployed**) |
| Heroku git remote | `https://git.heroku.com/micromanus-sid.git` (push `master:main`) |
| Local branch | `master` (Heroku default is `main`) |
| Coupon (paywall bypass) | `SID_DRDROID` |
| Paywall price | INR ₹425 (`PAYWALL_AMOUNT=42500`, `PAYWALL_CURRENCY=INR`) |
| Git commits | `511cba9` initial scaffold · `724f12f` session-3 batch (provisioning+redesign+mascots+fixes) |

### `.env.local` (gitignored — all filled except Brave)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `COUPON_CODE`, `PAYWALL_CURRENCY`, `PAYWALL_AMOUNT` — **all set**. `BRAVE_SEARCH_API_KEY` — **blank** (agent falls back to DuckDuckGo HTML scrape; get a free Brave key before submission for reliability).

### Owner (human) actions still open
- [ ] Confirm Supabase **Auth → URL Configuration**: Site URL = Heroku domain; Redirect URLs must include `https://micromanus-sid-8b56d69b5666.herokuapp.com/auth/callback` **and** `http://localhost:3000/auth/callback` (needed for local OAuth login).
- [ ] (Recommended) free **Brave Search API key** → `BRAVE_SEARCH_API_KEY`.
- [ ] Google + GitHub OAuth providers: reported **already enabled**.

---

## 2. Database state (Supabase, live)

- Migrations applied via MCP: `0001_init.sql` (schema) + `0002_lock_down_functions.sql` (security).
- **8 tables**, all RLS-enabled: `profiles, api_configs, chats, messages, usage_events, payments, coupon_redemptions, artifacts`.
- Private storage bucket **`artifacts`** exists. Auth trigger `on_auth_user_created` + functions `handle_new_user`, `consume_credit` present.
- **Security advisors: clean (0 lints).** `0002` revoked EXECUTE on the SECURITY DEFINER functions from `anon`/`authenticated` (a signed-in user could otherwise POST `/rest/v1/rpc/consume_credit` with a **negative amount to grant themselves unlimited credits**) — now `service_role` only.
- **Test data:** 1 profile (`it.rushiraj@gmail.com`, credits **0**). 10 `usage_events` (9× `tencent/hy3:free`, 1× `gemini-flash-latest`). Some empty chats exist from testing (pre create-on-send). Credit math verified exact: 5 coupon + 5 paid = 10 granted; 10 successful runs = 0 left. **No leak.**

---

## 3. Requirement ledger (assignment → state)

All 16 requirements **code-complete** and build-verified; end-to-end tested locally against real OpenRouter/Gemini keys. Only #15 (public deploy) is outstanding.

1. Social login (Google/GitHub) — ✅ code; providers enabled
2. Paywall + coupon `SID_DRDROID` — ✅
3. Real card payment (₹425 Razorpay test) → 5 credits — ✅
4. 5 credits either way; 1 credit/run; atomic `consume_credit` + refund on failure — ✅
5. Chat UI w/ internet + threads — ✅
6. Context within a chat (history replay, 40 turns) — ✅ (user confirmed working)
7. Agent loop think→tool→observe (max 12 iters) — ✅
8. New chats — ✅ (now **create-on-first-send**)
9. PDF report artifact (pdfkit → Storage → 7-day signed URL) — ✅
10. Prompt caching (stable prefix, `cached_tokens` priced) — ✅
11. BYO key, never preloaded, AES-256-GCM at rest — ✅
12. 3–4 latest Claude/OpenAI/Kimi models + Gemini — ✅
13. Cost & stats page per chat — ✅ (`/usage`)
14. Cost split by input/output/cache per model — ✅
15. **Public web URL (Heroku)** — ⏳ **not deployed**
16. Self-explanatory UX + full DESIGN-SYSTEM redesign — ✅

---

## 4. What happened this session (chronological)

### 4a. Provisioning
- Confirmed Supabase MCP; applied `0001`; verified tables/bucket/trigger/functions.
- Ran security advisor → found + fixed the `consume_credit` negative-amount hole (`0002`).
- Wired anon key + URL; later the owner pasted the `service_role` key (verified working via admin query).

### 4b. Missing feature build
- Built `/usage` page (was missing). Added **custom-model escape hatch** in Settings (backend already accepted arbitrary model ids).

### 4c. Full DESIGN-SYSTEM.md redesign
- Fonts via `next/font/google` (Outfit→`font-heading`, Inter→`font-sans`, JetBrains→`font-mono`) wired into Tailwind v4 `@theme inline`. Forced dark obsidian, amber-400 accent (all indigo removed), lucide icons (no emojis), `data-testid` everywhere, `sonner` toasts.
- Every page redone: login, paywall, chat home, ChatWindow (AgentThinkingLoop timeline, chat bubbles, light ArtifactCard), usage (StatsWidget), settings, AppShell.

### 4d. Live testing — bugs found & fixed (this is the bulk)
- **API key crash** (`ByteString`): user pasted a *prompt* into the key field → non-ASCII in the Authorization header. Added ASCII validation in Settings + agent (before charging a credit). 
- **Model frozen per-chat**: chat created before settings saved kept `claude-opus-4-8` (catalog[0] fallback) against an OpenAI endpoint → added a **PATCH endpoint + per-chat ModelPicker**.
- **Gemini 404**: `gemini-2.5-flash` is deprecated for new accounts → use **`gemini-flash-latest`** (verified w/ tool calling). Added Gemini to the pricing catalog.
- **Free-tier 429s**: added **retry-with-backoff** on 429/503 + clear status-mapped errors (rate-limit / not-found / bad-key).
- **OpenRouter Hy3**: base URL must be `https://openrouter.ai/api/v1` (client appends `/chat/completions` — settings now auto-strips it); model id is **`tencent/hy3:free`** (free tier ends **2026-07-21**).
- **"Credits vanished while idle"**: NOT a leak — stale sidebar count. Now refreshes on every run outcome.
- Chat UX: collapsible thinking loop, markdown **tables** (web+PDF) + **italics**, **Sources card**, structured PDF reports (header rule, tables, page numbers), explicit PDF Download button, composer model picker, **centered empty-state composer**, rename chat, **in-app delete/rename modals** (no browser alert), buy-more-credits button.
- **Own animated SVG mascots** (replaced the PNG sprite sheet): `components/Mascot.tsx`, glow-blob body + per-state accessory, animated via `mm-*` keyframes (float, blink, glow pulse, gear spin, globe rotate, twinkle, bar pulse); hover scale 1.15×; **persistent avatar next to the last answer** (cycles tool-states while working).
- **Day/night mode**: `ThemeToggle` + mirrored zinc ramp (Tailwind v4 vars), no-flash inline script.
- **Create-on-first-send**: "New chat" opens a **draft** (no DB row); the chat is created on first send via `history.replaceState` (no remount) → no empty chats.
- **Browser notifications** on completion when tab hidden.
- Stronger **research system prompt** (multi-query, read 2–3+ sources, corroborate, synthesize, cite).

---

## 5. Uncommitted work ⚠️

`724f12f` includes everything through §4c and most of §4d. **NOT yet committed** (the final batch):
- ChatWindow: avatar-only-on-last, focus retention + autofocus + type-to-focus, create-on-first-send draft mode, browser notifications, composer border cleanup + removed duplicate chevron.
- `app/chat/page.tsx` rewritten as the draft compose screen; `app/chat/[id]/page.tsx` prop `chatId`→`initialChatId`.
- AppShell: "New chat" → `router.push("/chat")` (no API), removed `creatingChat`.
- globals.css: mascot hover scale.
- agent route: strengthened research prompt.

**Next session: commit this batch.** Build is green; dev server verified. Suggested message continues the session-3 theme. Remember trailers:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CZG9zA3D4SF4phWn91qCSL
```

---

## 6. Architecture & key decisions (gotchas)

- **AGENTS.md rule:** "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing Next code; APIs may differ from training data. `src/proxy.ts` is the middleware (Next 16 naming).
- **Agent is non-streamed per iteration** (SSE step events, not token streaming) — deliberate, robust across OpenAI-compat providers whose streaming usage reporting is inconsistent. 15s SSE heartbeats keep Heroku's 55s idle window open.
- **Run persists server-side**: the assistant message + usage are written to DB in the ReadableStream `start()` regardless of client connection, so **closing the tab doesn't lose the result** (loop keeps running, writes on `done`). True detached background queue (survive full logout / instant push) would be a larger change.
- **Credits are flat 1/run** by design (assignment: 5 credits = 5 runs). Real $ cost is tracked separately per model on `/usage`. Switching to cost-based debit is an open option the user floated.
- **`getModel()`** substring-matches so router-prefixed ids (`anthropic/claude-*`) map to catalog pricing; unknown ids record tokens with cost 0.
- **Encryption**: `lib/crypto.ts` AES-256-GCM; `APP_ENCRYPTION_KEY` = 64-hex (32 bytes).
- **Search provider**: Brave if `BRAVE_SEARCH_API_KEY` set, else DuckDuckGo HTML scrape (keyless, brittle).
- **Mascots**: now pure SVG (`components/Mascot.tsx`) — the old `public/mascots/*.png` sliced sprites were **deleted**; only `sprite-sheet.png` (source) remains. `.mm-*` animation classes live in `globals.css`.
- **Theme**: Tailwind v4 utilities resolve to `var(--color-zinc-*)`; light mode = mirrored ramp under `html[data-theme="light"]`. Login/paywall keep their dark background image regardless.
- **`emergent styles`** file at repo root is an **empty 0-byte file** (user referenced "@emergent" but there's no content); gitignored.

---

## 7. Deploy checklist (when ready)

1. Local sign-off: `npm run dev`, full flow (login → coupon `SID_DRDROID` → add key → chat → PDF → /usage).
2. Confirm Supabase Auth redirect URLs include the Heroku domain (§1).
3. `npm run build` (green).
4. `heroku config:set $(grep -v '^#' .env.local | xargs) -a micromanus-sid`
5. `git push https://git.heroku.com/micromanus-sid.git master:main` — watch `heroku logs --tail`.
6. Run `docs/TESTING.md` end-to-end on the live URL.
7. Friend-test, then email the URL to Siddarth.

---

## 8. Open items / user's outstanding asks

- **Deploy to Heroku** (#15) — the only remaining requirement.
- **Commit the §5 batch.**
- **"Literal spinning avatar"** — currently animated (float/blink) + state-cycling while working; user may want a literal continuous spin (one-line change).
- **Cost-based credits** — user asked whether to debit by actual model cost instead of flat 1/run. Awaiting decision.
- **Full Perplexity-style tabbed layout** — user clarified they only wanted the centered composer + composer model-picker + Sources card (all done), NOT the full Answer/Links/Images tabs.
- **True background runs** (survive logout, push notify) — partial today (survives tab close). Bigger change if they want full detach.
- **Brave key** for reliable search.
