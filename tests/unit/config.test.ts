import { describe, expect, it } from "vitest";
import {
  parsePluginConfig,
  resolveRedditEnvironment,
  resolveSafeMode,
  validateCredentialReadiness,
} from "../../src/config.js";

describe("config", () => {
  it("applies secure defaults", () => {
    const config = parsePluginConfig({});

    expect(config.strictStartup).toBe(false);
    expect(config.write.enabled).toBe(false);
    expect(config.write.allowDelete).toBe(false);
    expect(config.write.allowedTools).toEqual([]);
    expect(config.write.requireSubredditAllowlist).toBe(true);
    expect(config.rateLimit.readPerMinute).toBe(60);
    expect(config.rateLimit.writePerMinute).toBe(6);
    expect(config.rateLimit.minWriteIntervalMs).toBe(5000);
    expect(resolveSafeMode(config)).toBe("off");
  });

  it("normalizes subreddit allowlist", () => {
    const config = parsePluginConfig({
      write: {
        enabled: true,
        allowedSubreddits: ["r/AskReddit", "AskReddit", "  r/typescript  "],
      },
    });

    expect(config.write.allowedSubreddits).toEqual(["askreddit", "typescript"]);
  });

  it("resolves env by configured names", () => {
    const config = parsePluginConfig({
      reddit: {
        env: {
          clientId: "MY_REDDIT_ID",
          clientSecret: "MY_REDDIT_SECRET",
          username: "MY_REDDIT_USER",
          password: "MY_REDDIT_PASS",
          userAgent: "MY_REDDIT_UA",
        },
      },
    });

    const resolved = resolveRedditEnvironment(config, {
      MY_REDDIT_ID: "id",
      MY_REDDIT_SECRET: "secret",
      MY_REDDIT_USER: "user",
      MY_REDDIT_PASS: "pass",
      MY_REDDIT_UA: "ua",
    });

    expect(resolved).toEqual({
      REDDIT_CLIENT_ID: "id",
      REDDIT_CLIENT_SECRET: "secret",
      REDDIT_USERNAME: "user",
      REDDIT_PASSWORD: "pass",
      REDDIT_USER_AGENT: "ua",
    });
  });

  it("validates write credential readiness", () => {
    const config = parsePluginConfig({
      reddit: { authMode: "authenticated", credentialProvider: "env" },
      write: { enabled: true },
    });

    const errors = validateCredentialReadiness(config, {
      REDDIT_CLIENT_ID: undefined,
      REDDIT_CLIENT_SECRET: undefined,
      REDDIT_USERNAME: undefined,
      REDDIT_PASSWORD: undefined,
      REDDIT_USER_AGENT: undefined,
    });

    expect(errors.join(" ")).toContain("client ID");
    expect(errors.join(" ")).toContain("client secret");
    expect(errors.join(" ")).toContain("username");
    expect(errors.join(" ")).toContain("password");
  });

  it("normalizes and filters empty subreddit values", () => {
    const config = parsePluginConfig({
      write: {
        allowedSubreddits: ["", "   ", "r/typescript"],
      },
    });

    expect(config.write.allowedSubreddits).toEqual(["typescript"]);
  });

  it("deduplicates allowed write tools", () => {
    const config = parsePluginConfig({
      write: {
        allowedTools: ["create_post", "create_post", "reply_to_post"],
      },
    });

    expect(config.write.allowedTools).toEqual(["create_post", "reply_to_post"]);
  });

  it("rejects unknown write tool names in config", () => {
    expect(() =>
      parsePluginConfig({
        write: {
          allowedTools: ["totally_invalid_tool"],
        },
      }),
    ).toThrow();
  });

  it("treats blank env values as missing", () => {
    const config = parsePluginConfig({});
    const resolved = resolveRedditEnvironment(config, {
      REDDIT_CLIENT_ID: "   ",
      REDDIT_CLIENT_SECRET: "",
    });

    expect(resolved.REDDIT_CLIENT_ID).toBeUndefined();
    expect(resolved.REDDIT_CLIENT_SECRET).toBeUndefined();
  });

  it("returns no credential errors when requirements are met", () => {
    const config = parsePluginConfig({
      reddit: { authMode: "authenticated", credentialProvider: "env", username: "user" },
      write: { enabled: true },
    });

    const errors = validateCredentialReadiness(config, {
      REDDIT_CLIENT_ID: "id",
      REDDIT_CLIENT_SECRET: "secret",
      REDDIT_USERNAME: "user",
      REDDIT_PASSWORD: "pass",
      REDDIT_USER_AGENT: "ua",
    });

    expect(errors).toEqual([]);
  });

  it("switches to write safe mode when write mode enabled", () => {
    const config = parsePluginConfig({
      reddit: {
        safeModeReadOnly: "off",
        safeModeWriteEnabled: "strict",
      },
      write: {
        enabled: true,
      },
    });

    expect(resolveSafeMode(config)).toBe("strict");
  });

  it("allows opting into strict startup mode", () => {
    const config = parsePluginConfig({
      strictStartup: true,
    });

    expect(config.strictStartup).toBe(true);
  });
});
