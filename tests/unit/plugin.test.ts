import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_TOOL_NAMES, READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "../../src/tool-specs.js";
import type { OpenClawPluginApi, ToolDefinition } from "../../src/openclaw-api.js";

const bridgeCallTool = vi.fn(async (name: string, params: unknown): Promise<unknown> => ({
  content: [{ type: "text", text: `ok:${name}:${JSON.stringify(params ?? {})}` }],
}));
const bridgeListTools = vi.fn(async (): Promise<Array<{ name: string }>> =>
  ALL_TOOL_NAMES.map((name) => ({ name })),
);
const bridgeClose = vi.fn(async () => undefined);
const bridgeStatus = vi.fn(() => ({ connected: true, command: "mock", args: ["reddit"] }));

vi.mock("../../src/reddit-mcp-bridge.js", () => {
  class MockBridge {
    public status() {
      return bridgeStatus();
    }

    public async callTool(name: string, params: unknown) {
      return await bridgeCallTool(name, params);
    }

    public async listTools() {
      return await bridgeListTools();
    }

    public async close() {
      await bridgeClose();
    }
  }

  return {
    RedditMcpBridge: MockBridge,
    buildLaunchSpec: vi.fn(() => ({ command: "mock", args: ["reddit"], env: {} })),
    extractTextFromToolResult: vi.fn((result: unknown) => {
      if (!result || typeof result !== "object") {
        return String(result);
      }
      const first = (result as { content?: Array<{ text?: string }> }).content?.[0]?.text;
      return first ?? "";
    }),
  };
});

import plugin from "../../src/index.js";

type Registered = {
  tools: Map<string, { tool: ToolDefinition; optional: boolean }>;
  methods: Map<string, (ctx: { respond: (ok: boolean, payload?: unknown) => void }) => Promise<void> | void>;
  services: Array<{ id: string; start: () => Promise<void> | void; stop?: () => Promise<void> | void }>;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  cliRegistrar:
    | ((ctx: {
        program: {
          command: (name: string) => {
            description: (desc: string) => {
              action: (handler: () => void) => void;
            };
          };
        };
      }) => void)
    | undefined;
};

function registerPlugin(pluginConfig: Record<string, unknown>): Registered {
  const tools = new Map<string, { tool: ToolDefinition; optional: boolean }>();
  const methods = new Map<string, (ctx: { respond: (ok: boolean, payload?: unknown) => void }) => Promise<void> | void>();
  const services: Registered["services"] = [];

  let cliRegistrar: Registered["cliRegistrar"];

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const api: OpenClawPluginApi = {
    id: "openclaw-plugin-reddit",
    config: {},
    pluginConfig,
    logger,
    registerTool: (tool, opts) => {
      tools.set(tool.name, { tool, optional: Boolean(opts?.optional) });
    },
    registerService: (service) => {
      services.push(service);
    },
    registerGatewayMethod: (method, handler) => {
      methods.set(method, handler);
    },
    registerCli: (registrar) => {
      cliRegistrar = registrar;
    },
  };

  plugin.register(api);
  return { tools, methods, services, logger, cliRegistrar };
}

