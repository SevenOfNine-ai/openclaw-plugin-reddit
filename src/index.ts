import {
  parsePluginConfig,
  resolveRedditEnvironment,
  validateCredentialReadiness,
  type PluginConfig,
} from "./config.js";
import type { OpenClawPluginApi, ToolResult } from "./openclaw-api.js";
import { WritePolicyGuard } from "./policy.js";
import { RedditMcpBridge, buildLaunchSpec, extractTextFromToolResult } from "./reddit-mcp-bridge.js";
import { RedditRatePolicy } from "./rate-limit.js";
import { ALL_TOOL_NAMES, TOOL_SPECS, isWriteTool } from "./tool-specs.js";

function asErrorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
    isError: true,
  };
}

type ParitySnapshot = {
  checkedAt: string | null;
  upstreamToolCount: number | null;
  missingExpectedTools: string[];
  unexpectedUpstreamTools: string[];
  error: string | null;
};

function buildStatusPayload(
  config: PluginConfig,
  bridge: RedditMcpBridge,
  ratePolicy: RedditRatePolicy,
  parity: ParitySnapshot,
) {
  return {
    mode: {
      writeEnabled: config.write.enabled,
      deleteEnabled: config.write.allowDelete,
      requireSubredditAllowlist: config.write.requireSubredditAllowlist,
      allowedTools: [...config.write.allowedTools],
      allowedSubreddits: [...config.write.allowedSubreddits],
    },
    bridge: bridge.status(),
    rateLimit: ratePolicy.snapshot(),
    parity,
  };
}

const plugin = {
  id: "openclaw-plugin-reddit",
  name: "OpenClaw Reddit Plugin",
  description: "Reddit MCP wrapper for OpenClaw with secure read-only defaults.",

  register(api: OpenClawPluginApi): void {
    const config = parsePluginConfig(api.pluginConfig ?? {});
    const resolvedEnv = resolveRedditEnvironment(config, process.env);
    const launchSpec = buildLaunchSpec(config, resolvedEnv, process.env);

    const bridge = new RedditMcpBridge(launchSpec, config.startupTimeoutMs);
    const ratePolicy = new RedditRatePolicy(config.rateLimit);
    const writeGuard = new WritePolicyGuard(config.write);

    const parity: ParitySnapshot = {
      checkedAt: null,
      upstreamToolCount: null,
      missingExpectedTools: [],
      unexpectedUpstreamTools: [],
      error: null,
    };

    const credentialErrors = validateCredentialReadiness(config, resolvedEnv);
    if (credentialErrors.length > 0) {
      api.logger.warn(`[openclaw-plugin-reddit] ${credentialErrors.join(" ")}`);
    }

    const executeTool = async (toolName: string, params: unknown): Promise<ToolResult> => {
      try {
        if (isWriteTool(toolName)) {
          if (credentialErrors.length > 0) {
            throw new Error(`Write blocked: ${credentialErrors.join(" ")}`);
          }

          writeGuard.ensureToolAllowed(toolName, params);
          const writeRate = ratePolicy.checkWrite();
          if (!writeRate.ok) {
            throw new Error(
              `Rate limit: write tool '${toolName}' blocked. Retry in ${writeRate.retryAfterMs}ms.`,
            );
          }
        } else {
          const readRate = ratePolicy.checkRead();
          if (!readRate.ok) {
            throw new Error(
              `Rate limit: read tool '${toolName}' blocked. Retry in ${readRate.retryAfterMs}ms.`,
            );
          }
        }

        const result = await bridge.callTool(toolName, params);
        const text = extractTextFromToolResult(result);
        return {
          content: [{ type: "text", text }],
          details: {
            tool: toolName,
            mode: isWriteTool(toolName) ? "write" : "read",
            raw: result,
          },
          isError:
            !!result &&
            typeof result === "object" &&
            "isError" in result &&
            Boolean((result as { isError?: unknown }).isError),
        };
      } catch (error) {
        return asErrorResult(error);
      }
    };

    for (const toolName of ALL_TOOL_NAMES) {
      const spec = TOOL_SPECS[toolName];
      api.registerTool(
        {
          name: spec.name,
          description: spec.description,
          parameters: spec.parameters,
          execute: async (_toolCallId, params) => executeTool(toolName, params),
        },
        isWriteTool(toolName) ? { optional: true } : undefined,
      );
    }

    api.registerGatewayMethod("openclaw-plugin-reddit.status", async ({ respond }) => {
      try {
        respond(true, buildStatusPayload(config, bridge, ratePolicy, parity));
      } catch (error) {
        respond(false, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    api.registerService({
      id: "openclaw-plugin-reddit",
      start: async () => {
        try {
          const tools = await bridge.listTools();
          const upstreamNames = tools.map((entry) => entry.name);
          const available = new Set(upstreamNames);

          const missingExpectedTools = ALL_TOOL_NAMES.filter((toolName) => !available.has(toolName));
          const expected = new Set<string>(ALL_TOOL_NAMES);
          const unexpectedUpstreamTools = upstreamNames.filter((name) => !expected.has(name));

          parity.checkedAt = new Date().toISOString();
          parity.upstreamToolCount = upstreamNames.length;
          parity.missingExpectedTools = missingExpectedTools;
          parity.unexpectedUpstreamTools = unexpectedUpstreamTools;
          parity.error = null;

          if (missingExpectedTools.length > 0) {
            api.logger.warn(
              `[openclaw-plugin-reddit] MCP server missing expected tools: ${missingExpectedTools.join(", ")}`,
            );
          }

          if (unexpectedUpstreamTools.length > 0) {
            api.logger.warn(
              `[openclaw-plugin-reddit] MCP server exposes unwrapped tools: ${unexpectedUpstreamTools.join(", ")}`,
            );
          }

          api.logger.info(
            `[openclaw-plugin-reddit] ready. bridge=${bridge.status().command} args=${bridge
              .status()
              .args.join(" ")}`,
          );
        } catch (error) {
          parity.checkedAt = new Date().toISOString();
          parity.error = error instanceof Error ? error.message : String(error);
          api.logger.error(
            `[openclaw-plugin-reddit] startup bridge check failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      stop: async () => {
        await bridge.close();
      },
    });

    api.registerCli?.(
      ({ program }) => {
        program
          .command("reddit-status")
          .description("Show OpenClaw Reddit plugin status")
          .action(() => {
            const payload = buildStatusPayload(config, bridge, ratePolicy, parity);
            console.log(JSON.stringify(payload, null, 2));
          });
      },
      { commands: ["reddit-status"] },
    );
  },
};

export default plugin;
