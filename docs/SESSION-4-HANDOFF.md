# SESSION 4 HANDOFF — MicroManus

_Generated 2026-07-20 (session 4). Companion to `docs/STATUS.md` (living source of truth) and `docs/SESSION-HANDOFF.md` (session 3). Read this to understand everything session 4 changed and exactly where to resume._

---

## 0. TL;DR — resume in 60 seconds

- **What happened this session:** two big tracks landed, both **build- + lint-clean** and **visually verified via headless-Chrome screenshots**:
  1. **Track A — PDF report pipeline overhaul** (the assessor's punch list in `Testing and final enhacemnts before deploy.txt`).
  2. **Track B — UI/UX redesign, batches 1–4** (accent pivot, composer, empty state, sidebar, reports library, credit top-up, accent themes, favicon).
- **State:** everything runs; `npm run build` green. Supabase still provisioned (unchanged this session — **no DB migrations were run**). **Not deployed.**
- **⚠️ Biggest thing before deploy:** a **large amount of uncommitted work** (all of session 3's final batch + all of session 4). **Commit next.** Nothing is committed past `724f12f`.
- **Nothing blocking** functionally — the remaining items are notifications polish, integrations (need creds), commit, and deploy.

---

## 1. Track A — PDF report pipeline (DONE, verified)

Root cause of the ugly reports: the renderer had **no image handling**, footers were written below the bottom margin (spawning blank pages + the `Page 1 of NPage 2 of N` jam), and there was **no image-search capability** so "include images" always failed.

### Files
- **`src/lib/agent/pdf-render.ts`** — NEW. The pure renderer, split out of `pdf.ts` so it's testable with zero app imports (only `pdfkit` + `sharp`). Exports `renderPdf(title, markdown): Promise<Buffer>`.
- **`src/lib/agent/pdf.ts`** — now just the storage half (`generatePdfReport`): render → upload to `artifacts` bucket → 7-day signed URL. Imports `renderPdf` from `./pdf-render`.
- **`src/app/api/agent/route.ts`** — strengthened the report system prompt.
- **`next.config.ts`** — added `sharp` to `serverExternalPackages` (native bindings, must not bundle).

### What the renderer now does
- **Images embed for real:** every `![alt](url)` is prefetched, normalised to PNG via `sharp` (handles WebP/GIF/huge/transparent), embedded centered with an italic caption. On any failure → a **labelled dashed placeholder** (never leaks raw markdown). SSRF-guarded, 8 MB cap, 12 s timeout.
- **Footer bug fixed:** page-number text is written with `doc.page.margins.bottom = 0` around the write, so pdfkit no longer auto-appends blank pages. (That was the `Page X of Y` concatenation cause.)
- **Real inline styling:** `**bold**`, `*italic*`, `` `code` ``, `[text](url)` and bare URLs render as actual styled runs / clickable links (`writeRich` + `tokenizeInline`).
- **`## Sources` → numbered bibliography** with shortened hyperlinks (no raw-URL wall, no mid-string URL wrapping).
- Blockquotes (amber left bar), horizontal rules, hanging-indent bullets, differentiated heading hierarchy, human-readable byline, duplicate-title suppression, table-caption-below-table fix, blank-line collapsing.

### System-prompt rules added (route.ts)
Numbered `[n]` citations mapping to Sources; real `##`/`###` hierarchy; captions **below** tables (not in cells); no `Page X`/timestamp/debug lines in the body; image-sourcing rules (only when asked, standard Wikimedia thumb widths, descriptive captions).

### Gotchas learned
- **Wikimedia rejects non-standard thumbnail widths with HTTP 400** (e.g. `480px`). Use standard sizes (`500px`, `640px`, `800px`, `1024px`). This matters if an image-search tool is added later — prefer the Wikimedia API's `iiurlwidth` (always valid).
- **Image search itself was intentionally deferred** — user said "leave the image part." The renderer embeds images the model provides; there is still **no `image_search` tool**, so "include images" only works if the model already knows a valid direct image URL. Adding a Wikimedia-Commons `image_search` tool is the clean fix (see §5).

### How it was verified
Node 22 runs TS natively: `node --experimental-strip-types` a small harness that imports `pdf-render.ts` directly, writes `sample.pdf`, then `poppler` (`brew install poppler`) → `pdftoppm` → PNG → read visually. Installed poppler this session.

---

## 2. Track B — UI/UX redesign (batches 1–4, DONE, verified)

### Design decision (locked with the user)
**Primary accent moved amber → indigo/violet** ("thinking" colour). **Amber is now reserved for credits / processing / warnings only.** Matches the north-star mockup `~/Downloads/new-design-sysmem micromanus.png`.

### Foundation — `src/app/globals.css`
- New **`accent` colour ramp** (indigo) in `@theme` → `bg-accent-*`, `text-accent-*`, `ring-accent-*` etc. resolve.
- **4 alternate accents** pre-wired under `html[data-accent="violet|blue|emerald|rose"]` (300/400/500/600 overridden).
- Focus ring is now accent. Added `.mm-float` (soft shadow) to replace hard 1px borders.
- `src/app/layout.tsx` no-flash inline script now also applies the saved `mm-accent`.

### New components
- **`src/components/Dropdown.tsx`** — custom, keyboard-accessible dropdown (↑/↓/Enter/Esc, outside-click). Replaces native `<select>` in the composer and Settings. Has a `buttonClassName` prop to match form inputs.
- **`src/components/CreditTopUp.tsx`** — credits chip: shows balance (amber) + "buy more", opens a popover to pick a **quantity** (± / numeric), shows live cost, checks out. _(User refined this after I built it: it now takes `credits` + `align` props and is used once, top-right, in AppShell — it unifies the old credits pill + buy button.)_
- **`src/components/AccentPicker.tsx`** — 5 accent swatches, persisted to `mm-accent`, applied via `<html data-accent>`.
- **`src/app/reports/page.tsx`** + **`src/app/api/artifacts/route.ts`** — Reports library: lists every generated PDF (fresh signed URLs), Claude-style cards, empty state.
- **`src/lib/time.ts`** — `timeAgo()` relative-time helper (sidebar timestamps + reports).
- **`src/app/icon.svg`** — branded favicon (dark tile + indigo orb + pause bars).

### Reworked
- **`src/components/ChatWindow.tsx`** — floating composer (`.mm-float`, no hard footer border, accent send + custom Dropdown); **empty-state redesign** (mascot + glow, "What do you want to **research?**", 4 suggestion cards that prefill the composer, capability row); primary amber→accent (links, sources, artifact). Processing indicators stay amber (correct).
- **`src/components/AppShell.tsx`** — **collapsible sidebar** (icon rail, persisted `mm-sidebar-collapsed`), **Reports** nav, **recent-chat timestamps**, **inline rename** (no modal; Enter/blur saves, Esc cancels), ⌘K new-chat shortcut, CreditTopUp chip. Delete keeps its confirm modal.
- **`src/components/ThemeToggle.tsx`** — accepts `collapsed` prop.
- **`src/app/settings/page.tsx`** — model picker → custom Dropdown; added **Accent color** + **Promo code** (redeem via coupon endpoint) sections; amber→accent.
- **`src/app/login/page.tsx`** — focus rings → accent.
- **`src/app/usage/page.tsx`** — swapped fixed "Buy 5" for CreditTopUp.

### Billing — variable credit top-up (migration-free, server-authoritative)
- **`src/lib/billing.ts`** — `MIN_CREDITS`/`MAX_CREDITS`, `perCreditAmount()`, `creditPurchase(qty)`.
- **`src/app/api/billing/order/route.ts`** — `POST` now accepts `{ credits }`; amount = perCredit × qty; the quantity is stored in the **Razorpay order `notes.credits`** (server-set). No body = the fixed unlock pack. Added a **`GET`** returning pricing (`perCredit`, `symbol`, `min`, `max`) for the popover.
- **`src/app/api/billing/verify/route.ts`** — after signature check, **fetches the order from Razorpay and reads `notes.credits`** to grant the right amount (clamped to `MAX_CREDITS`). Client can't claim free credits. Falls back to `CREDITS_PER_UNLOCK`.

### Intentionally skipped (would be dead buttons / need backend)
"Research Library" and "Starred" nav from the mockup — Reports covers artifacts; Starred needs a DB column + toggle. Offer to the user if they want it real.

### Amber that correctly REMAINS (not a bug)
`paywall` (credits/payment screen), `usage` cost figures, the credits chip, and ChatWindow processing indicators (ThinkingLoop spinner/dots/pulse). Everything else is accent.

### How it was verified
Temporary unguarded `src/app/preview/page.tsx` + a one-line `/preview` allowance in `src/proxy.ts` → `npm run dev` → headless Chrome (`/Applications/Google Chrome.app/...  --headless=new --screenshot`) → read PNG. **Both were reverted/removed** after each check (preview page deleted, proxy restored). Screenshots were sent to the user.

---

## 3. Uncommitted state ⚠️ (do this next)

Nothing is committed past `724f12f`. Modified + new files (`git status`):

**Modified:** `next.config.ts`, `api/agent/route.ts`, `api/billing/order/route.ts`, `api/billing/verify/route.ts`, `chat/[id]/page.tsx`, `chat/page.tsx`, `globals.css`, `layout.tsx`, `login/page.tsx`, `settings/page.tsx`, `usage/page.tsx`, `AppShell.tsx`, `ChatWindow.tsx`, `ThemeToggle.tsx`, `lib/agent/pdf.ts`, `lib/billing.ts`.

**New:** `api/artifacts/route.ts`, `app/icon.svg`, `app/reports/page.tsx`, `components/AccentPicker.tsx`, `components/CreditTopUp.tsx`, `components/Dropdown.tsx`, `lib/agent/pdf-render.ts`, `lib/time.ts`.

**`BuyCreditsButton.tsx` is now orphaned** (no imports) — safe to delete or keep.

Suggested commits (logical grouping):
1. `feat(pdf): rewrite report renderer — image embedding, footer fix, rich text, numbered sources`
2. `feat(ui): indigo accent system + custom dropdown + floating composer`
3. `feat(ui): empty-state redesign (suggestions + capabilities)`
4. `feat(ui): collapsible sidebar, timestamps, inline rename, reports library`
5. `feat(billing): variable credit top-up (server-authoritative) + promo + accent picker + favicon`

Branch is `master`; push `master:main` to Heroku when deploying.

---

## 4. Verification tooling notes (reusable)

- **Render a PDF locally:** `node --experimental-strip-types <harness>.ts` importing `src/lib/agent/pdf-render.ts` by absolute path; inspect with `pdftoppm`/`pdftotext` (poppler installed via brew).
- **Screenshot an authed page:** temp `src/app/preview/page.tsx` (render the real component), add `pathname === "/preview"` to `isPublic` in `src/proxy.ts`, `npm run dev`, then headless Chrome `--headless=new --screenshot`. **Revert both afterward.** Unauthenticated preview means `/api/*` returns 401 (empty chats/models) — layout still verifiable.

---

## 5. Remaining work (from `Testing and final enhacemnts before deploy.txt`)

Not yet done, roughly prioritized:

**Notifications / background (Track C)**
- Tab-hidden completion notifications don't fire reliably (permission is requested; the `new Notification()` only fires when `document.hidden` on `done` — verify it works, may need a service worker or focus check).
- A persistent "**still processing / finished in background**" indicator so a user returning to the tab knows a run completed while away.

**Integrations (Track D — need creds/decisions from user)**
- **PostHog + ClickHouse** analytics (product usage).
- **Supabase new-signup notification** (DB webhook/trigger → notify).
- **HTML welcome email via Gmail SMTP** (user will provide Gmail + app password; reference `~/Desktop/Personal/gtm`).
- **Clone + mine** `github.com/karpathy/autoresearch` and `github.com/langchain-ai/open_deep_research` to improve the agent loop.

**Deferred / smaller**
- **`image_search` tool** (Wikimedia Commons API, keyless, license-clean) so "include images" actually finds images — the renderer already embeds them. (User said "leave the image part" for now.)
- **Mascot behaviour redesign** per the elaborate lifecycle spec in the txt (idle/thinking/reading/searching/writing/done) — aspirational.
- **"Starred" chats** + "Research Library" nav (need a DB column) if the user wants them real.
- Double-click-to-open observation: current observations are already inline `<details>` (not a modal), so likely already satisfies the ask — confirm with user.

**Deploy (Track E)**
- Commit (§3), push env to Heroku, `git push …master:main`, run `docs/TESTING.md` on the live URL. See `docs/SESSION-HANDOFF.md` §7 (session 3) for the exact deploy checklist and Supabase Auth redirect-URL step.

---

## 6. Environment / facts (unchanged from session 3)

- Supabase project ref `oqavfibixcidikoadmge`; **no migrations run this session** (artifacts table + `artifacts` bucket already existed from `0001`).
- Heroku app `micromanus-sid` (reserved, not deployed). Coupon `SID_DRDROID`. Paywall ₹425 = 5 credits (₹85/credit derived for top-ups).
- `.env.local` complete except `BRAVE_SEARCH_API_KEY` (agent falls back to DuckDuckGo scrape).
- **AGENTS.md rule still applies:** "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing Next-specific code. Middleware file is `src/proxy.ts`.