describe("plugin registration and policy behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    bridgeCallTool.mockReset();
    bridgeCallTool.mockImplementation(async (name: string) => ({
      content: [{ type: "text", text: `ok:${name}` }],
    }));
    bridgeListTools.mockReset();
    bridgeListTools.mockImplementation(async () => ALL_TOOL_NAMES.map((name) => ({ name })));
    bridgeClose.mockReset();
    bridgeClose.mockImplementation(async () => undefined);
    bridgeStatus.mockReset();
    bridgeStatus.mockImplementation(() => ({ connected: true, command: "mock", args: ["reddit"] }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("registers expected tools and marks write tools optional", () => {
    const { tools } = registerPlugin({});

    expect(tools.size).toBe(ALL_TOOL_NAMES.length);

    for (const name of ALL_TOOL_NAMES) {
      expect(tools.has(name)).toBe(true);
    }

    for (const name of WRITE_TOOL_NAMES) {
      expect(tools.get(name)?.optional).toBe(true);
    }

    expect(tools.get("get_top_posts")?.optional).toBe(false);
  });

  it("allows read tool execution", async () => {
    const { tools } = registerPlugin({});
    const readTool = tools.get("get_top_posts")?.tool;

    const result = await readTool?.execute("tool-1", { subreddit: "typescript" });
    expect(result?.isError).toBe(false);
    expect(result?.content[0]?.text).toContain("ok:get_top_posts");
  });

  it("propagates MCP isError flag", async () => {
    bridgeCallTool.mockResolvedValueOnce({
      isError: true,
      content: [{ type: "text", text: "upstream error" }],
    });

    const { tools } = registerPlugin({});
    const readTool = tools.get("get_top_posts")?.tool;

    const result = await readTool?.execute("tool-err", { subreddit: "typescript" });
    expect(result?.isError).toBe(true);
  });

  it("blocks write tools in default read-only mode", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({});
    const writeTool = tools.get("create_post")?.tool;

    const result = await writeTool?.execute("tool-2", {
      subreddit: "typescript",
      title: "hello",
      content: "world",
    });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("write mode is disabled");
  });

  it("blocks write when not included in write.allowedTools", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowedTools: ["reply_to_post"],
        requireSubredditAllowlist: false,
      },
      verboseErrors: false, // Test default production behavior
    });

    const writeTool = tools.get("create_post")?.tool;
    const result = await writeTool?.execute("tool-2b", {
      subreddit: "typescript",
      title: "hello",
      content: "world",
    });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("tool not in allowlist");
  });

  it("blocks writes with missing credentials when write mode enabled", async () => {
    delete process.env.REDDIT_USERNAME;
    delete process.env.REDDIT_PASSWORD;

    const { tools, logger } = registerPlugin({
      write: {
        enabled: true,
        allowedTools: ["create_post"],
        requireSubredditAllowlist: false,
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Write mode enabled"));

    const writeTool = tools.get("create_post")?.tool;
    const result = await writeTool?.execute("tool-2c", {
      subreddit: "typescript",
      title: "hello",
      content: "world",
    });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("Write blocked");
  });

  it("blocks read when read rate limit is exceeded", async () => {
    const { tools } = registerPlugin({
      rateLimit: {
        readPerMinute: 1,
      },
    });

    const readTool = tools.get("get_user_info")?.tool;
    const first = await readTool?.execute("tool-a", { username: "alice" });
    const second = await readTool?.execute("tool-b", { username: "alice" });

    expect(first?.isError).toBe(false);
    expect(second?.isError).toBe(true);
    expect(second?.content[0]?.text).toContain("Rate limit");
  });

  it("blocks create_post outside allowlist when write mode enabled", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowedTools: ["create_post"],
        requireSubredditAllowlist: true,
        allowedSubreddits: ["typescript"],
      },
      verboseErrors: false, // Test default production behavior
    });

    const writeTool = tools.get("create_post")?.tool;
    const result = await writeTool?.execute("tool-3", {
      subreddit: "askreddit",
      title: "hello",
      content: "world",
    });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("subreddit not in allowlist");
  });

  it("blocks reply/edit/delete writes outside allowlist", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: true,
        allowedTools: ["reply_to_post", "edit_post", "delete_comment"],
        requireSubredditAllowlist: true,
        allowedSubreddits: ["typescript"],
      },
    });

    const replyResult = await tools.get("reply_to_post")?.tool.execute("tool-3a", {
      post_id: "t3_abc",
      content: "hello",
      subreddit: "askreddit",
    });
    expect(replyResult?.isError).toBe(true);
    expect(replyResult?.content[0]?.text).toContain("subreddit not in allowlist");

    const editResult = await tools.get("edit_post")?.tool.execute("tool-3b", {
      thing_id: "t3_abc",
      new_text: "hello",
      subreddit: "askreddit",
    });
    expect(editResult?.isError).toBe(true);
    expect(editResult?.content[0]?.text).toContain("subreddit not in allowlist");

    const deleteResult = await tools.get("delete_comment")?.tool.execute("tool-3c", {
      thing_id: "t1_abc",
      subreddit: "askreddit",
    });
    expect(deleteResult?.isError).toBe(true);
    expect(deleteResult?.content[0]?.text).toContain("subreddit not in allowlist");
  });

  it("blocks write tools without subreddit when allowlist is required", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: true,
        allowedTools: ["reply_to_post", "edit_comment", "delete_post"],
        requireSubredditAllowlist: true,
        allowedSubreddits: ["typescript"],
      },
    });

    const replyResult = await tools.get("reply_to_post")?.tool.execute("tool-3d", {
      post_id: "t3_abc",
      content: "hello",
    });
    expect(replyResult?.isError).toBe(true);
    expect(replyResult?.content[0]?.text).toContain("subreddit is required");

    const editResult = await tools.get("edit_comment")?.tool.execute("tool-3e", {
      thing_id: "t1_abc",
      new_text: "hello",
    });
    expect(editResult?.isError).toBe(true);
    expect(editResult?.content[0]?.text).toContain("subreddit is required");

    const deleteResult = await tools.get("delete_post")?.tool.execute("tool-3f", {
      thing_id: "t3_abc",
    });
    expect(deleteResult?.isError).toBe(true);
    expect(deleteResult?.content[0]?.text).toContain("subreddit is required");
  });

  it("preserves non-allowlist write behavior when requireSubredditAllowlist=false", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: true,
        allowedTools: ["reply_to_post", "delete_comment"],
        requireSubredditAllowlist: false,
      },
      rateLimit: {
        writePerMinute: 10,
        minWriteIntervalMs: 0,
      },
    });

    const replyResult = await tools.get("reply_to_post")?.tool.execute("tool-3g", {
      post_id: "t3_abc",
      content: "hello",
    });

    expect(replyResult?.isError).toBe(false);

    const deleteResult = await tools.get("delete_comment")?.tool.execute("tool-3h", {
      thing_id: "t1_abc",
    });

    expect(deleteResult?.isError).toBe(false);
  });

  it("blocks delete tools unless allowDelete=true", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: false,
        allowedTools: ["delete_post"],
        requireSubredditAllowlist: false,
      },
      verboseErrors: false, // Test default production behavior
    });

    const deleteTool = tools.get("delete_post")?.tool;
    const result = await deleteTool?.execute("tool-4", { thing_id: "t3_abc" });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("explicit opt-in required");
  });

  it("allows write tool when enabled and credentials exist", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: false,
        allowedTools: ["create_post"],
        requireSubredditAllowlist: true,
        allowedSubreddits: ["typescript"],
      },
    });

    const writeTool = tools.get("create_post")?.tool;
    const result = await writeTool?.execute("tool-5", {
      subreddit: "typescript",
      title: "hello",
      content: "world",
    });

    expect(result?.isError).toBe(false);
    expect(bridgeCallTool).toHaveBeenCalledWith(
      "create_post",
      expect.objectContaining({ subreddit: "typescript" }),
    );
  });

  it("uses subreddit for policy checks but strips wrapper-only subreddit before upstream write call", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: false,
        allowedTools: ["reply_to_post"],
        requireSubredditAllowlist: true,
        allowedSubreddits: ["typescript"],
      },
      rateLimit: {
        writePerMinute: 10,
        minWriteIntervalMs: 0,
      },
    });

    const result = await tools.get("reply_to_post")?.tool.execute("tool-5b", {
      post_id: "t3_abc",
      content: "hello",
      subreddit: "typescript",
    });

    expect(result?.isError).toBe(false);

    const call = bridgeCallTool.mock.calls.at(-1);
    expect(call?.[0]).toBe("reply_to_post");
    expect(call?.[1]).toEqual(
      expect.objectContaining({
        post_id: "t3_abc",
        content: "hello",
      }),
    );
    expect(call?.[1]).not.toHaveProperty("subreddit");
  });

  it("enforces write rate limit", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowedTools: ["reply_to_post"],
        requireSubredditAllowlist: false,
      },
      rateLimit: {
        writePerMinute: 1,
        minWriteIntervalMs: 0,
      },
    });

    const writeTool = tools.get("reply_to_post")?.tool;

    const first = await writeTool?.execute("tool-6", {
      post_id: "t3_abc",
      content: "first",
    });
    expect(first?.isError).toBe(false);

    const second = await writeTool?.execute("tool-7", {
      post_id: "t3_abc",
      content: "second",
    });

    expect(second?.isError).toBe(true);
    expect(second?.content[0]?.text).toContain("Rate limit");
  });

  it("exposes status gateway method and handles status errors", async () => {
    const { methods } = registerPlugin({});
    const statusHandler = methods.get("openclaw-plugin-reddit.status");

    const respondOk = vi.fn();
    await statusHandler?.({ respond: respondOk });

    expect(respondOk).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        mode: expect.objectContaining({ writeEnabled: false }),
        bridge: expect.objectContaining({ connected: true }),
        parity: expect.objectContaining({
          checkedAt: null,
          missingExpectedTools: [],
          unexpectedUpstreamTools: [],
        }),
      }),
    );

    bridgeStatus.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const respondError = vi.fn();
    await statusHandler?.({ respond: respondError });

    expect(respondError).toHaveBeenCalledWith(false, expect.objectContaining({ error: "boom" }));
  });

  it("runs service startup checks, parity warnings, and stop cleanup", async () => {
    const { services, logger, methods } = registerPlugin({});
    const service = services[0];
    expect(service?.id).toBe("openclaw-plugin-reddit");

    bridgeListTools.mockResolvedValueOnce(
      [{ name: READ_TOOL_NAMES[0] }, { name: "new_upstream_tool" }] as Array<{ name: string }>,
    );
    await service?.start();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("missing expected tools"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("unwrapped tools"));
    expect(logger.info).toHaveBeenCalled();

    const statusHandler = methods.get("openclaw-plugin-reddit.status");
    const respondAfterStart = vi.fn();
    await statusHandler?.({ respond: respondAfterStart });
    expect(respondAfterStart).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        parity: expect.objectContaining({
          checkedAt: expect.any(String),
          upstreamToolCount: 2,
          unexpectedUpstreamTools: ["new_upstream_tool"],
        }),
      }),
    );

    bridgeListTools.mockRejectedValueOnce(new Error("startup-failed"));
    await service?.start();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("startup-failed"));

    const respondAfterFailure = vi.fn();
    await statusHandler?.({ respond: respondAfterFailure });
    expect(respondAfterFailure).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        parity: expect.objectContaining({
          error: "startup-failed",
        }),
      }),
    );

    await service?.stop?.();
    expect(bridgeClose).toHaveBeenCalled();
  });

  it("keeps startup non-fatal by default when bridge checks fail", async () => {
    const { services, logger } = registerPlugin({
      strictStartup: false,
    });

    const service = services[0];
    bridgeListTools.mockRejectedValueOnce(new Error("bridge-down"));

    await expect(service?.start()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("bridge-down"));
  });

  it("fails startup in strict mode when bridge checks fail", async () => {
    const { services, logger } = registerPlugin({
      strictStartup: true,
    });

    const service = services[0];
    bridgeListTools.mockRejectedValueOnce(new Error("bridge-down"));

    await expect(service?.start()).rejects.toThrow("bridge-down");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("bridge-down"));
  });

  it("fails startup in strict mode when parity drifts", async () => {
    const { services } = registerPlugin({
      strictStartup: true,
    });

    const service = services[0];
    bridgeListTools.mockResolvedValueOnce([{ name: READ_TOOL_NAMES[0] }] as Array<{ name: string }>);

    await expect(service?.start()).rejects.toThrow("startup parity check failed");
  });

  it("registers CLI command and prints status", () => {
    const { cliRegistrar } = registerPlugin({});
    expect(cliRegistrar).toBeDefined();

    let actionHandler: (() => void) | undefined;
    const fakeProgram = {
      command: (name: string) => {
        void name;
        return {
          description: (desc: string) => {
            void desc;
            return {
              action: (handler: () => void) => {
                actionHandler = handler;
              },
            };
          },
        };
      },
    };

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    cliRegistrar?.({ program: fakeProgram });
    actionHandler?.();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("registers successfully when CLI registrar is not provided", () => {
    const tools = new Map<string, ToolDefinition>();

    const apiWithoutCli: OpenClawPluginApi = {
      id: "openclaw-plugin-reddit",
      config: {},
      pluginConfig: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      registerTool: (tool) => {
        tools.set(tool.name, tool);
      },
      registerService: vi.fn(),
      registerGatewayMethod: vi.fn(),
    };

    expect(() => plugin.register(apiWithoutCli)).not.toThrow();
    expect(tools.size).toBe(ALL_TOOL_NAMES.length);
  });
});
