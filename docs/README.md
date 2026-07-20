# MicroManus — Documentation Index

**What this is:** A deep-research AI agent web app ("MicroManus") with usage-based billing.
Built as the DrDroid product-engineer assignment. The user signs up with Google/GitHub,
passes a paywall (coupon `SID_DRDROID` or Razorpay test payment → 5 credits), adds their
own OpenAI-compatible LLM key, then chats with an agent that runs a think→act→observe
loop (web search, page reading, PDF report generation) with per-chat cost/token tracking.

> **If you are an AI agent continuing this project: read `STATUS.md` first.**
> It is the single source of truth for what is done vs pending. Then `ARCHITECTURE.md`
> for how the system fits together, and `DESIGN-SYSTEM.md` before touching any UI.

| Doc | Purpose |
|---|---|
| [STATUS.md](./STATUS.md) | ✅/⏳ ledger of every requirement — what's done, what's next, known gaps |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design: data model, agent loop, billing, security, ops |
| [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) | The mandatory visual language (obsidian + amber, fonts, mascots, components) |
| [SETUP-DEPLOY.md](./SETUP-DEPLOY.md) | Runbook: Supabase provisioning, OAuth, env vars, Heroku deploy, smoke tests |
| [TESTING.md](./TESTING.md) | The acceptance checklist mirroring the assignment rubric + test credentials strategy |

## The assignment in one paragraph (grading rubric)

Deliver a **public sign-up URL** (not localhost, not a repo). Flow: social login →
paywall (coupon `SID_DRDROID` **or** an actually-working card payment) → 5 credits →
chat with an internet-connected agent that loops (think → tool call → observe → think),
holds context within a chat, supports multiple threads + new chats, can emit a **PDF
report artifact**, works with the **user's own OpenAI-compatible key/endpoint** (never
pre-load a key), supports 3–4 latest Claude/OpenAI/Kimi models, has **prompt caching**
awareness, and a **cost & stats page** per chat with cost split by input/output/cached
tokens priced per selected model. "Great" = the card payment flow really works.
A submission that doesn't work when their engineers try it = disqualified. **Have a
friend test everything before sending.**

## Key facts (never re-derive these)

- **Git**: `git@github.com:birajdarushi/micromanus.git` — repo-local git user is
  `birajdarushi` (already configured via `git config`, do not use global identity).
- **Deploy target**: Heroku (user has credits; Heroku CLI is logged in and active).
- **Supabase project ref**: `oqavfibixcidikoadmge` (MCP configured in `.mcp.json`,
  needs one-time `authenticate the Supabase MCP` authentication in a terminal).
- **Razorpay test keys**: in `razorx.env` at repo root (gitignored — never commit).
  key_id `rzp_test_TFTsAum4wSHStl`.
- **Coupon code**: `SID_DRDROID` (also via `COUPON_CODE` env).
- **Auth providers**: Google + GitHub via Supabase Auth (must be enabled in the
  Supabase dashboard — see SETUP-DEPLOY.md).
- **Testing keys** (owner has these; never hard-code): an **OpenRouter** key
  (test with a `:free` model) and a **Gemini** free-tier key (Gemini exposes an
  OpenAI-compatible endpoint at
  `https://generativelanguage.googleapis.com/v1beta/openai/`).
- **Secrets live in** `.env.local` (gitignored). The owner pastes values there when
  asked — point them to that file, don't ask for secrets in chat.
- Submission goes **by email to Siddarth** (the sign-up URL only; everything else must
  be self-explanatory).
