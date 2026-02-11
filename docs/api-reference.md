# API Reference

Complete reference for all Reddit tools exposed by this plugin.

## Read Tools

All read tools are **enabled by default** and do not require write mode.

### test_reddit_mcp_server

**Description:** Validate Reddit MCP server reachability and active configuration.

**Parameters:** None

**Returns:** Server status and configuration information

**Example:**
```json
{
  "content": [{
    "type": "text",
    "text": "Reddit MCP Server Status\nServer: ✓ Running\nAuth Mode: anonymous\nSafe Mode: off"
  }]
}
```

---

### get_reddit_post

**Description:** Fetch a Reddit post with metadata and engagement fields.

**Parameters:**
- `subreddit` (string, required) - Subreddit name (without r/ prefix)
- `post_id` (string, required) - Reddit post ID (e.g., "abc123")

**Validation:**
- Subreddit: 1-100 characters
- Post ID: 1-100 characters

**Example:**
```typescript
{
  subreddit: "typescript",
  post_id: "1abc23"
}
```

---

### get_top_posts

**Description:** Retrieve top posts from a subreddit or Reddit home feed.

**Parameters:**
- `subreddit` (string, optional) - Subreddit name (omit for home feed)
- `time_filter` (enum, optional) - One of: "hour", "day", "week", "month", "year", "all"
- `limit` (number, optional) - Number of posts (1-100, default varies)

**Example:**
```typescript
{
  subreddit: "typescript",
  time_filter: "week",
  limit: 10
}
```

---

### get_user_info

**Description:** Fetch profile and karma information for a Reddit user.

**Parameters:**
- `username` (string, required) - Reddit username (without u/ prefix)

**Validation:**
- Username: 1-100 characters

**Example:**
```typescript
{
  username: "spez"
}
```

---

### get_user_posts

**Description:** List recent posts for a Reddit user.

**Parameters:**
- `username` (string, required) - Reddit username
- `sort` (enum, optional) - One of: "new", "hot", "top"
- `time_filter` (enum, optional) - One of: "hour", "day", "week", "month", "year", "all"
- `limit` (number, optional) - Number of posts (1-100)

**Validation:**
- Username: 1-100 characters

**Example:**
```typescript
{
  username: "spez",
  sort: "top",
  time_filter: "month",
  limit: 25
}
```

---

### get_user_comments

**Description:** List recent comments for a Reddit user.

**Parameters:**
- `username` (string, required) - Reddit username
- `sort` (enum, optional) - One of: "new", "hot", "top"
- `time_filter` (enum, optional) - One of: "hour", "day", "week", "month", "year", "all"
- `limit` (number, optional) - Number of comments (1-100)

**Validation:**
- Username: 1-100 characters

**Example:**
```typescript
{
  username: "spez",
  sort: "new",
  limit: 50
}
```

---

### get_subreddit_info

**Description:** Fetch subreddit description and community statistics.

**Parameters:**
- `subreddit_name` (string, required) - Subreddit name (without r/ prefix)

**Validation:**
- Subreddit name: 1-100 characters

**Example:**
```typescript
{
  subreddit_name: "typescript"
}
```

---

### get_trending_subreddits

**Description:** List currently trending subreddits.

**Parameters:** None

**Example:** No parameters required

---

### get_post_comments

**Description:** Fetch comments for a subreddit post.

**Parameters:**
- `post_id` (string, required) - Reddit post ID
- `subreddit` (string, required) - Subreddit name
- `sort` (enum, optional) - One of: "best", "top", "new", "controversial", "old", "qa"
- `limit` (number, optional) - Number of comments (1-500)

**Example:**
```typescript
{
  post_id: "1abc23",
  subreddit: "typescript",
  sort: "best",
  limit: 100
}
```

---

### search_reddit

**Description:** Search Reddit posts with optional subreddit and sorting filters.

**Parameters:**
- `query` (string, required) - Search query
- `subreddit` (string, optional) - Limit search to subreddit
- `sort` (enum, optional) - One of: "relevance", "hot", "top", "new", "comments"
- `time_filter` (enum, optional) - One of: "hour", "day", "week", "month", "year", "all"
- `limit` (number, optional) - Number of results (1-100)
- `type` (enum, optional) - One of: "link", "sr", "user"

**Example:**
```typescript
{
  query: "async await",
  subreddit: "typescript",
  sort: "top",
  time_filter: "month",
  limit: 20
}
```

---

## Write Tools

Write tools are **optional** and require explicit configuration. See [Configuration Schema](architecture/04-config-schema.md) for setup.

### create_post

**Description:** Create a new post in a subreddit (write mode required).

**Parameters:**
- `subreddit` (string, required) - Target subreddit name
- `title` (string, required) - Post title
- `content` (string, required) - Post content/body
- `is_self` (boolean, optional) - Whether this is a self post

**Validation:**
- Subreddit: 1-100 characters
- Title: 1-300 characters
- Content: 1-40,000 characters

**Requirements:**
- `write.enabled: true`
- `create_post` in `write.allowedTools`
- Subreddit in `write.allowedSubreddits` (if `requireSubredditAllowlist: true`)
- Valid credentials configured

**Example:**
```typescript
{
  subreddit: "test",
  title: "Hello from OpenClaw",
  content: "This is a test post created via the OpenClaw Reddit plugin.",
  is_self: true
}
```

**Security Notes:**
- Subreddit allowlist enforced by default
- Rate limited to 6 per minute by default
- Minimum 5s interval between writes
- Safe mode "strict" recommended

---

