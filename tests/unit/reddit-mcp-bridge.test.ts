import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parsePluginConfig } from "../../src/config.js";
import {
  RedditMcpBridge,
  buildChildProcessEnv,
  buildLaunchSpec,
  extractTextFromToolResult,
  findInstalledPackageDir,
  resolveRedditMcpLaunch,
} from "../../src/reddit-mcp-bridge.js";

describe("buildChildProcessEnv", () => {
  it("includes allowlisted runtime env keys", () => {
    const childEnv = buildChildProcessEnv({
      PATH: "/usr/bin",
      HOME: "/home/test",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      HTTPS_PROXY: "http://proxy",
    });

    expect(childEnv.PATH).toBe("/usr/bin");
    expect(childEnv.HOME).toBe("/home/test");
    expect(childEnv.LANG).toBe("en_US.UTF-8");
    expect(childEnv.LC_ALL).toBe("en_US.UTF-8");
    expect(childEnv.HTTPS_PROXY).toBe("http://proxy");
  });

  it("excludes unrelated secret env keys", () => {
    const childEnv = buildChildProcessEnv({
      PATH: "/usr/bin",
      OPENAI_API_KEY: "secret",
      ANTHROPIC_API_KEY: "secret2",
      RANDOM_TOKEN: "secret3",
    });

    expect(childEnv.PATH).toBe("/usr/bin");
    expect(childEnv.OPENAI_API_KEY).toBeUndefined();
    expect(childEnv.ANTHROPIC_API_KEY).toBeUndefined();
    expect(childEnv.RANDOM_TOKEN).toBeUndefined();
  });
});

describe("buildLaunchSpec", () => {
  it("uses default node command and pinned server launch", () => {
    const config = parsePluginConfig({});
    const spec = buildLaunchSpec(
      config,
      {
        REDDIT_CLIENT_ID: undefined,
        REDDIT_CLIENT_SECRET: undefined,
        REDDIT_USERNAME: undefined,
        REDDIT_PASSWORD: undefined,
        REDDIT_USER_AGENT: undefined,
      },
      {},
    );

    expect(spec.command).toBe(process.execPath);
    expect(spec.args.length).toBeGreaterThan(0);
    expect(spec.args.join(" ")).toContain("reddit-mcp-server");
    expect(spec.env.REDDIT_AUTH_MODE).toBe("auto");
    expect(spec.env.REDDIT_SAFE_MODE).toBe("off");
  });

  it("uses custom command override", () => {
    const config = parsePluginConfig({
      command: "npx",
      args: ["reddit-mcp-server"],
      reddit: { authMode: "anonymous" },
      write: { enabled: true },
    });

    const spec = buildLaunchSpec(
      config,
      {
        REDDIT_CLIENT_ID: "id",
        REDDIT_CLIENT_SECRET: "secret",
        REDDIT_USERNAME: "user",
        REDDIT_PASSWORD: "pass",
        REDDIT_USER_AGENT: "ua",
      },
      {
        PATH: "/usr/bin",
        OPENAI_API_KEY: "should-not-pass",
      },
    );

    expect(spec.command).toBe("npx");
    expect(spec.args).toEqual(["reddit-mcp-server"]);
    expect(spec.env.REDDIT_SAFE_MODE).toBe("strict");
    expect(spec.env.REDDIT_CLIENT_ID).toBe("id");
    expect(spec.env.REDDIT_PASSWORD).toBe("pass");
    expect(spec.env.PATH).toBe("/usr/bin");
    expect(spec.env.OPENAI_API_KEY).toBeUndefined();
  });

  it("resolves launch command from installed package", () => {
    const launch = resolveRedditMcpLaunch();
    expect(launch.command).toBe(process.execPath);
    expect(launch.packageDir).toContain("reddit-mcp-server");
    expect(launch.args.length).toBeGreaterThan(0);
    expect(launch.args.join(" ")).toContain("reddit-mcp-server");
  });

  it("resolves override launch immediately", () => {
    const launch = resolveRedditMcpLaunch("npx", ["reddit-mcp-server"]);
    expect(launch.command).toBe("npx");
    expect(launch.args).toEqual(["reddit-mcp-server"]);
    expect(launch.packageDir).toBe("<override>");
  });
});

