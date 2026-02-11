# openclaw-plugin-reddit

Production-grade OpenClaw plugin that exposes Reddit capabilities through the pinned dependency:

- `SevenOfNine-ai/reddit-mcp-server`
- pinned commit: `aa188ec7aba1b6a81398c626dc0ddd45baa6fb68`

## Security posture (default)

- ✅ Read tools enabled by default
- ✅ Write tools disabled by default
- ✅ Write tools registered as optional (explicit tool allowlist required)
- ✅ Delete operations require an additional explicit opt-in
- ✅ Read/write rate limiting enabled
- ✅ Reddit safe mode defaults to strict when write mode is enabled
- ✅ No plaintext secret persistence in repo

## Tool surface

### Read tools (default enabled)

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

### Write tools (optional + guarded)

- `create_post`
- `reply_to_post`
- `edit_post`
- `edit_comment`
- `delete_post`
- `delete_comment`

## Install

```bash
openclaw plugins install ./openclaw-plugin-reddit
# or from package registry once published
```

Restart Gateway after install/config changes.

## Configuration

Place under `plugins.entries.openclaw-plugin-reddit.config`.

### Read-only mode (recommended default)

```json5
{
  plugins: {
    entries: {
      "openclaw-plugin-reddit": {
        enabled: true,
        config: {
          reddit: {
            authMode: "auto"
          },
          write: {
            enabled: false,
            allowedTools: []
          }
        }
      }
    }
  }
}
```

### Write-enabled mode (explicit opt-in)

```json5
{
  plugins: {
    entries: {
      "openclaw-plugin-reddit": {
        enabled: true,
        config: {
          reddit: {
            authMode: "authenticated",
            safeModeWriteEnabled: "strict"
          },
          write: {
            enabled: true,
            allowDelete: false,
            allowedTools: [
              "create_post",
              "reply_to_post",
              "edit_post",
              "edit_comment"
            ],
            requireSubredditAllowlist: true,
            allowedSubreddits: ["test", "myprivatecommunity"]
          },
          rateLimit: {
            readPerMinute: 60,
            writePerMinute: 6,
            minWriteIntervalMs: 5000
          }
        }
      }
    }
  },
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: [
            "create_post",
            "reply_to_post",
            "edit_post",
            "edit_comment"
          ]
        }
      }
    ]
  }
}
```

## Credential handling (no plaintext secrets)

Set secrets in environment only (or your secret manager), not in repo files.

Defaults expected by downstream reddit-mcp-server:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USERNAME`
- `REDDIT_PASSWORD`
- `REDDIT_USER_AGENT` (optional)

You may remap variable names in plugin config under `reddit.env.*`.

Subprocess env hardening: the plugin forwards only a minimal allowlisted baseline environment to the reddit-mcp-server child process, then injects explicit `REDDIT_*` variables. Unrelated host secrets are not forwarded by default.

## Hardening checklist

- [ ] Keep write mode disabled unless strictly needed.
- [ ] If enabling writes, keep `safeModeWriteEnabled=strict`.
- [ ] Keep `allowDelete=false` unless absolutely required.
- [ ] Explicitly set minimal `write.allowedTools`.
- [ ] Restrict post creation with `allowedSubreddits`.
- [ ] Keep OpenClaw agent write tool allowlist minimal (agent tools policy).
- [ ] Keep OpenClaw plugin allowlist explicit (`plugins.allow`).
- [ ] Run `openclaw security audit --deep` after rollout.

## Local development

```bash
npm install
npm run validate
npm run build
```

## Test strategy

- Unit tests: config, policy, limiter, launch spec, plugin behavior
- Integration tests:
  - mock MCP stdio server harness
  - realistic harness against pinned `reddit-mcp-server`
- Negative/security tests:
  - missing creds
  - blocked writes in read-only mode
  - blocked delete without explicit opt-in
  - rate-limit denials

## CI quality gates

GitHub Actions workflow enforces:

- lint
- typecheck
- tests
- coverage threshold gate

## Architecture docs

- [`docs/architecture/README.md`](./docs/architecture/README.md)
- [`docs/research/01-openclaw-plugin-best-practices.md`](./docs/research/01-openclaw-plugin-best-practices.md)
- [`docs/research/02-template-evaluation.md`](./docs/research/02-template-evaluation.md)
