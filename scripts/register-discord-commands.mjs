/**
 * Register Discord slash commands for MicroManus.
 * Usage:
 *   DISCORD_BOT_TOKEN=… DISCORD_APPLICATION_ID=… node scripts/register-discord-commands.mjs
 */

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional: guild-only for fast dev

if (!token || !appId) {
  console.error("Set DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID");
  process.exit(1);
}

const commands = [
  {
    name: "research",
    description: "Run MicroManus deep research on a question",
    options: [
      {
        name: "query",
        description: "Research question",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "link",
    description: "Link this Discord account to MicroManus",
    options: [
      {
        name: "code",
        description: "One-time link code from MicroManus",
        type: 3,
        required: true,
      },
    ],
  },
];

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
