# STATUS — MicroManus

_Last updated: 2026-07-21_  
_Full session context: [SESSION-HANDOFF.md](./SESSION-HANDOFF.md)_

## Live

- **Domain:** https://rushiraj.birajdar.in  
- **Heroku app:** `micromanus-sid` (**v35** @ `157848c`)  
- **GitHub:** https://github.com/birajdarushi/micromanus  

## Done

- Full assignment flow: auth → paywall → BYO key → agent → PDF → usage  
- PDF renderer (images, tables, citations, footers)  
- UI: shared AppShell layout (no remount on nav), observations expand, brand favicon  
- Artifacts: **3-day retention**, **10 PDFs/user/day**  
- Agent progress persisted; tab return resumes via poll  
- PostHog + Gmail hooks (env-gated)  
- Model pricing catalog with `PRICING_AS_OF`  
- **web_search:** SerpAPI → Brave → DuckDuckGo (SerpAPI key currently **invalid** at API)  

## Owner follow-ups

- [ ] Valid `SERPAPI_API_KEY` (current key rejected by SerpAPI)  
- [ ] Gmail App Password valid on Heroku (logs showed `535 BadCredentials`)  
- [ ] Confirm PostHog Activity events under US project  
- [ ] GitHub OAuth App callback = Supabase `…/auth/v1/callback` if GitHub login fails  
- [ ] Friend-test [TESTING.md](./TESTING.md) on production  
- [ ] Email public URL to Siddarth  

## Notes

- Payment outage (2026-07-20 ~17:02 UTC) was **Razorpay temporary**; temporary billing debug commits were **force-removed** (back to `157848c`).  
- Billing model: credits for runs; Usage page = estimated model $ from tokens.

## Deferred

- Starred chats / Research Library  
- Full mascot lifecycle redesign  
- Brave Search key (optional; DDG fallback works)  
