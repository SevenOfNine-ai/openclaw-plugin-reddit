import { describe, expect, it } from "vitest";
import { parsePluginConfig, resolveRedditEnvironment } from "../../src/config.js";
import { RedditMcpBridge, buildLaunchSpec, extractTextFromToolResult } from "../../src/reddit-mcp-bridge.js";

describe("integration: pinned reddit-mcp-server harness", () => {
  it(
    "boots pinned reddit-mcp-server and executes test tool",
    async () => {
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
      const bridge = new RedditMcpBridge(launchSpec, 20_000);

      try {
        const tools = await bridge.listTools();
        const names = tools.map((entry) => entry.name);
        expect(names).toContain("test_reddit_mcp_server");

        const result = await bridge.callTool("test_reddit_mcp_server", {});
        const text = extractTextFromToolResult(result);

        expect(text).toContain("Reddit MCP Server Status");
        expect(text).toContain("Server: ✓ Running");
      } finally {
        await bridge.close();
      }
    },
    45_000,
  );
});