describe("findInstalledPackageDir", () => {
  it("finds package in ancestor node_modules", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-reddit-"));
    const nestedDir = path.join(tempDir, "a", "b", "c");
    fs.mkdirSync(path.join(tempDir, "node_modules", "my-pkg"), { recursive: true });
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "node_modules", "my-pkg", "package.json"), "{}", "utf-8");

    const resolved = findInstalledPackageDir("my-pkg", nestedDir);
    expect(resolved).toBe(path.join(tempDir, "node_modules", "my-pkg"));
  });

  it("throws when package cannot be resolved", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-reddit-miss-"));
    expect(() => findInstalledPackageDir("missing-pkg", tempDir)).toThrow("Unable to resolve package directory");
  });
});

describe("extractTextFromToolResult", () => {
  it("extracts text chunks", () => {
    const text = extractTextFromToolResult({
      content: [{ type: "text", text: "line1" }, { type: "text", text: "line2" }],
    });

    expect(text).toBe("line1\nline2");
  });

  it("falls back to data chunks", () => {
    const text = extractTextFromToolResult({
      content: [{ type: "blob", data: "raw" }],
    });

    expect(text).toBe("raw");
  });

  it("falls back to JSON for unknown content", () => {
    const payload = { content: [{ type: "x" }] };
    const text = extractTextFromToolResult(payload);
    expect(text).toContain('"type": "x"');
  });

  it("stringifies scalar values", () => {
    expect(extractTextFromToolResult("hello")).toBe('"hello"');
  });
});

describe("RedditMcpBridge callTool edge behavior", () => {
  it("retries once on recoverable transport errors", async () => {
    const bridge = new RedditMcpBridge({ command: "mock", args: [], env: {} }, 1000) as any;

    const firstClient = {
      callTool: vi.fn().mockRejectedValueOnce(new Error("closed")),
    };
    const secondClient = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    };

    bridge.connected = true;
    bridge.client = firstClient;
    bridge.transport = { close: vi.fn(async () => undefined) };

    const reconnectSpy = vi.spyOn(bridge, "reconnect").mockImplementation(async () => {
      bridge.connected = true;
      bridge.client = secondClient;
      bridge.transport = { close: vi.fn(async () => undefined) };
    });

    const result = await bridge.callTool("get_top_posts", []);
    expect(reconnectSpy).toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
  });

  it("throws on non-recoverable errors", async () => {
    const bridge = new RedditMcpBridge({ command: "mock", args: [], env: {} }, 1000) as any;

    bridge.connected = true;
    bridge.client = {
      callTool: vi.fn().mockRejectedValue(new Error("fatal")),
    };
    bridge.transport = { close: vi.fn(async () => undefined) };

    await expect(bridge.callTool("get_top_posts", {})).rejects.toThrow("fatal");
  });

  it("returns empty object args for non-object params", async () => {
    const bridge = new RedditMcpBridge({ command: "mock", args: [], env: {} }, 1000) as any;

    bridge.connected = true;
    bridge.client = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    };
    bridge.transport = { close: vi.fn(async () => undefined) };

    await bridge.callTool("get_top_posts", null);

    expect(bridge.client.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ arguments: {} }),
    );
  });

  it("reconnect() invokes close and connect", async () => {
    const bridge = new RedditMcpBridge({ command: "mock", args: [], env: {} }, 1000) as any;
    bridge.close = vi.fn(async () => undefined);
    bridge.connect = vi.fn(async () => undefined);

    await bridge.reconnect();

    expect(bridge.close).toHaveBeenCalledTimes(1);
    expect(bridge.connect).toHaveBeenCalledTimes(1);
  });

  it("close() is safe when no transport exists", async () => {
    const bridge = new RedditMcpBridge({ command: "mock", args: [], env: {} }, 1000) as any;
    bridge.transport = null;
    bridge.client = null;

    await expect(bridge.close()).resolves.toBeUndefined();
  });

  it("close() swallows transport close errors and resets state", async () => {
    const bridge = new RedditMcpBridge({ command: "mock", args: [], env: {} }, 1000) as any;
    bridge.connected = true;
    bridge.client = { callTool: vi.fn() };
    bridge.transport = { close: vi.fn(async () => {
      throw new Error("already closed");
    }) };

    await expect(bridge.close()).resolves.toBeUndefined();
    expect(bridge.connected).toBe(false);
    expect(bridge.client).toBeNull();
    expect(bridge.transport).toBeNull();
  });
});
