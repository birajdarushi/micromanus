# SETUP & DEPLOY RUNBOOK

## 0. Secrets layout

- `razorx.env` (repo root, gitignored) — Razorpay test keys already there:
  `Test_API_Key:rzp_test_TFTsAum4wSHStl` / `Test_Key_Secret:s8ZBlFFX3Ww3YJgR5qwfcofR`.
- `.env.local` (gitignored) — everything below. **Owner pastes secrets here when asked.**

```bash
# .env.local template
NEXT_PUBLIC_SUPABASE_URL=https://oqavfibixcidikoadmge.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=            # Supabase dashboard → Settings → API (or MCP get_anon_key)
SUPABASE_SERVICE_ROLE_KEY=                # Supabase dashboard → Settings → API (owner pastes)
APP_ENCRYPTION_KEY=                       # generate: openssl rand -hex 32
RAZORPAY_KEY_ID=rzp_test_TFTsAum4wSHStl
RAZORPAY_KEY_SECRET=s8ZBlFFX3Ww3YJgR5qwfcofR
COUPON_CODE=SID_DRDROID
PAYWALL_CURRENCY=INR                      # or USD (amount 500)
PAYWALL_AMOUNT=42500
BRAVE_SEARCH_API_KEY=                     # optional but recommended (free tier)

# --- optional: product analytics (PostHog; stores events in ClickHouse) ---
NEXT_PUBLIC_POSTHOG_KEY=                  # Project API key from PostHog
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or https://eu.i.posthog.com

# --- optional: welcome email + admin signup ping via Gmail SMTP ---
GMAIL_USER=                               # e.g. you@gmail.com
GMAIL_APP_PASSWORD=                       # Google App Password (not account password)
ADMIN_NOTIFY_EMAIL=                       # defaults to GMAIL_USER if unset
NEXT_PUBLIC_APP_URL=https://micromanus-sid-8b56d69b5666.herokuapp.com
```

## 1. Supabase provisioning

MCP is configured in `.mcp.json` (project ref `oqavfibixcidikoadmge`). One-time:
owner runs `authenticate the Supabase MCP` in a plain terminal → select `supabase` → Authenticate.

Then, via MCP tools:
1. `apply_migration` with `supabase/migrations/0001_init.sql` (idempotent — safe to re-run).
2. Confirm `artifacts` storage bucket exists (migration inserts it; verify).
3. `get_anon_key` / project URL → fill `.env.local`.

Dashboard steps (owner, cannot be done via MCP):
1. **Auth → Providers → Google**: create OAuth client at console.cloud.google.com
   (OAuth consent → External; credentials → OAuth Client ID → Web application).
   Authorized redirect URI: `https://oqavfibixcidikoadmge.supabase.co/auth/v1/callback`.
   Paste client id/secret into Supabase.
2. **Auth → Providers → GitHub**: github.com/settings/developers → New OAuth App.
   Authorization callback URL: same Supabase callback URL. Paste id/secret.
3. **Auth → URL Configuration**: Site URL = the Heroku app URL
   (e.g. `https://micromanus-xxxx.herokuapp.com`); add
   `https://<heroku-app>/auth/callback` AND `http://localhost:3000/auth/callback`
   to Additional Redirect URLs.
4. Copy the **service_role** key into `.env.local` (never into client code).

## 2. Local dev

```bash
npm run dev            # http://localhost:3000
npm run build && npm start   # production check — MUST pass before deploy
```

## 3. Heroku deploy (CLI is already logged in)

```bash
# one-time
heroku create micromanus-sid            # or any available name; note the URL
heroku buildpacks:set heroku/nodejs

# config vars = every line of .env.local
heroku config:set $(grep -v '^#' .env.local | xargs)

git push heroku main
heroku logs --tail                       # watch first boot
```

Notes:
- `Procfile` contains `web: npm start`; `next start` honors Heroku's `$PORT`
  (script must be `next start` — verify package.json; if not, use
  `web: npm start -- -p $PORT`).
- Heroku Node buildpack runs `npm run build` automatically (build script present).
- Pin Node in package.json: `"engines": { "node": "22.x" }`.
- After first deploy: update Supabase Site URL / redirect URLs (step 1.3) with the
  real Heroku domain, or OAuth will bounce to localhost.
- SSE works on Heroku; the agent route sends `: ping` heartbeats every 15s to
  survive the 55s idle window. Initial byte must be <30s (we emit status immediately).

## 4. Post-deploy verification

Run TESTING.md end-to-end on the live URL, then have a friend run it cold.

## 5. Git / GitHub

- Remote: `git@github.com:birajdarushi/micromanus.git`; repo-local user already set
  (`birajdarushi` / `birajdarushi@users.noreply.github.com`).
- Before every commit: `git status` — `razorx.env` and `.env.local` must NOT appear.
- Commits: use your GitHub identity (`birajdarushi`). Never commit secrets.
