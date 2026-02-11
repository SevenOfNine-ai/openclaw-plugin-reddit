import { isWriteTool } from "./tool-specs.js";

export type WritePolicyConfig = {
  enabled: boolean;
  allowDelete: boolean;
  allowedTools: string[];
  requireSubredditAllowlist: boolean;
  allowedSubreddits: string[];
  verboseErrors?: boolean;
};

export class WritePolicyGuard {
  private readonly allowedSubreddits: Set<string>;
  private readonly allowedWriteTools: Set<string>;
  private readonly verboseErrors: boolean;

  public constructor(private readonly config: WritePolicyConfig) {
    this.allowedSubreddits = new Set(config.allowedSubreddits.map((entry) => entry.toLowerCase()));
    this.allowedWriteTools = new Set(config.allowedTools);
    this.verboseErrors = config.verboseErrors ?? false;
  }

  public ensureToolAllowed(toolName: string, params: unknown): void {
    if (!isWriteTool(toolName)) {
      return;
    }

    if (!this.config.enabled) {
      const message = this.verboseErrors
        ? `Write tool '${toolName}' is blocked: write mode is disabled. Enable write mode explicitly in plugin config.`
        : "Write operation blocked: write mode is disabled.";
      throw new Error(message);
    }

    if (!this.allowedWriteTools.has(toolName)) {
      const message = this.verboseErrors
        ? `Write tool '${toolName}' is blocked: it is not listed in write.allowedTools.`
        : "Write operation blocked: tool not in allowlist.";
      throw new Error(message);
    }

    if ((toolName === "delete_post" || toolName === "delete_comment") && !this.config.allowDelete) {
      const message = this.verboseErrors
        ? `Write tool '${toolName}' is blocked: delete operations require write.allowDelete=true.`
        : "Delete operation blocked: explicit opt-in required.";
      throw new Error(message);
    }

    if (this.config.requireSubredditAllowlist) {
      const subreddit = this.readSubreddit(params);
      if (!subreddit) {
        const message = this.verboseErrors
          ? `Write tool '${toolName}' blocked: subreddit is required for allowlist validation when write.requireSubredditAllowlist=true.`
          : "Write operation blocked: subreddit is required for allowlist validation.";
        throw new Error(message);
      }

      if (!this.allowedSubreddits.has(subreddit)) {
        const message = this.verboseErrors
          ? `Write tool '${toolName}' blocked: subreddit '${subreddit}' is not in write.allowedSubreddits allowlist.`
          : "Write operation blocked: subreddit not in allowlist.";
        throw new Error(message);
      }
    }
  }

  private readSubreddit(params: unknown): string | undefined {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return undefined;
    }
    const value = (params as Record<string, unknown>).subreddit;
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith("r/") ? normalized.slice(2) : normalized;
  }
}
