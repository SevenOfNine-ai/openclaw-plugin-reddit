import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_TOOL_NAMES, READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "../../src/tool-specs.js";
import type { OpenClawPluginApi, ToolDefinition } from "../../src/openclaw-api.js";

const bridgeCallTool = vi.fn(async (name: string, params: unknown): Promise<unknown> => ({
  content: [{ type: "text", text: `ok:${name}:${JSON.stringify(params ?? {})}` }],
}));
const bridgeListTools = vi.fn(async () => ALL_TOOL_NAMES.map((name) => ({ name })));
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
        requireSubredditAllowlist: true,
        allowedSubreddits: ["typescript"],
      },
    });

    const writeTool = tools.get("create_post")?.tool;
    const result = await writeTool?.execute("tool-3", {
      subreddit: "askreddit",
      title: "hello",
      content: "world",
    });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("not in write.allowedSubreddits");
  });

  it("blocks delete tools unless allowDelete=true", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: false,
        requireSubredditAllowlist: false,
      },
    });

    const deleteTool = tools.get("delete_post")?.tool;
    const result = await deleteTool?.execute("tool-4", { thing_id: "t3_abc" });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain("allowDelete=true");
  });

  it("allows write tool when enabled and credentials exist", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
        allowDelete: false,
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

  it("enforces write rate limit", async () => {
    process.env.REDDIT_USERNAME = "user";
    process.env.REDDIT_PASSWORD = "pass";

    const { tools } = registerPlugin({
      write: {
        enabled: true,
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
      }),
    );

    bridgeStatus.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const respondError = vi.fn();
    await statusHandler?.({ respond: respondError });

    expect(respondError).toHaveBeenCalledWith(false, expect.objectContaining({ error: "boom" }));
  });

  it("runs service startup checks and stop cleanup", async () => {
    const { services, logger } = registerPlugin({});
    const service = services[0];
    expect(service?.id).toBe("openclaw-plugin-reddit");

    bridgeListTools.mockResolvedValueOnce([{ name: READ_TOOL_NAMES[0] }]);
    await service?.start();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();

    bridgeListTools.mockRejectedValueOnce(new Error("startup-failed"));
    await service?.start();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("startup-failed"));

    await service?.stop?.();
    expect(bridgeClose).toHaveBeenCalled();
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
});
