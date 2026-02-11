import { describe, expect, it } from "vitest";
import { WritePolicyGuard } from "../../src/policy.js";

describe("WritePolicyGuard", () => {
  it("allows read tools always", () => {
    const guard = new WritePolicyGuard({
      enabled: false,
      allowDelete: false,
      allowedTools: [],
      requireSubredditAllowlist: true,
      allowedSubreddits: [],
    });

    expect(() => guard.ensureToolAllowed("get_top_posts", {})).not.toThrow();
  });

  it("blocks write tools when write mode is disabled", () => {
    const guard = new WritePolicyGuard({
      enabled: false,
      allowDelete: false,
      allowedTools: ["create_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
    });

    expect(() => guard.ensureToolAllowed("create_post", { subreddit: "typescript" })).toThrow(
      "write mode is disabled",
    );
  });

  it("blocks write tools not listed in allowedTools", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: ["reply_to_post"],
      requireSubredditAllowlist: false,
      allowedSubreddits: [],
      verboseErrors: false, // Test default production behavior
    });

    expect(() => guard.ensureToolAllowed("create_post", { subreddit: "typescript" })).toThrow(
      "tool not in allowlist",
    );
  });

  it("blocks delete when allowDelete is false", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: false,
      allowedTools: ["delete_post"],
      requireSubredditAllowlist: false,
      allowedSubreddits: [],
      verboseErrors: false, // Test default production behavior
    });

    expect(() => guard.ensureToolAllowed("delete_post", { thing_id: "t3_abc" })).toThrow(
      "explicit opt-in required",
    );
  });

  it("blocks create_post for subreddit outside allowlist", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: false,
      allowedTools: ["create_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: false, // Test default production behavior
    });

    expect(() => guard.ensureToolAllowed("create_post", { subreddit: "askreddit" })).toThrow(
      "subreddit not in allowlist",
    );
  });

  it("rejects create_post when params miss subreddit", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: false,
      allowedTools: ["create_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
    });

    expect(() => guard.ensureToolAllowed("create_post", {})).toThrow("subreddit is required");
    expect(() => guard.ensureToolAllowed("create_post", null)).toThrow("subreddit is required");
  });

  it("allows delete when explicitly enabled", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: ["delete_comment"],
      requireSubredditAllowlist: false,
      allowedSubreddits: [],
    });

    expect(() => guard.ensureToolAllowed("delete_comment", { thing_id: "t1_abc" })).not.toThrow();
  });

  it("accepts prefixed subreddit when allowlisted", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: false,
      allowedTools: ["create_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
    });

    expect(() => guard.ensureToolAllowed("create_post", { subreddit: "r/typescript" })).not.toThrow();
  });
});
