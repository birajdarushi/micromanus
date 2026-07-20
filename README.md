# MicroManus

Deep-research AI agent web app: social login, usage credits, bring-your-own OpenAI-compatible API key, think→search→read→report loop, PDF artifacts, cost tracking.

**Live:** https://rushiraj.birajdar.in  
**Stack:** Next.js 16 · React 19 · Supabase · Razorpay · Heroku · PostHog (optional)

---

## Features

- Google / GitHub login (Supabase Auth)
- Paywall: coupon `SID_DRDROID` or Razorpay → 5 credits (1 credit = 1 agent run)
- BYO LLM key (AES-GCM at rest) + model catalog with cost estimates
- Agent tools: `web_search`, `fetch_url`, `image_search`, `think`, `create_pdf_report`
- PDF reports (pdfkit) stored in private Supabase Storage — **retained 3 days**, **max 10 PDFs / user / day**
- In-chat progress survives tab close (server persists steps; client polls on return)
- Usage page: tokens + $ cost by input / output / cache
- Reports library, collapsible sidebar, day/night + accent themes

---

## Local development

```bash
npm install
# fill .env.local (see docs/SETUP-DEPLOY.md)
npm run dev     # http://localhost:3000
npm run build   # must pass before deploy
```

Node **22.x** required (`package.json` engines).

---

## Deploy (Heroku)

App name: **`micromanus-sid`**

```bash
heroku config:set $(grep -v '^#' .env.local | xargs) -a micromanus-sid
git push https://git.heroku.com/micromanus-sid.git master:main
```

Custom domain: `rushiraj.birajdar.in` (CNAME → Heroku DNS target).  
After domain change, update Supabase **Site URL** + redirect URLs.

Details: [docs/SETUP-DEPLOY.md](./docs/SETUP-DEPLOY.md)

---

## Docs

| File | Purpose |
|---|---|
| [docs/SETUP-DEPLOY.md](./docs/SETUP-DEPLOY.md) | Env vars, OAuth, domain, Heroku |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design |
| [docs/TESTING.md](./docs/TESTING.md) | Acceptance checklist |
| [docs/STATUS.md](./docs/STATUS.md) | What’s done / pending |
| [docs/DESIGN-SYSTEM.md](./docs/DESIGN-SYSTEM.md) | UI language |

---

## Pricing notes

Catalog prices live in `src/lib/models.ts` (`PRICING_AS_OF`).  
Claude (Anthropic) and GPT (OpenAI) rates are reviewed periodically against public list prices for the Usage page estimates.

---

## License

Private assignment project.
