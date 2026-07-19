# DESIGN SYSTEM — mandatory for all UI work

> The current UI (session 1) is a placeholder that **violates this spec** (indigo
> accent, emojis as icons). Every page must be brought to this spec before submission.
> This document is the contract; do not freestyle.

## Philosophy

**Swiss Brutalist meets High-End Tech.** A premium, engineer-trusted command center.
Deep obsidian dark mode; high-contrast **monospace** for data and agent-thinking
transparency. **Completely avoid** generic AI purple/blue gradients. Dark mode is
forced (`dark` class on `<html>`, `bg-zinc-950 text-zinc-50` globally).

## Typography (load via `next/font/google`)

| Role | Family | Usage | Notes |
|---|---|---|---|
| Headings | **Outfit** | h1–h3, hero, titles | `font-light`→`font-medium` only (no heavy bold except deliberate emphasis), `tracking-tight` |
| Body | **Inter** | paragraphs, chat bubbles, general UI | `font-normal` |
| Mono | **JetBrains Mono** | agent steps, stats, token counts, pricing, API keys, labels, badges | `font-normal`, `tracking-tight` |

CSS variables: `--font-outfit`, `--font-inter`, `--font-jetbrains` → wire into
Tailwind (v4 `@theme` in globals.css): `font-heading`, `font-sans`, `font-mono`.

## Colors

| Token | Hex | Tailwind |
|---|---|---|
| background | `#09090b` | `zinc-950` |
| surface | `#18181b` | `zinc-900` |
| surface hover | `#27272a` | `zinc-800` |
| border | `#27272a` | `zinc-800` |
| **primary accent** | `#fbbf24` | `amber-400` |
| accent hover | `#f59e0b` | `amber-500` |
| text primary | `#fafafa` | `zinc-50` |
| text secondary | `#a1a1aa` | `zinc-400` |
| mono muted | `#71717a` | `zinc-500` |
| success / warning / error / info | `#10b981` / `#fbbf24` / `#ef4444` / `#3b82f6` | emerald-500 / amber-400 / red-500 / blue-500 |

**All indigo/purple in the current code must become amber.** Primary buttons:
`bg-amber-400 text-zinc-950 hover:bg-amber-500` (dark text on amber!).

## Layouts

- Global: `h-screen flex overflow-hidden bg-zinc-950 text-zinc-50`
- Sidebar: `w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between hidden md:flex` (mobile: slide-over)
- Header: `h-14 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50`
- Chat area: `flex-1 flex flex-col relative max-w-4xl mx-auto w-full`
- Stats bento: `grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 p-6 md:p-8 max-w-6xl mx-auto`
- Generous outer spacing (`p-6`/`p-8`); dense spacing (`gap-2`) *inside* agent thinking loops.

## Components

### AgentThinkingLoop (the signature component)
Vertical timeline of the agent's Think → Tool Call → Observe process.
- Base: `border-l-2 border-zinc-800 ml-4 pl-4 py-2 flex flex-col gap-3 font-mono text-sm`
- Active step: `border-amber-400` + pulsing dot:
  `relative before:content-[''] before:absolute before:-left-[9px] before:top-2
  before:w-4 before:h-4 before:bg-amber-400/20 before:rounded-full before:animate-ping`
- Completed: `border-zinc-800 text-zinc-400`
- Observation payloads collapsible (Radix/shadcn Collapsible or `<details>` styled).

### ChatBubbles
- User (right-aligned): `bg-zinc-800 text-zinc-100 px-5 py-3 rounded-2xl rounded-tr-sm self-end max-w-[80%]`
- Agent (left, full-width, transparent): `bg-transparent text-zinc-100 py-3 self-start max-w-[90%] w-full`
- **Never center-align chat messages.**

### ArtifactCard_PDF
Light card on dark bg for contrast: `bg-zinc-100 text-zinc-950 p-4 rounded-xl flex
items-center justify-between shadow-lg mt-4 max-w-sm border border-zinc-300`,
Lucide `FileText` icon tinted red/orange.

### ModelPicker
`bg-zinc-900 border border-zinc-800 rounded-md text-xs font-mono px-3 py-1.5 flex
items-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors`

