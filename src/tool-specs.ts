export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mode: "read" | "write";
};

const EMPTY_OBJECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

export const READ_TOOL_NAMES = [
  "test_reddit_mcp_server",
  "get_reddit_post",
  "get_top_posts",
  "get_user_info",
  "get_user_posts",
  "get_user_comments",
  "get_subreddit_info",
  "get_trending_subreddits",
  "get_post_comments",
  "search_reddit",
] as const;

export const WRITE_TOOL_NAMES = [
  "create_post",
  "reply_to_post",
  "edit_post",
  "edit_comment",
  "delete_post",
  "delete_comment",
] as const;

export const ALL_TOOL_NAMES = [...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES] as const;

export type RedditToolName = (typeof ALL_TOOL_NAMES)[number];

export function isWriteTool(name: string): name is (typeof WRITE_TOOL_NAMES)[number] {
  return (WRITE_TOOL_NAMES as readonly string[]).includes(name);
}

export const TOOL_SPECS: Record<RedditToolName, ToolSpec> = {
  test_reddit_mcp_server: {
    name: "test_reddit_mcp_server",
    description: "Validate Reddit MCP server reachability and active configuration.",
    parameters: EMPTY_OBJECT_SCHEMA,
    mode: "read",
  },
  get_reddit_post: {
    name: "get_reddit_post",
    description: "Fetch a Reddit post with metadata and engagement fields.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["subreddit", "post_id"],
      properties: {
        subreddit: { type: "string" },
        post_id: { type: "string" },
      },
    },
  },
  get_top_posts: {
    name: "get_top_posts",
    description: "Retrieve top posts from a subreddit or Reddit home feed.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        subreddit: { type: "string" },
        time_filter: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year", "all"],
        },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
    },
  },
  get_user_info: {
    name: "get_user_info",
    description: "Fetch profile and karma information for a Reddit user.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["username"],
      properties: {
        username: { type: "string" },
      },
    },
  },
  get_user_posts: {
    name: "get_user_posts",
    description: "List recent posts for a Reddit user.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["username"],
      properties: {
        username: { type: "string" },
        sort: { type: "string", enum: ["new", "hot", "top"] },
        time_filter: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year", "all"],
        },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
    },
  },
  get_user_comments: {
    name: "get_user_comments",
    description: "List recent comments for a Reddit user.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["username"],
      properties: {
        username: { type: "string" },
        sort: { type: "string", enum: ["new", "hot", "top"] },
        time_filter: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year", "all"],
        },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
    },
  },
  get_subreddit_info: {
    name: "get_subreddit_info",
    description: "Fetch subreddit description and community statistics.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["subreddit_name"],
      properties: {
        subreddit_name: { type: "string" },
      },
    },
  },
  get_trending_subreddits: {
    name: "get_trending_subreddits",
    description: "List currently trending subreddits.",
    parameters: EMPTY_OBJECT_SCHEMA,
    mode: "read",
  },
  get_post_comments: {
    name: "get_post_comments",
    description: "Fetch comments for a subreddit post.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["post_id", "subreddit"],
      properties: {
        post_id: { type: "string" },
        subreddit: { type: "string" },
        sort: {
          type: "string",
          enum: ["best", "top", "new", "controversial", "old", "qa"],
        },
        limit: { type: "number", minimum: 1, maximum: 500 },
      },
    },
  },
  search_reddit: {
    name: "search_reddit",
    description: "Search Reddit posts with optional subreddit and sorting filters.",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string" },
        subreddit: { type: "string" },
        sort: {
          type: "string",
          enum: ["relevance", "hot", "top", "new", "comments"],
        },
        time_filter: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year", "all"],
        },
        limit: { type: "number", minimum: 1, maximum: 100 },
        type: { type: "string", enum: ["link", "sr", "user"] },
      },
    },
  },

  create_post: {
    name: "create_post",
    description: "Create a new post in a subreddit (write mode required).",
    mode: "write",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["subreddit", "title", "content"],
      properties: {
        subreddit: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        is_self: { type: "boolean" },
      },
    },
  },
  reply_to_post: {
    name: "reply_to_post",
    description: "Reply to a post or comment by thing id (write mode required).",
    mode: "write",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["post_id", "content"],
      properties: {
        post_id: { type: "string" },
        content: { type: "string" },
      },
    },
  },
  edit_post: {
    name: "edit_post",
    description: "Edit a self post text body (write mode required).",
    mode: "write",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["thing_id", "new_text"],
      properties: {
        thing_id: { type: "string" },
        new_text: { type: "string" },
      },
    },
  },
  edit_comment: {
    name: "edit_comment",
    description: "Edit a comment body (write mode required).",
    mode: "write",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["thing_id", "new_text"],
      properties: {
        thing_id: { type: "string" },
        new_text: { type: "string" },
      },
    },
  },
  delete_post: {
    name: "delete_post",
    description: "Delete a post (write + delete mode required).",
    mode: "write",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["thing_id"],
      properties: {
        thing_id: { type: "string" },
      },
    },
  },
  delete_comment: {
    name: "delete_comment",
    description: "Delete a comment (write + delete mode required).",
    mode: "write",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["thing_id"],
      properties: {
        thing_id: { type: "string" },
      },
    },
  },
};
