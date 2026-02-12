import { z } from "zod";
import { WRITE_TOOL_NAMES } from "./tool-specs.js";

export const AUTH_MODES = ["auto", "authenticated", "anonymous"] as const;
export const SAFE_MODES = ["off", "standard", "strict"] as const;
export const CREDENTIAL_PROVIDERS = ["git-credential", "pass-cli", "env"] as const;

const envVarNameSchema = z.string().trim().min(1);

const pluginConfigSchema = z
  .object({
    command: z.string().trim().min(1).optional(),
    args: z.array(z.string()).optional(),
    startupTimeoutMs: z.number().int().min(1000).max(120_000).default(15_000),
    verboseErrors: z.boolean().default(false),
    strictStartup: z.boolean().default(false),
    reddit: z
      .object({
        authMode: z.enum(AUTH_MODES).default("auto"),
        credentialProvider: z.enum(CREDENTIAL_PROVIDERS).default("git-credential"),
        username: z.string().trim().min(1).optional(),
        safeModeReadOnly: z.enum(SAFE_MODES).default("off"),
        safeModeWriteEnabled: z.enum(SAFE_MODES).default("strict"),
        env: z
          .object({
            clientId: envVarNameSchema.default("REDDIT_CLIENT_ID"),
            clientSecret: envVarNameSchema.default("REDDIT_CLIENT_SECRET"),
            username: envVarNameSchema.default("REDDIT_USERNAME"),
            password: envVarNameSchema.default("REDDIT_PASSWORD"),
            userAgent: envVarNameSchema.default("REDDIT_USER_AGENT"),
          })
          .default({
            clientId: "REDDIT_CLIENT_ID",
            clientSecret: "REDDIT_CLIENT_SECRET",
            username: "REDDIT_USERNAME",
            password: "REDDIT_PASSWORD",
            userAgent: "REDDIT_USER_AGENT",
          }),
        gitCredential: z
          .object({
            host: z.string().trim().min(1).default("reddit.com"),
            clientSecretPath: z.string().trim().min(1).default("oauth-client-secret"),
            passwordPath: z.string().trim().min(1).default("password"),
          })
          .default({
            host: "reddit.com",
            clientSecretPath: "oauth-client-secret",
            passwordPath: "password",
          }),
        passCli: z
          .object({
            command: z.string().trim().min(1).default("pass-cli"),
            clientSecretKey: z.string().trim().min(1).optional(),
            passwordKey: z.string().trim().min(1).optional(),
          })
          .default({
            command: "pass-cli",
          }),
      })
      .default({
        authMode: "auto",
        credentialProvider: "git-credential",
        safeModeReadOnly: "off",
        safeModeWriteEnabled: "strict",
        env: {
          clientId: "REDDIT_CLIENT_ID",
          clientSecret: "REDDIT_CLIENT_SECRET",
          username: "REDDIT_USERNAME",
          password: "REDDIT_PASSWORD",
          userAgent: "REDDIT_USER_AGENT",
        },
        gitCredential: {
          host: "reddit.com",
          clientSecretPath: "oauth-client-secret",
          passwordPath: "password",
        },
        passCli: {
          command: "pass-cli",
        },
      }),
    write: z
      .object({
        enabled: z.boolean().default(false),
        allowDelete: z.boolean().default(false),
        allowedTools: z.array(z.enum(WRITE_TOOL_NAMES)).default([]),
        requireSubredditAllowlist: z.boolean().default(true),
        allowedSubreddits: z.array(z.string()).default([]),
      })
      .default({
        enabled: false,
        allowDelete: false,
        allowedTools: [],
        requireSubredditAllowlist: true,
        allowedSubreddits: [],
      }),
    rateLimit: z
      .object({
        readPerMinute: z.number().int().min(1).max(10_000).default(60),
        writePerMinute: z.number().int().min(1).max(1_000).default(6),
        minWriteIntervalMs: z.number().int().min(0).max(600_000).default(5_000),
      })
      .default({
        readPerMinute: 60,
        writePerMinute: 6,
        minWriteIntervalMs: 5000,
      }),
  })
  .strict();

