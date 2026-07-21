# Gateway architecture (MicroManus)

## Two separate product contexts

This is **not** “merge Grok CLI into MicroManus.”

| Context | What it is | Auth |
|---------|------------|------|
| **A — MicroManus product** | Research agent + credits + web + Discord + WhatsApp | MM user (OAuth / link code); BYOK for research LLM |
| **B — Standalone host / connector** | Any already-logged-in CLI or tool calling MM as a *capability* | Host keeps vendor login; uses `mm_…` PAT only for MM |

Same **contracts** (`SessionSource`, `TurnEvent`, capabilities). Different deployments.

```text
Context A                         Context B
Web / Discord / WhatsApp   →      Claude / Grok / Codex / …
        │                                │
        ▼                                ▼
 Gateway (this app)              Optional host gateway
        │                                │
        ▼                                └── POST /api/v1/turns (PAT)
 Provider:micromanus
```

## Hard umbrellas

- **Surface** — web, discord, whatsapp, cli_attach  
- **Gateway** — `handleTurn` + capability registry  
- **AgentRuntime** — CLI vendor login (not MM Settings)  
- **Capability** — `research.chat` / `research.run`  
- **Provider** — `micromanus` (`runAgentTurn`)  
- **Principal** — MM `user_id` for billing  

## Code map

| Path | Role |
|------|------|
| `src/gateway/contracts/*` | Shared types + `buildSessionKey` |
| `src/gateway/runner.ts` | `handleTurn` |
| `src/gateway/capabilities/registry.ts` | Capability registry |
| `src/gateway/principal-resolve.ts` | Cookie / link / PAT → principal |
| `src/gateway/pairing.ts` | Link codes + PAT creation |
| `src/gateway/platforms/web.ts` | Web surface |
| `src/gateway/platforms/discord/*` | Discord interactions |
| `src/gateway/platforms/whatsapp/*` | WhatsApp Cloud API |
| `src/providers/micromanus/*` | Research provider |
| `POST /api/agent` | Web surface |
| `POST /api/v1/turns` | Connector / CLI (PAT or cookie) |
| `POST /api/v1/link/code` | Generate link code (signed-in web) |
| `POST /api/v1/tokens` | Create PAT (shown once) |
| `POST /api/surfaces/discord/interactions` | Discord |
| `GET/POST /api/surfaces/whatsapp/webhook` | WhatsApp |

## Database

Apply migration:

```bash
# Supabase SQL editor or CLI:
# supabase/migrations/0003_gateway_identities.sql
```

Tables: `channel_identities`, `link_codes`, `personal_access_tokens`, `device_pairings`.

## Setup: Discord (Context A)

1. Create a Discord application + bot; enable Privileged intents if needed later.  
2. Env:

```bash
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=          # Interactions public key
DISCORD_APPLICATION_ID=
# optional for instant command sync while developing:
DISCORD_GUILD_ID=
```

3. Interactions URL: `https://<host>/api/surfaces/discord/interactions`  
4. Register commands:

```bash
DISCORD_BOT_TOKEN=… DISCORD_APPLICATION_ID=… node scripts/register-discord-commands.mjs
```

5. User flow: web → `POST /api/v1/link/code` → Discord `/link code:…` → `/research query:…`

## Setup: WhatsApp Cloud API (Context A)

```bash
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=       # you choose; put same in Meta dashboard
WHATSAPP_APP_SECRET=         # optional signature check
```

Webhook URL: `https://<host>/api/surfaces/whatsapp/webhook`  
User flow: send `link CODE` then any research question as plain text.

## Setup: CLI / connector client (Context B)

```bash
# As signed-in MM user:
curl -X POST https://<host>/api/v1/tokens \
  -H "Cookie: …" -H "Content-Type: application/json" \
  -d '{"name":"laptop"}'
# Save token mm_…

MM_URL=https://<host> MM_PAT=mm_… \
  node scripts/mm-turns-client.mjs "what is going on with indian cricket?"
```

CLI vendor login is **independent** — PAT only authorizes MM research + credits.

## Agent behavior

- Parallel tool batches within a model step  
- Multi-round research (search → think → search again)  
- Temporal grounding (current UTC date in system context)  

## Tests

```bash
npm run test:gateway
```

## Reference traces (gitignored clones removed)

- `reference/hermes-agent-trace.txt`  
- `reference/open_deep_research-trace.txt`  
- `reference/autoresearch-trace.txt`  