### PaywallCard
`bg-zinc-900/60 backdrop-blur-2xl border border-zinc-800/50 p-8 rounded-2xl w-full
max-w-md mx-auto shadow-2xl shadow-black/50`; inputs
`bg-zinc-950 border-zinc-800 font-mono focus:border-amber-400 focus:ring-amber-400/20`.
Full-screen background image (below) with `bg-black/70` overlay.

### StatsWidget
`bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-2
hover:-translate-y-1 transition-transform duration-200`;
value: `font-mono text-3xl font-light tracking-tight text-zinc-100`;
label: `font-sans text-sm text-zinc-400 uppercase tracking-wider`.

## Motion

- Page transitions: `animate-in fade-in duration-300`
- Lists: `animate-in slide-in-from-bottom-4 fade-in duration-500` with stagger
- Active agent step: subtle glowing/tracing border (framer-motion if installed;
  CSS pulse acceptable fallback)
- **Never `transition: all`** — transition colors/opacity/transform explicitly.

## Imagery

- Paywall/Login full-bleed background (heavy `bg-black/70` overlay):
  `https://images.unsplash.com/photo-1622737133809-d95047b9e673?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZ2VvbWV0cmljJTIwM2QlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQ0ODUyMDV8MA&ixlib=rb-4.1.0&q=85`
  (floating geometric cubes, dark)
- Stats hero texture (use at `opacity-10`):
  `https://images.pexels.com/photos/37709121/pexels-photo-37709121.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940`

## Iconography

- **`lucide-react`**, stroke-width **1.5** (finer/technical). Phosphor acceptable
  alternative for dense data.
- **NEVER use emojis as icons** (🤖🧠💡🔬 etc. — current UI has these; remove all).

## Mascot system ("glow blob" agent spirits)

Sprite sheet: `docs/assets/mascot-sprite-sheet.png` (also `public/mascots/sprite-sheet.png`),
1536×1024, a 5×4 grid of round glow-blob characters on near-black — two glowing eyes,
rim light, tiny accessory communicating the current action. Grid map (row, col → state):

| Pos | Accessory | Agent state to bind |
|---|---|---|
| r1c1 | magnifying glass + speed lines | `web_search` running |
| r1c2 | speech bubble + keyboard | composing reply |
| r1c3 | pencil (amber) | writing report |
| r1c4 | thought cloud | thinking (between tool calls) |
| r1c5 | open book | `fetch_url` / reading |
| r2c1 | `</>` code | (unused / future) |
| r2c2 | globe | internet access badge |
| r2c3 | target | focused research |
| r2c4 | bar chart | usage/stats page |
| r2c5 | picture frame | (unused) |
| r3c1 | sparkles | idle / welcome |
| r3c2 | cloud ↑ | uploading artifact |
| r3c3 | arrow ↓ | artifact ready / download |
| r3c4 | connected nodes | share |
| r3c5 | lock (amber) | paywall / security / API key |
| r4c1 | lightning | fast action |
| r4c2 | gear | settings |
| r4c3 | layers | (unused) |
| r4c4 | checkmark (green) | run complete |
| r4c5 | magic wand | PDF generation |

Usage: crop/slice needed sprites (each cell ≈ 307×256) into `public/mascots/<state>.png`
(a one-off `sharp` script or manual crop), or use CSS `background-position` sprite
technique. Show the state-appropriate mascot: login hero (sparkles), paywall (lock),
thinking indicator in chat (thought cloud ↔ magnifying glass ↔ book, swapping with the
live SSE step), completion (checkmark), settings (gear), usage page (chart).
Keep them small (24–48px inline, ~96px for heroes). The body stays constant; only the
accessory communicates state — instantly recognizable, no text needed.

## Universal rules (verbatim from spec)

1. Force dark mode globally.
2. Inter for body, JetBrains Mono for mono — actually loaded, not just font-family strings.
3. User bubbles right, agent bubbles left. Never centered.
4. **All interactive elements get `data-testid`** (e.g. `data-testid="new-chat-btn"`,
   `coupon-input`, `pay-btn`, `send-btn`, `model-select`, `save-settings-btn`).
5. No transparent dropdown/modal backgrounds — `bg-zinc-900 border border-zinc-800`.
6. shadcn components (if added) must be re-themed to obsidian+amber.
7. No `transition: all`.
8. Toasts: `sonner`, bottom-right.
9. Accessibility: off-white on `#09090b` (APCA-passing); focus:
   `focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none`.
