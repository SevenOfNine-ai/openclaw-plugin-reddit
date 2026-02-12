import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { PluginConfig, ResolvedRedditEnv } from "./config.js";
import { resolveConfiguredUsername, resolveSafeMode } from "./config.js";

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

const RECOVERABLE_TRANSPORT_ERROR_CODES = new Set([
  "EPIPE",
  "ECONNRESET",
  "ECONNREFUSED",
  "ERR_STREAM_DESTROYED",
  "ERR_IPC_CHANNEL_CLOSED",
]);

type DisconnectReason = "none" | "close" | "error";

type BridgeLifecycle = {
  disconnectCount: number;
  reconnectCount: number;
  pendingReconnect: boolean;
  lastDisconnectReason: DisconnectReason;
  lastDisconnectCode: string | null;
};

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
  const provider = config.reddit.credentialProvider;
  const username = resolveConfiguredUsername(config, resolvedEnv);

  const env = buildChildProcessEnv(baseEnv);

  env.REDDIT_AUTH_MODE = config.reddit.authMode;
  env.REDDIT_SAFE_MODE = safeMode;
  env.REDDIT_CREDENTIAL_PROVIDER = provider;

  if (resolvedEnv.REDDIT_CLIENT_ID) {
    env.REDDIT_CLIENT_ID = resolvedEnv.REDDIT_CLIENT_ID;
  }
  if (resolvedEnv.REDDIT_USER_AGENT) {
    env.REDDIT_USER_AGENT = resolvedEnv.REDDIT_USER_AGENT;
  }

  if (provider === "env") {
    if (resolvedEnv.REDDIT_CLIENT_SECRET) {
      env.REDDIT_CLIENT_SECRET = resolvedEnv.REDDIT_CLIENT_SECRET;
    }
    if (resolvedEnv.REDDIT_PASSWORD) {
      env.REDDIT_PASSWORD = resolvedEnv.REDDIT_PASSWORD;
    }
    if (resolvedEnv.REDDIT_USERNAME) {
      env.REDDIT_USERNAME = resolvedEnv.REDDIT_USERNAME;
    }
  }

  if (provider === "pass-cli") {
    env.REDDIT_PASS_CLI_COMMAND = config.reddit.passCli.command;
    if (config.reddit.passCli.clientSecretKey) {
      env.REDDIT_PASS_CLI_CLIENT_SECRET_KEY = config.reddit.passCli.clientSecretKey;
    }
    if (config.reddit.passCli.passwordKey) {
      env.REDDIT_PASS_CLI_PASSWORD_KEY = config.reddit.passCli.passwordKey;
    }
  }

  if (provider === "git-credential") {
    env.REDDIT_GIT_CREDENTIAL_HOST = config.reddit.gitCredential.host;
    env.REDDIT_GIT_CREDENTIAL_CLIENT_SECRET_PATH = config.reddit.gitCredential.clientSecretPath;
    env.REDDIT_GIT_CREDENTIAL_PASSWORD_PATH = config.reddit.gitCredential.passwordPath;
  }

  const launch = resolveRedditMcpLaunch(config.command, config.args);
  const launchArgs = [...launch.args];

  launchArgs.push("--credential-provider", provider, "--auth-mode", config.reddit.authMode, "--safe-mode", safeMode);
  if (username) {
    launchArgs.push("--username", username);
  }
  if (resolvedEnv.REDDIT_CLIENT_ID) {
    launchArgs.push("--client-id", resolvedEnv.REDDIT_CLIENT_ID);
  }
  if (resolvedEnv.REDDIT_USER_AGENT) {
    launchArgs.push("--user-agent", resolvedEnv.REDDIT_USER_AGENT);
  }

  return {
    command: launch.command,
    args: launchArgs,
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
  private lifecycle: BridgeLifecycle = {
    disconnectCount: 0,
    reconnectCount: 0,
    pendingReconnect: false,
    lastDisconnectReason: "none",
    lastDisconnectCode: null,
  };

  public constructor(
    private readonly launchSpec: LaunchSpec,
    private readonly startupTimeoutMs: number,
  ) {}

  public async connect(): Promise<void> {
    if (this.connected && this.client && this.transport && !this.lifecycle.pendingReconnect) {
      return;
    }

    if (this.client || this.transport) {
      await this.close();
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
      this.markDisconnected("close");
    };

    transport.onerror = (error) => {
      this.markDisconnected("error", error);
    };

    await withTimeout(client.connect(transport), this.startupTimeoutMs, "MCP connect timeout");

    this.client = client;
    this.transport = transport;
    this.connected = true;
    this.lifecycle.pendingReconnect = false;
  }

  public async listTools(): Promise<Array<{ name: string; description?: string | undefined; inputSchema?: unknown }>> {
    await this.connect();

    const client = this.client;
    if (!client) {
      throw new Error("MCP client is not connected.");
    }

    const result = await client.listTools();
    return result.tools ?? [];
  }

  public async callTool(toolName: string, params: unknown): Promise<unknown> {
    await this.connect();

    try {
      return await this.callToolOnce(toolName, params);
    } catch (error) {
      if (!this.shouldReconnectAfterError(error)) {
        throw error;
      }

      await this.reconnect();
      return await this.callToolOnce(toolName, params);
    }
  }

  public status(): {
    connected: boolean;
    command: string;
    args: string[];
    lifecycle: BridgeLifecycle;
  } {
    return {
      connected: this.connected,
      command: this.launchSpec.command,
      args: [...this.launchSpec.args],
      lifecycle: { ...this.lifecycle },
    };
  }

  public async close(): Promise<void> {
    this.connected = false;

    try {
      if (this.transport) {
        await this.transport.close();
      }
    } catch {
      // Best-effort shutdown: transport may already be torn down.
    } finally {
      this.transport = null;
      this.client = null;
    }
  }

  private async reconnect(): Promise<void> {
    this.lifecycle.reconnectCount += 1;
    await this.close();
    await this.connect();
  }

  private async callToolOnce(toolName: string, params: unknown): Promise<unknown> {
    const client = this.client;
    if (!client) {
      throw new Error("MCP client is not connected.");
    }

    return await client.callTool({
      name: toolName,
      arguments: asObject(params),
    });
  }

  private markDisconnected(reason: DisconnectReason, error?: unknown): void {
    this.connected = false;
    this.lifecycle.pendingReconnect = true;
    this.lifecycle.disconnectCount += 1;
    this.lifecycle.lastDisconnectReason = reason;
    this.lifecycle.lastDisconnectCode = readRecoverableErrorCode(error);
  }

  private shouldReconnectAfterError(error: unknown): boolean {
    if (this.lifecycle.pendingReconnect || !this.connected || !this.client || !this.transport) {
      return true;
    }

    return isRecoverableTransportError(error);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readUnknownCode(value: unknown): string | number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const code = (value as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") {
    return code;
  }

  return undefined;
}

function readUnknownCause(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return (value as { cause?: unknown }).cause;
}

function hasConnectionClosedCode(error: unknown, depth: number = 0): boolean {
  if (depth > 4) {
    return false;
  }

  const code = readUnknownCode(error);
  if (code === ErrorCode.ConnectionClosed) {
    return true;
  }

  const cause = readUnknownCause(error);
  if (cause !== undefined) {
    return hasConnectionClosedCode(cause, depth + 1);
  }

  return false;
}

function readRecoverableErrorCode(error: unknown, depth: number = 0): string | null {
  if (depth > 4) {
    return null;
  }

  const code = readUnknownCode(error);
  if (typeof code === "string" && RECOVERABLE_TRANSPORT_ERROR_CODES.has(code)) {
    return code;
  }

  const cause = readUnknownCause(error);
  if (cause !== undefined) {
    return readRecoverableErrorCode(cause, depth + 1);
  }

  return null;
}

export function isRecoverableTransportError(error: unknown): boolean {
  if (error instanceof McpError) {
    return error.code === ErrorCode.ConnectionClosed || readRecoverableErrorCode(error) !== null;
  }

  if (hasConnectionClosedCode(error)) {
    return true;
  }

  return readRecoverableErrorCode(error) !== null;
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
