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
      verboseErrors: false,
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
      verboseErrors: false,
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
      verboseErrors: false,
    });

    expect(() => guard.ensureToolAllowed("delete_post", { thing_id: "t3_abc" })).toThrow(
      "explicit opt-in required",
    );
  });

  it("enforces subreddit allowlist for all write tools", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: [
        "create_post",
        "reply_to_post",
        "edit_post",
        "edit_comment",
        "delete_post",
        "delete_comment",
      ],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: false,
    });

    const blockedCalls: Array<[string, Record<string, unknown>]> = [
      ["create_post", { subreddit: "askreddit", title: "hello", content: "world" }],
      ["reply_to_post", { post_id: "t3_abc", content: "world", subreddit: "askreddit" }],
      ["edit_post", { thing_id: "t3_abc", new_text: "world", subreddit: "askreddit" }],
      ["edit_comment", { thing_id: "t1_abc", new_text: "world", subreddit: "askreddit" }],
      ["delete_post", { thing_id: "t3_abc", subreddit: "askreddit" }],
      ["delete_comment", { thing_id: "t1_abc", subreddit: "askreddit" }],
    ];

    for (const [toolName, params] of blockedCalls) {
      expect(() => guard.ensureToolAllowed(toolName, params)).toThrow("subreddit not in allowlist");
    }
  });

  it("rejects all write tools when allowlist is required but subreddit is missing", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: [
        "create_post",
        "reply_to_post",
        "edit_post",
        "edit_comment",
        "delete_post",
        "delete_comment",
      ],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: false,
    });

    const callsMissingSubreddit: Array<[string, Record<string, unknown> | null]> = [
      ["create_post", { title: "hello", content: "world" }],
      ["reply_to_post", { post_id: "t3_abc", content: "world" }],
      ["edit_post", { thing_id: "t3_abc", new_text: "world" }],
      ["edit_comment", { thing_id: "t1_abc", new_text: "world" }],
      ["delete_post", { thing_id: "t3_abc" }],
      ["delete_comment", { thing_id: "t1_abc" }],
      ["reply_to_post", null],
    ];

    for (const [toolName, params] of callsMissingSubreddit) {
      expect(() => guard.ensureToolAllowed(toolName, params)).toThrow("subreddit is required");
    }
  });

  it("allows prefixed subreddit values for all write tools", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: [
        "create_post",
        "reply_to_post",
        "edit_post",
        "edit_comment",
        "delete_post",
        "delete_comment",
      ],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: false,
    });

    expect(
      () =>
        guard.ensureToolAllowed("create_post", {
          subreddit: "r/typescript",
          title: "hello",
          content: "world",
        }),
    ).not.toThrow();

    expect(
      () =>
        guard.ensureToolAllowed("reply_to_post", {
          post_id: "t3_abc",
          content: "world",
          subreddit: "r/typescript",
        }),
    ).not.toThrow();

    expect(
      () =>
        guard.ensureToolAllowed("edit_post", {
          thing_id: "t3_abc",
          new_text: "world",
          subreddit: "r/typescript",
        }),
    ).not.toThrow();

    expect(
      () =>
        guard.ensureToolAllowed("edit_comment", {
          thing_id: "t1_abc",
          new_text: "world",
          subreddit: "r/typescript",
        }),
    ).not.toThrow();

    expect(
      () => guard.ensureToolAllowed("delete_post", { thing_id: "t3_abc", subreddit: "r/typescript" }),
    ).not.toThrow();

    expect(
      () => guard.ensureToolAllowed("delete_comment", { thing_id: "t1_abc", subreddit: "r/typescript" }),
    ).not.toThrow();
  });

  it("keeps non-allowlist write mode behavior unchanged when allowlist is disabled", () => {
    const guard = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: ["reply_to_post", "delete_comment"],
      requireSubredditAllowlist: false,
      allowedSubreddits: ["typescript"],
      verboseErrors: false,
    });

    expect(() => guard.ensureToolAllowed("reply_to_post", { post_id: "t3_abc", content: "world" })).not.toThrow();
    expect(() => guard.ensureToolAllowed("delete_comment", { thing_id: "t1_abc" })).not.toThrow();
  });

  it("shows detailed messages when verboseErrors=true", () => {
    const guardDisabled = new WritePolicyGuard({
      enabled: false,
      allowDelete: false,
      allowedTools: [],
      requireSubredditAllowlist: true,
      allowedSubreddits: [],
      verboseErrors: true,
    });
    expect(() => guardDisabled.ensureToolAllowed("create_post", { subreddit: "test" })).toThrow(
      "write mode is disabled. Enable write mode explicitly",
    );

    const guardNotAllowlisted = new WritePolicyGuard({
      enabled: true,
      allowDelete: false,
      allowedTools: ["reply_to_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: true,
    });
    expect(() => guardNotAllowlisted.ensureToolAllowed("create_post", { subreddit: "typescript" })).toThrow(
      "not listed in write.allowedTools",
    );

    const guardDelete = new WritePolicyGuard({
      enabled: true,
      allowDelete: false,
      allowedTools: ["delete_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: true,
    });
    expect(() => guardDelete.ensureToolAllowed("delete_post", { thing_id: "t3_abc", subreddit: "typescript" })).toThrow(
      "delete operations require write.allowDelete=true",
    );

    const guardSubreddit = new WritePolicyGuard({
      enabled: true,
      allowDelete: true,
      allowedTools: ["reply_to_post"],
      requireSubredditAllowlist: true,
      allowedSubreddits: ["typescript"],
      verboseErrors: true,
    });
    expect(() => guardSubreddit.ensureToolAllowed("reply_to_post", { post_id: "t3_abc", content: "x", subreddit: "askreddit" })).toThrow(
      "is not in write.allowedSubreddits allowlist",
    );
  });
});
