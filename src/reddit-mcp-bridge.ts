import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { PluginConfig, ResolvedRedditEnv } from "./config.js";
import { resolveSafeMode } from "./config.js";

export type LaunchSpec = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

const CHILD_ENV_ALLOW_EXACT = new Set([
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "TERM",
  "TZ",
  "SYSTEMROOT",
  "COMSPEC",
  "PATHEXT",
  "WINDIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "ALL_PROXY",
  "all_proxy",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "OPENSSL_CONF",
]);

const CHILD_ENV_ALLOW_PREFIXES = ["LC_"];

export function findInstalledPackageDir(packageName: string, fromDir: string): string {
  let current = path.resolve(fromDir);
  while (true) {
    const candidate = path.join(current, "node_modules", packageName);
    const packageJson = path.join(candidate, "package.json");
    if (fs.existsSync(packageJson)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to resolve package directory for '${packageName}' from '${fromDir}'`);
}

export function resolveRedditMcpLaunch(commandOverride?: string, argsOverride?: string[]): {
  command: string;
  args: string[];
  packageDir: string;
} {
  if (commandOverride) {
    return {
      command: commandOverride,
      args: argsOverride ?? [],
      packageDir: "<override>",
    };
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const packageDir = findInstalledPackageDir("reddit-mcp-server", moduleDir);

  const distBin = path.join(packageDir, "dist", "bin.js");
  if (fs.existsSync(distBin)) {
    return {
      command: process.execPath,
      args: [distBin],
      packageDir,
    };
  }

  const srcIndex = path.join(packageDir, "src", "index.ts");
  if (fs.existsSync(srcIndex)) {
    return {
      command: process.execPath,
      args: ["--import", "tsx", srcIndex],
      packageDir,
    };
  }

  throw new Error(
    `reddit-mcp-server entrypoint not found in ${packageDir}. Expected dist/bin.js or src/index.ts.`,
  );
}

export function buildChildProcessEnv(baseEnv: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value !== "string") {
      continue;
    }

    const allowByExact = CHILD_ENV_ALLOW_EXACT.has(key);
    const allowByPrefix = CHILD_ENV_ALLOW_PREFIXES.some((prefix) => key.startsWith(prefix));

    if (allowByExact || allowByPrefix) {
      result[key] = value;
    }
  }

  return result;
}

export function buildLaunchSpec(
  config: PluginConfig,
  resolvedEnv: ResolvedRedditEnv,
  baseEnv: NodeJS.ProcessEnv,
): LaunchSpec {
  const safeMode = resolveSafeMode(config);

  const env = buildChildProcessEnv(baseEnv);

  env.REDDIT_AUTH_MODE = config.reddit.authMode;
  env.REDDIT_SAFE_MODE = safeMode;

  if (resolvedEnv.REDDIT_CLIENT_ID) {
    env.REDDIT_CLIENT_ID = resolvedEnv.REDDIT_CLIENT_ID;
  }
  if (resolvedEnv.REDDIT_CLIENT_SECRET) {
    env.REDDIT_CLIENT_SECRET = resolvedEnv.REDDIT_CLIENT_SECRET;
  }
  if (resolvedEnv.REDDIT_USERNAME) {
    env.REDDIT_USERNAME = resolvedEnv.REDDIT_USERNAME;
  }
  if (resolvedEnv.REDDIT_PASSWORD) {
    env.REDDIT_PASSWORD = resolvedEnv.REDDIT_PASSWORD;
  }
  if (resolvedEnv.REDDIT_USER_AGENT) {
    env.REDDIT_USER_AGENT = resolvedEnv.REDDIT_USER_AGENT;
  }

  const launch = resolveRedditMcpLaunch(config.command, config.args);

  return {
    command: launch.command,
    args: launch.args,
    env,
  };
}

export function extractTextFromToolResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return JSON.stringify(result, null, 2);
  }

  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return JSON.stringify(result, null, 2);
  }

  const texts = content
    .map((chunk) => {
      if (!chunk || typeof chunk !== "object") {
        return "";
      }
      const asRecord = chunk as Record<string, unknown>;
      if (typeof asRecord.text === "string") {
        return asRecord.text;
      }
      if (typeof asRecord.data === "string") {
        return asRecord.data;
      }
      return "";
    })
    .filter(Boolean);

  if (texts.length === 0) {
    return JSON.stringify(result, null, 2);
  }

  return texts.join("\n");
}

export class RedditMcpBridge {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  public constructor(
    private readonly launchSpec: LaunchSpec,
    private readonly startupTimeoutMs: number,
  ) {}

  public async connect(): Promise<void> {
    if (this.connected && this.client && this.transport) {
      return;
    }

    const client = new Client({
      name: "openclaw-plugin-reddit",
      version: "0.1.0",
    });

    const transport = new StdioClientTransport({
      command: this.launchSpec.command,
      args: this.launchSpec.args,
      env: this.launchSpec.env,
    });

    transport.onclose = () => {
      this.connected = false;
    };

    transport.onerror = () => {
      this.connected = false;
    };

    await withTimeout(client.connect(transport), this.startupTimeoutMs, "MCP connect timeout");

    this.client = client;
    this.transport = transport;
    this.connected = true;
  }

  public async listTools(): Promise<Array<{ name: string; description?: string | undefined; inputSchema?: unknown }>> {
    await this.connect();
    const result = await this.client?.listTools();
    return result?.tools ?? [];
  }

  public async callTool(toolName: string, params: unknown): Promise<unknown> {
    await this.connect();

    try {
      return await this.client?.callTool({
        name: toolName,
        arguments: asObject(params),
      });
    } catch (error) {
      if (!isRecoverableTransportError(error)) {
        throw error;
      }

      await this.reconnect();
      return await this.client?.callTool({
        name: toolName,
        arguments: asObject(params),
      });
    }
  }

  public status(): {
    connected: boolean;
    command: string;
    args: string[];
  } {
    return {
      connected: this.connected,
      command: this.launchSpec.command,
      args: [...this.launchSpec.args],
    };
  }

  public async close(): Promise<void> {
    this.connected = false;

    if (this.transport) {
      await this.transport.close();
    }

    this.transport = null;
    this.client = null;
  }

  private async reconnect(): Promise<void> {
    await this.close();
    await this.connect();
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function isRecoverableTransportError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("closed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("EPIPE") ||
    message.includes("not connected")
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
