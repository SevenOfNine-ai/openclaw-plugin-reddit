import { isWriteTool } from "./tool-specs.js";

export type WritePolicyConfig = {
  enabled: boolean;
  allowDelete: boolean;
  requireSubredditAllowlist: boolean;
  allowedSubreddits: string[];
};

export class WritePolicyGuard {
  private readonly allowedSubreddits: Set<string>;

  public constructor(private readonly config: WritePolicyConfig) {
    this.allowedSubreddits = new Set(config.allowedSubreddits.map((entry) => entry.toLowerCase()));
  }

  public ensureToolAllowed(toolName: string, params: unknown): void {
    if (!isWriteTool(toolName)) {
      return;
    }

    if (!this.config.enabled) {
      throw new Error(
        `Write tool '${toolName}' is blocked: write mode is disabled. ` +
          "Enable write mode explicitly in plugin config.",
      );
    }

    if ((toolName === "delete_post" || toolName === "delete_comment") && !this.config.allowDelete) {
      throw new Error(
        `Write tool '${toolName}' is blocked: delete operations require write.allowDelete=true.`,
      );
    }

    if (toolName === "create_post" && this.config.requireSubredditAllowlist) {
      const subreddit = this.readSubreddit(params);
      if (!subreddit) {
        throw new Error("create_post blocked: subreddit is required for allowlist validation.");
      }
      if (!this.allowedSubreddits.has(subreddit.toLowerCase())) {
        throw new Error(
          `create_post blocked: subreddit '${subreddit}' is not in write.allowedSubreddits allowlist.`,
        );
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
