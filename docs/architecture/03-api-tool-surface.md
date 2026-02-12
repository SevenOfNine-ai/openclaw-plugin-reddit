# API / Tool Surface

## Plugin identity

- Plugin ID: `openclaw-plugin-reddit`
- Package: `openclaw-plugin-reddit`

## Tool categories

## Read tools (enabled by default)

- `test_reddit_mcp_server`
- `get_reddit_post`
- `get_top_posts`
- `get_user_info`
- `get_user_posts`
- `get_user_comments`
- `get_subreddit_info`
- `get_trending_subreddits`
- `get_post_comments`
- `search_reddit`

## Write tools (optional + runtime-gated)

- `create_post`
- `reply_to_post`
- `edit_post`
- `edit_comment`
- `delete_post`
- `delete_comment`

## Write gating semantics

All write tools must pass:

1. tool is allowlisted by OpenClaw policy (because optional)
2. plugin `write.enabled=true`
3. tool is explicitly listed in `write.allowedTools`
4. plugin runtime policy checks
5. write rate limits and interval checks

Additional delete gate:

- `allowDelete=true` required for `delete_post` and `delete_comment`.

Additional subreddit gate:

- When `write.requireSubredditAllowlist=true`, all write tools require a `subreddit` value that must be in `write.allowedSubreddits`.
- `create_post` already requires `subreddit`; for `reply_to_post` / `edit_*` / `delete_*`, this wrapper adds optional `subreddit` input for policy validation.
- For non-`create_post` writes, `subreddit` is wrapper-only policy context and is removed before forwarding upstream.

## Gateway methods

Minimal diagnostic method:

- `openclaw-plugin-reddit.status`
  - returns policy mode, limiter settings, MCP bridge health, and parity snapshot:
    - missing expected tools
    - unexpected upstream tools
    - last parity check timestamp

## CLI command

- `openclaw reddit-status`
  - local status output for plugin health and effective policy.

## Error behavior

- Guardrail denials return explicit actionable errors (not silent fail).
- Bridge reconnect decisions are based on structured MCP/Node error metadata and transport lifecycle state.
- Missing credentials in write-enabled mode produce fail-closed errors.