### reply_to_post

**Description:** Reply to a post or comment by thing ID (write mode required).

**Parameters:**
- `post_id` (string, required) - Reddit thing ID (e.g., "t1_abc123", "t3_xyz789")
- `content` (string, required) - Reply content

**Validation:**
- Post ID: 1-100 characters
- Content: 1-10,000 characters

**Requirements:**
- `write.enabled: true`
- `reply_to_post` in `write.allowedTools`
- Valid credentials configured

**Example:**
```typescript
{
  post_id: "t3_1abc23",
  content: "Great post! Thanks for sharing."
}
```

---

### edit_post

**Description:** Edit a self post text body (write mode required).

**Parameters:**
- `thing_id` (string, required) - Reddit thing ID of the post
- `new_text` (string, required) - New post content

**Validation:**
- Thing ID: 1-100 characters
- New text: 1-40,000 characters

**Requirements:**
- `write.enabled: true`
- `edit_post` in `write.allowedTools`
- Valid credentials configured
- Must own the post

**Example:**
```typescript
{
  thing_id: "t3_1abc23",
  new_text: "Updated post content with corrections."
}
```

---

### edit_comment

**Description:** Edit a comment body (write mode required).

**Parameters:**
- `thing_id` (string, required) - Reddit thing ID of the comment
- `new_text` (string, required) - New comment content

**Validation:**
- Thing ID: 1-100 characters
- New text: 1-40,000 characters

**Requirements:**
- `write.enabled: true`
- `edit_comment` in `write.allowedTools`
- Valid credentials configured
- Must own the comment

**Example:**
```typescript
{
  thing_id: "t1_xyz789",
  new_text: "Edited: Fixed typo in my previous comment."
}
```

---

### delete_post

**Description:** Delete a post (write + delete mode required).

**Parameters:**
- `thing_id` (string, required) - Reddit thing ID of the post

**Validation:**
- Thing ID: 1-100 characters

**Requirements:**
- `write.enabled: true`
- `write.allowDelete: true` ⚠️ **Double opt-in required**
- `delete_post` in `write.allowedTools`
- Valid credentials configured
- Must own the post

**Example:**
```typescript
{
  thing_id: "t3_1abc23"
}
```

**⚠️ Warning:** This action is irreversible. Deleted posts cannot be recovered.

---

### delete_comment

**Description:** Delete a comment (write + delete mode required).

**Parameters:**
- `thing_id` (string, required) - Reddit thing ID of the comment

**Validation:**
- Thing ID: 1-100 characters

**Requirements:**
- `write.enabled: true`
- `write.allowDelete: true` ⚠️ **Double opt-in required**
- `delete_comment` in `write.allowedTools`
- Valid credentials configured
- Must own the comment

**Example:**
```typescript
{
  thing_id: "t1_xyz789"
}
```

**⚠️ Warning:** This action is irreversible. Deleted comments cannot be recovered.

---

## Error Responses

All tools return errors in a consistent format:

```json
{
  "content": [{
    "type": "text",
    "text": "Error: [error message]"
  }],
  "details": {
    "error": "[error message]"
  },
  "isError": true
}
```

### Common Error Types

#### Parameter Validation Errors
```
Invalid parameters for create_post: title must be between 1 and 300 characters
```

#### Policy Violations
```
Write operation blocked: write mode is disabled.
create_post blocked: subreddit not in allowlist.
Delete operation blocked: explicit opt-in required.
```

#### Rate Limit Errors
```
Rate limit: write tool 'create_post' blocked. Retry in 3500ms.
```

#### Credential Errors
```
Write blocked: Missing Reddit credentials.
```

---

## Rate Limiting

All tools are subject to rate limiting:

| Operation Type | Default Limit | Configurable |
|---------------|---------------|--------------|
| Read operations | 60/minute | ✅ `rateLimit.readPerMinute` |
| Write operations | 6/minute | ✅ `rateLimit.writePerMinute` |
| Write interval | 5 seconds | ✅ `rateLimit.minWriteIntervalMs` |

Rate limits reset every 60 seconds (sliding window).

**Note:** Rate limit state is stored in-memory and resets on gateway restart.

---

## Gateway Methods

### openclaw-plugin-reddit.status

Get current plugin status and configuration.

**Returns:**
```json
{
  "mode": {
    "writeEnabled": false,
    "deleteEnabled": false,
    "requireSubredditAllowlist": true,
    "allowedTools": [],
    "allowedSubreddits": []
  },
  "bridge": {
    "connected": true,
    "command": "/path/to/node",
    "args": ["dist/bin.js"]
  },
  "rateLimit": {
    "readInWindow": 5,
    "writeInWindow": 0,
    "lastWriteAt": null,
    "minWriteIntervalMs": 5000
  },
  "parity": {
    "checkedAt": "2026-02-11T12:00:00.000Z",
    "upstreamToolCount": 16,
    "missingExpectedTools": [],
    "unexpectedUpstreamTools": []
  }
}
```

---

## Type Definitions

### Reddit Thing ID Format

Reddit uses prefixed IDs to identify different object types:

- `t1_` - Comment
- `t2_` - Account (user)
- `t3_` - Link (post)
- `t4_` - Message
- `t5_` - Subreddit
- `t6_` - Award

Example: `t3_1abc23` is a post, `t1_xyz789` is a comment.

---

## See Also

- [Configuration Schema](architecture/04-config-schema.md)
- [Security Best Practices](security-best-practices.md)
- [Getting Started](getting-started.md)
- [Troubleshooting](faq.md)
