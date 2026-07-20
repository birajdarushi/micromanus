# Session handoff — MicroManus

_Written: 2026-07-21 · HEAD: `157848c` · Heroku: `micromanus-sid` **v35**_

Use this when resuming work. Permanent product state lives in [STATUS.md](./STATUS.md); this file is the latest conversation context.

---

## Snapshot

| Item | Value |
|------|--------|
| **Live** | https://rushiraj.birajdar.in |
| **GitHub** | https://github.com/birajdarushi/micromanus (`master`) |
| **Heroku** | `micromanus-sid` → v35 @ `157848c` |
| **Git tip** | `157848c` feat(search): prefer SerpAPI Google results for web_search |
| **Working tree** | Clean (billing fix commits were force-removed) |

---

## What this product is

Deep-research AI agent: social login → paywall (coupon / Razorpay test) → BYO OpenAI-compatible key → multi-chat agent loop (search → fetch → think → PDF) → usage/cost tracking.

**Assignment objective (met):** functional deep research agent + usage-based billing (credit-gated runs + token/$ metering on Usage page). Not exact pass-through of OpenAI $ when user uses BYO key.

---

## Shipped recently (this arc)

1. **SerpAPI-first web search** — `src/lib/agent/tools.ts`  
   Order: **SerpAPI** → Brave → DuckDuckGo HTML. Env: `SERPAPI_API_KEY`.
2. **Pricing refresh** — Claude/OpenAI catalog in `src/lib/models.ts` (`PRICING_AS_OF` ~2026-07-20).
3. **Artifacts** — 3-day retention; **10 PDFs / user / day**.
4. **Agent progress** — server persists steps; client polls so progress survives tab close.
5. **UI** — shared `(app)` AppShell (no full remount on nav); expandable observations; brand favicon `/mm-*?v=mm3`.
6. **Auth/domain** — custom domain `rushiraj.birajdar.in`; OAuth `?code=` routed via proxy to `/auth/callback`.

---

## Intentionally NOT in repo (reverted)

Two commits were made while debugging payments, then **force-removed** from GitHub + Heroku because **Razorpay was temporarily down**, not app code:

- ~~`7db2531` surface Razorpay order errors~~
- ~~`e80d14c` externalize razorpay / harden paywall~~

Do **not** re-land those unless a real billing bug reappears. Current code path is the original order/verify flow.

**Payment history (logs):** coupon 200; full pay path worked earlier same day (order + verify 200); later order POSTs 500 while Razorpay degraded; keys OK (order create succeeds from dyno). Unpaid leftover row: order `order_TFnTiq3oQL5ZFo` status `created` (abandoned checkout).

---

## Env (Heroku `micromanus-sid`) — important notes

| Var | Notes |
|-----|--------|
| `SERPAPI_API_KEY` | Set to user-provided key; **SerpAPI API rejects it as Invalid**. Search falls back to Brave/DDG until a valid key from https://serpapi.com/manage-api-key |
| `RAZORPAY_KEY_ID` / `SECRET` | Test mode; working when Razorpay is up |
| `PAYWALL_AMOUNT` / `CURRENCY` | `42500` / `INR` |
| `COUPON_CODE` | Default `SID_DRDROID` |
| Gmail SMTP | **Broken** — welcome/admin mail: `535 BadCredentials` (need valid Gmail App Password) |
| PostHog | Env present; **confirm events** in US project Activity |
| Supabase | Project URL in Heroku; Site URL must stay domain-aligned |

Never commit API keys. Prefer `heroku config:set … -a micromanus-sid`.

---

## Architecture pointers

| Area | Path |
|------|------|
| Agent SSE + system prompt | `src/app/api/agent/route.ts` |
| Tools (search/fetch/PDF/…) | `src/lib/agent/tools.ts` |
| Billing economics | `src/lib/billing.ts` |
| Order / verify / coupon | `src/app/api/billing/*` |
| Usage aggregation | `src/app/api/usage/route.ts` |
| Chat UX / progress poll | `src/components/ChatWindow.tsx` |
| Credits UI | `src/components/CreditTopUp.tsx` |
| Deploy / env docs | [SETUP-DEPLOY.md](./SETUP-DEPLOY.md) |
| Design | [ARCHITECTURE.md](./ARCHITECTURE.md), [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) |
| Acceptance | [TESTING.md](./TESTING.md) |

Search stack detail: SerpAPI `search.json?engine=google` organic results; on HTTP/error fall through.

Billing model: **product bills credits** (1 credit ≈ 1 agent run); **Usage page shows estimated LLM $** from tokens × catalog. BYO key → provider bills the user separately.

---

## Owner follow-ups (next session)

- [ ] Replace **SerpAPI** key with a valid one; smoke `web_search` in a live chat  
- [ ] Fix **Gmail App Password** so welcome mail works  
- [ ] Confirm **PostHog** events  
- [ ] Confirm **GitHub OAuth** if still broken (callback = Supabase `…/auth/v1/callback`)  
- [ ] Friend-run [TESTING.md](./TESTING.md) on production  
- [ ] Send Siddarth submission email (draft already iterated in chat; live URL + repo ready)  
- [ ] Optional: Brave Search key  

### Deferred product

- Starred chats / research library  
- Full mascot redesign  

---

## Submission email framing (if resuming that)

Objective met: deep research agent + usage-based billing. Frame as **product-engineering sprint** (~5–7h), not pure checklist. Extras: PostHog, traceability (agent steps), credits/nav UX, cost visibility.

Draft themes used:

- Self-test of how you ship under a tight brief  
- Critical path first: auth → paywall → research → artifact  
- Traceability, usage/cost visibility, analytics, agent-progress UX  

---

## Deploy commands (quick)

```bash
# local
npm install && npm run dev   # Node 22

# ship
npm run build
git push origin master
git push heroku master:main   # app: micromanus-sid

heroku logs -n 200 -a micromanus-sid
heroku config -a micromanus-sid
```

Git author for commits in this project: `birajdarushi` / `birajdarushi@users.noreply.github.com`.

---

## Do not

- Re-introduce removed billing “fix” commits unless payment fails with a real app error  
- Commit secrets (SerpAPI, Razorpay, service role, etc.)  
- Assume SerpAPI is live — key currently invalid at API  
- Mention or re-add Claude co-author trailers on commits  

---

## Next agent: start here

1. Read this file + [STATUS.md](./STATUS.md).  
2. If user asks for product work: check Heroku logs + live URL first.  
3. If search quality is bad: fix `SERPAPI_API_KEY` first.  
4. If payment fails: check Razorpay status / keys before changing code.  
5. Submission / email: use framing above; don’t overclaim metered $ pass-through billing.
