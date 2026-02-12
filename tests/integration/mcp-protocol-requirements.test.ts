import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { parsePluginConfig, resolveRedditEnvironment } from "../../src/config.js";
import { RedditMcpBridge, buildLaunchSpec } from "../../src/reddit-mcp-bridge.js";

/**
 * MCP spec references:
 * - Lifecycle / initialize: https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
 * - Tools (list/call): https://modelcontextprotocol.io/specification/2025-06-18/server/tools
 * - Errors / JSON-RPC behavior: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */

type Harness = {
  name: string;
  launchSpec: ReturnType<typeof buildLaunchSpec>;
  startupTimeoutMs: number;
  createBridge: () => RedditMcpBridge;
  successTool: { name: string; args: Record<string, unknown> };
};

function makeMockHarness(): Harness {
  const fixturePath = path.resolve("tests/fixtures/mock-mcp-server.mjs");

  const config = parsePluginConfig({
    command: process.execPath,
    args: [fixturePath],
    write: {
      enabled: true,
      requireSubredditAllowlist: false,
    },
  });

  const env = resolveRedditEnvironment(config, process.env);
  const launchSpec = buildLaunchSpec(config, env, process.env);

  return {
    name: "mock MCP fixture harness",
    launchSpec,
    startupTimeoutMs: 10_000,
    createBridge: () => new RedditMcpBridge(launchSpec, 10_000),
    successTool: {
      name: "get_top_posts",
      args: { subreddit: "typescript" },
    },
  };
}

function makePinnedHarness(): Harness {
  const config = parsePluginConfig({
    reddit: {
      authMode: "anonymous",
    },
    write: {
      enabled: false,
    },
  });

  const env = resolveRedditEnvironment(config, {
    ...process.env,
    REDDIT_AUTH_MODE: "anonymous",
  });

  const launchSpec = buildLaunchSpec(config, env, process.env);

  return {
    name: "pinned reddit-mcp-server launch path",
    launchSpec,
    startupTimeoutMs: 20_000,
    createBridge: () => new RedditMcpBridge(launchSpec, 20_000),
    successTool: {
      name: "test_reddit_mcp_server",
      args: {},
    },
  };
}

const harnesses: Harness[] = [makeMockHarness(), makePinnedHarness()];

describe.each(harnesses)("integration: MCP protocol requirements ($name)", ({ createBridge, successTool, launchSpec }) => {
  it("initialization lifecycle succeeds and server capabilities include tools", async () => {
    const bridge = createBridge();

    try {
      expect(bridge.status().connected).toBe(false);

      await bridge.listTools();
      const status = bridge.status();

      expect(status.connected).toBe(true);
      expect(status.lifecycle.disconnectCount).toBeGreaterThanOrEqual(0);
      expect(typeof status.lifecycle.pendingReconnect).toBe("boolean");

      // Separate probe to assert MCP initialize response includes tools capability.
      const client = new Client({ name: "mcp-protocol-probe", version: "0.1.0" });
      const transport = new StdioClientTransport({
        command: launchSpec.command,
        args: launchSpec.args,
        env: launchSpec.env,
      });

      try {
        await client.connect(transport);
        const capabilities = client.getServerCapabilities();

        expect(capabilities).toBeTruthy();
        expect(capabilities?.tools).toBeTruthy();
      } finally {
        await transport.close();
      }
    } finally {
      await bridge.close();
    }
  });

  it("tools/list returns tools with unique names and object inputSchema", async () => {
    const bridge = createBridge();

    try {
      const tools = await bridge.listTools();
      expect(tools.length).toBeGreaterThan(0);

      const names = tools.map((tool) => tool.name);
      expect(new Set(names).size).toBe(names.length);

      for (const tool of tools) {
        expect(typeof tool.inputSchema).toBe("object");
        expect(tool.inputSchema).not.toBeNull();
        expect(Array.isArray(tool.inputSchema)).toBe(false);
      }
    } finally {
      await bridge.close();
    }
  });

  it("tools/call success returns result content with at least one text item", async () => {
    const bridge = createBridge();

    try {
      const result = await bridge.callTool(successTool.name, successTool.args);
      const contentUnknown = (result as { content?: unknown }).content;

      expect(Array.isArray(contentUnknown)).toBe(true);
      const content: unknown[] = Array.isArray(contentUnknown) ? contentUnknown : [];
      expect(content.length).toBeGreaterThan(0);

      const hasTextItem = content.some((item: unknown) => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const entry = item as Record<string, unknown>;
        return entry.type === "text" && typeof entry.text === "string" && entry.text.length > 0;
      });

      expect(hasTextItem).toBe(true);
    } finally {
      await bridge.close();
    }
  });

  it("unknown tool call surfaces an error (protocol-level throw or tool error result)", async () => {
    const bridge = createBridge();

    try {
      let returnedErrorResult = false;

      try {
        const result = await bridge.callTool("__mcp_unknown_tool__", {});
        const asResult = result as { isError?: unknown; content?: unknown };
        const text = JSON.stringify(asResult.content ?? "").toLowerCase();

        returnedErrorResult = asResult.isError === true || text.includes("unknown") || text.includes("not found");
      } catch (error) {
        // Some servers surface unknown tools as protocol-level JSON-RPC errors (e.g. -32601 / MethodNotFound).
        if (error instanceof McpError) {
          expect([
            ErrorCode.MethodNotFound,
            ErrorCode.InvalidParams,
            ErrorCode.InternalError,
          ]).toContain(error.code);
        } else {
          expect(String(error).toLowerCase()).toMatch(/unknown|not\s*found|tool|method/);
        }
        returnedErrorResult = true;
      }

      expect(returnedErrorResult).toBe(true);
    } finally {
      await bridge.close();
    }
  });
});