export type PluginConfig = z.infer<typeof pluginConfigSchema> & {
  write: z.infer<typeof pluginConfigSchema>["write"] & {
    allowedSubreddits: string[];
    allowedTools: Array<(typeof WRITE_TOOL_NAMES)[number]>;
  };
};

export type ResolvedRedditEnv = {
  REDDIT_CLIENT_ID: string | undefined;
  REDDIT_CLIENT_SECRET: string | undefined;
  REDDIT_USERNAME: string | undefined;
  REDDIT_PASSWORD: string | undefined;
  REDDIT_USER_AGENT: string | undefined;
};

export function parsePluginConfig(raw: unknown): PluginConfig {
  const parsed = pluginConfigSchema.parse(raw ?? {});
  const allowedSubreddits = normalizeSubreddits(parsed.write.allowedSubreddits);
  const allowedTools = [...new Set(parsed.write.allowedTools)];

  return {
    ...parsed,
    write: {
      ...parsed.write,
      allowedSubreddits,
      allowedTools,
    },
  };
}

export function normalizeSubreddit(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith("r/") ? trimmed.slice(2) : trimmed;
  return withoutPrefix;
}

export function normalizeSubreddits(input: string[]): string[] {
  const set = new Set<string>();
  for (const value of input) {
    const normalized = normalizeSubreddit(value);
    if (normalized) {
      set.add(normalized);
    }
  }
  return [...set];
}

export function resolveRedditEnvironment(
  config: PluginConfig,
  environment: NodeJS.ProcessEnv,
): ResolvedRedditEnv {
  const read = (name: string): string | undefined => {
    const value = environment[name];
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  return {
    REDDIT_CLIENT_ID: read(config.reddit.env.clientId),
    REDDIT_CLIENT_SECRET: read(config.reddit.env.clientSecret),
    REDDIT_USERNAME: read(config.reddit.env.username),
    REDDIT_PASSWORD: read(config.reddit.env.password),
    REDDIT_USER_AGENT: read(config.reddit.env.userAgent),
  };
}

export function resolveConfiguredUsername(config: PluginConfig, env: ResolvedRedditEnv): string | undefined {
  if (config.reddit.username) {
    return config.reddit.username;
  }

  if (config.reddit.credentialProvider === "env") {
    return env.REDDIT_USERNAME;
  }

  return undefined;
}

export function resolveSafeMode(config: PluginConfig): (typeof SAFE_MODES)[number] {
  return config.write.enabled ? config.reddit.safeModeWriteEnabled : config.reddit.safeModeReadOnly;
}

export function validateCredentialReadiness(config: PluginConfig, env: ResolvedRedditEnv): string[] {
  const errors: string[] = [];
  const username = resolveConfiguredUsername(config, env);

  if (config.reddit.authMode === "authenticated" && !env.REDDIT_CLIENT_ID) {
    errors.push("Missing Reddit client ID for authenticated mode.");
  }

  if (config.reddit.credentialProvider === "env") {
    if (config.reddit.authMode === "authenticated" && !env.REDDIT_CLIENT_SECRET) {
      errors.push("Missing Reddit client secret for authenticated mode.");
    }
    if (config.write.enabled && !env.REDDIT_PASSWORD) {
      errors.push("Write mode enabled but Reddit password is missing (env provider).");
    }
  } else if (config.reddit.credentialProvider === "pass-cli") {
    if (!config.reddit.passCli.clientSecretKey) {
      errors.push("pass-cli provider requires reddit.passCli.clientSecretKey.");
    }
    if (config.write.enabled && !config.reddit.passCli.passwordKey) {
      errors.push("Write mode enabled but reddit.passCli.passwordKey is missing.");
    }
  }

  if (config.write.enabled && !username) {
    errors.push("Write mode enabled but Reddit username is missing (set reddit.username). ");
  }

  return errors;
}
