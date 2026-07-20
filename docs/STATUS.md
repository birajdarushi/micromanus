# STATUS — MicroManus

_Last updated: 2026-07-20_

## Live

- **Domain:** https://rushiraj.birajdar.in  
- **Heroku app:** `micromanus-sid`  
- **GitHub:** https://github.com/birajdarushi/micromanus  

## Done

- Full assignment flow: auth → paywall → BYO key → agent → PDF → usage  
- PDF renderer (images, tables, citations, footers)  
- UI: shared AppShell layout (no remount on nav), observations expand, brand favicon  
- Artifacts: **3-day retention**, **10 PDFs/user/day**  
- Agent progress persisted; tab return resumes via poll  
- PostHog + Gmail hooks (env-gated)  
- Model pricing catalog with `PRICING_AS_OF`  

## Owner follow-ups

- [ ] Gmail App Password valid on Heroku (logs showed `535 BadCredentials`)  
- [ ] Confirm PostHog Activity events under US project  
- [ ] GitHub OAuth App callback = Supabase `…/auth/v1/callback` if GitHub login fails  
- [ ] Friend-test [TESTING.md](./TESTING.md) on production  
- [ ] Email public URL to Siddarth  

## Deferred

- Starred chats / Research Library  
- Full mascot lifecycle redesign  
- Brave Search key (optional; DDG fallback works)  
