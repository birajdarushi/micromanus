/**
 * Run: node --experimental-strip-types --test src/gateway/contracts/session.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
// .ts suffix required for node --experimental-strip-types ESM resolution
import { buildSessionKey, type SessionSource } from "./session.ts";

describe("buildSessionKey", () => {
  it("isolates Discord guilds via scope_id", () => {
    const a: SessionSource = {
      platform: "discord",
      chat_id: "channel-1",
      chat_type: "channel",
      scope_id: "guild-A",
      user_id: "user-1",
    };
    const b: SessionSource = {
      ...a,
      scope_id: "guild-B",
    };
    assert.notEqual(buildSessionKey(a), buildSessionKey(b));
    assert.match(buildSessionKey(a), /guild-A/);
    assert.match(buildSessionKey(b), /guild-B/);
  });

  it("collides if scope_id omitted for same channel id in different guilds", () => {
    // Documents the risk Hermes warns about — missing scope is dangerous.
    const a: SessionSource = {
      platform: "discord",
      chat_id: "channel-1",
      chat_type: "channel",
      user_id: "user-1",
    };
    const b: SessionSource = {
      platform: "discord",
      chat_id: "channel-1",
      chat_type: "channel",
      user_id: "user-2",
    };
    // Channel-type sessions ignore user_id → same key without scope
    assert.equal(buildSessionKey(a), buildSessionKey(b));
  });

  it("DM sessions isolate by user_id", () => {
    const a: SessionSource = {
      platform: "whatsapp",
      chat_id: "dm-box",
      chat_type: "dm",
      user_id: "phone-1",
    };
    const b: SessionSource = {
      ...a,
      user_id: "phone-2",
    };
    assert.notEqual(buildSessionKey(a), buildSessionKey(b));
  });

  it("threads get distinct keys", () => {
    const base: SessionSource = {
      platform: "discord",
      chat_id: "ch-1",
      chat_type: "channel",
      scope_id: "g-1",
    };
    const threaded: SessionSource = { ...base, thread_id: "t-9" };
    assert.notEqual(buildSessionKey(base), buildSessionKey(threaded));
    assert.match(buildSessionKey(threaded), /t:t-9/);
  });

  it("web chat keys are stable", () => {
    const s: SessionSource = {
      platform: "web",
      chat_id: "uuid-chat",
      chat_type: "dm",
      user_id: "mm-user",
    };
    assert.equal(buildSessionKey(s), buildSessionKey({ ...s }));
    assert.equal(buildSessionKey(s), "web|-|uuid-chat|u:mm-user");
  });

  it("cli_attach is a first-class platform id (standalone context)", () => {
    const s: SessionSource = {
      platform: "cli_attach",
      chat_id: "term-1",
      chat_type: "dm",
      user_id: "device-owner",
    };
    assert.match(buildSessionKey(s), /^cli_attach\|/);
  });
});
