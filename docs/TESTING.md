# TESTING — acceptance checklist (mirror of the assignment rubric)

> A submission that doesn't work when DrDroid's engineers try it = disqualified.
> Run this whole list on the **deployed Heroku URL** (not localhost), twice:
> once yourself, once by a friend with zero context.

## Test credentials strategy

The app must never ship an LLM key — testers enter their own through Settings, like a
real user. The owner has, for testing:

- **OpenRouter key** → base URL `https://openrouter.ai/api/v1`, use a free model
  (e.g. `moonshotai/kimi-k2:free`, `z-ai/glm-4.5-air:free`, `deepseek/deepseek-r1:free` —
  check current list at openrouter.ai/models?q=free). Free models sometimes lack
  tool-calling — prefer a free model that supports `tools` (Kimi K2 free does).
  ⚠ Requires the settings "custom model id" escape hatch (STATUS.md work item #3).
- **Gemini free tier** → base URL `https://generativelanguage.googleapis.com/v1beta/openai/`,
  model `gemini-2.5-flash` (supports tool calling on the OpenAI-compat surface).
- Real submission-quality run: any paid key (OpenAI/Anthropic/Moonshot) with a catalog
  model so cost tracking shows non-zero dollars.

## Checklist

### Auth
- [ ] Fresh incognito → app URL → lands on login (no crash, no flash of app UI)
- [ ] "Continue with Google" completes → redirected to **paywall** (not chat)
- [ ] "Continue with GitHub" (second fresh account) also works
- [ ] Session persists across reload; sign-out returns to login

### Paywall
- [ ] Chat is unreachable before unlock (navigating to /chat bounces to /paywall;
      calling POST /api/agent directly returns 402)
- [ ] Wrong coupon → clear error; `SID_DRDROID` → success, 5 credits visible
- [ ] Same coupon again on same account → "already redeemed"
- [ ] Card flow: order opens Razorpay checkout → test card `4111 1111 1111 1111`,
      any future expiry, any CVV (test OTP screen → "Success") → verified → 5 credits
- [ ] Payment verify with tampered signature fails (only if testing via curl)

### Settings / BYO key
- [ ] Garbage key → rejected with a readable message (401/403 probe)
- [ ] Valid OpenRouter key + free model saves; key shows masked preview afterwards
- [ ] Valid Gemini key + `gemini-2.5-flash` saves
- [ ] Base URL auto-fills per provider selection; custom URL editable

### Agent / chat
- [ ] New chat → prompt: *"Create a report explaining the recent forest fires in
      California, what causes them and what can be done to avoid them"*
- [ ] Live steps stream in (search → read → …), no frozen UI, survives >60s runs
- [ ] Final answer has sources/URLs; **PDF artifact card appears and the PDF
      downloads and opens** with real formatted content
- [ ] Follow-up in same chat uses context (e.g. "shorten that to 5 bullet points")
- [ ] New chat is a clean slate (no context bleed)
- [ ] Threads listed in sidebar; switching threads restores full history incl. steps
- [ ] Each run decrements exactly 1 credit; at 0 credits a clear "out of credits"
      message appears (and API returns 402)
- [ ] Agent failure (e.g. revoke the key mid-test) → readable error, credit refunded

### Cost & stats
- [ ] Usage page shows one row per chat: runs, input/output/cached tokens, and cost
      split into input/output/cached + total
- [ ] Costs match the selected model's catalog pricing (spot-check the math)
- [ ] Cached tokens become non-zero on repeated turns in a long chat (provider
      dependent — OpenAI/Kimi report `cached_tokens`; treat 0 as acceptable for
      providers that don't report it)

### Robustness / polish
- [ ] Mobile viewport: sidebar toggles, chat usable, paywall usable
- [ ] No emojis-as-icons, amber theme applied (DESIGN-SYSTEM.md conformance)
- [ ] All interactive elements have data-testid
- [ ] `heroku logs --tail` clean of unhandled exceptions during the whole run

## Known acceptable limitations (state them in the README, don't hide them)
- Final answer arrives at end of run (steps stream; tokens don't) — by design.
- Unknown/off-catalog models record tokens with $0 cost.
- Cached-token reporting depends on the provider.
