# SETUP & DEPLOY

## Environment (`.env.local` / Heroku config)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://oqavfibixcidikoadmge.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_ENCRYPTION_KEY=                 # openssl rand -hex 32
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
COUPON_CODE=SID_DRDROID
PAYWALL_CURRENCY=INR
PAYWALL_AMOUNT=42500
SERPAPI_API_KEY=                    # preferred web search (SerpAPI / Google)
BRAVE_SEARCH_API_KEY=               # optional fallback if SerpAPI unset

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=            # phc_…
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Welcome email (optional)
GMAIL_USER=
GMAIL_APP_PASSWORD=                 # Google App Password, not account password
ADMIN_NOTIFY_EMAIL=
NEXT_PUBLIC_APP_URL=https://rushiraj.birajdar.in
```

## Supabase Auth URLs

**Site URL:** `https://rushiraj.birajdar.in`

**Redirect URLs:**

```
https://rushiraj.birajdar.in/auth/callback
https://micromanus-sid-8cf843a079b9.herokuapp.com/auth/callback
http://localhost:3000/auth/callback
```

**Google / GitHub OAuth apps:** Authorization callback must be:

```
https://oqavfibixcidikoadmge.supabase.co/auth/v1/callback
```

## Custom domain (GoDaddy)

| Type | Name | Value |
|---|---|---|
| CNAME | `rushiraj` | (Heroku DNS target from `heroku domains -a micromanus-sid`) |

```bash
heroku domains:add rushiraj.birajdar.in -a micromanus-sid
heroku certs:auto:enable -a micromanus-sid
```

## Deploy

```bash
git push https://git.heroku.com/micromanus-sid.git master:main
# or: git remote set-url heroku https://git.heroku.com/micromanus-sid.git && git push heroku master:main
```

`NEXT_PUBLIC_*` vars require a **rebuild** after change (empty commit + push).

## Limits

| Limit | Value |
|---|---|
| Credits per unlock | 5 |
| PDF retention | 3 days |
| PDFs per user per UTC day | 10 |
| Signed URL lifetime | matches retention (3 days) |
