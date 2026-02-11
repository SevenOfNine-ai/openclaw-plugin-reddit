import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePluginConfig, resolveRedditEnvironment } from "../../src/config.js";
import { RedditMcpBridge, buildLaunchSpec, extractTextFromToolResult } from "../../src/reddit-mcp-bridge.js";

describe("integration: mock MCP harness", () => {
  it("connects to a mock stdio server and forwards tools/list + tools/call", async () => {
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

    const bridge = new RedditMcpBridge(launchSpec, 10_000);

    try {
      const tools = await bridge.listTools();
      const names = tools.map((entry) => entry.name);
      expect(names).toContain("get_top_posts");
      expect(names).toContain("create_post");

      const readResult = await bridge.callTool("get_top_posts", { subreddit: "typescript" });
      const readText = extractTextFromToolResult(readResult);
      expect(readText).toContain("mock-read");

      const writeResult = await bridge.callTool("create_post", {
        subreddit: "typescript",
        title: "hello",
        content: "world",
      });
      const writeText = extractTextFromToolResult(writeResult);
      expect(writeText).toContain("mock-write");
    } finally {
      await bridge.close();
    }
  });
});
