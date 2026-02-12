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

When `write.requireSubredditAllowlist=true`, all write tools require `subreddit` for allowlist checks. For non-`create_post` writes, this field is wrapper-only policy context and is stripped before forwarding upstream.

## Install

```bash
openclaw plugins install ./openclaw-plugin-reddit
# or from package registry once published
```

Restart Gateway after install/config changes.

## Configuration

Place under `plugins.entries.openclaw-plugin-reddit.config`.

### Read-only mode (recommended default)

`strictStartup` defaults to `false` for backward-safe behavior: startup check failures are logged but do not abort plugin startup.

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

> When `write.requireSubredditAllowlist=true`, **all write calls** (`create_post`, `reply_to_post`, `edit_post`, `edit_comment`, `delete_post`, `delete_comment`) must include a `subreddit` value that appears in `write.allowedSubreddits`.

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

### Optional fail-fast startup mode

Set `strictStartup: true` to fail plugin startup when initial bridge/parity checks fail.

```json5
{
  plugins: {
    entries: {
      "openclaw-plugin-reddit": {
        enabled: true,
        config: {
          strictStartup: true
        }
      }
    }
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
- [ ] Restrict all writes with `allowedSubreddits` (and include `subreddit` on write calls when allowlist mode is enabled).
- [ ] Keep OpenClaw agent write tool allowlist minimal (agent tools policy).
- [ ] Keep OpenClaw plugin allowlist explicit (`plugins.allow`).
- [ ] Run `openclaw security audit --deep` after rollout.

## Security Considerations

### Rate Limit Persistence

**Important**: Rate limit state is stored in-memory and resets on OpenClaw Gateway process restart. For high-security deployments:

- Protect gateway process from unauthorized restarts
- Monitor for unusual restart patterns
- Consider implementing persistent rate limit storage if needed
- Rely on Reddit's own API rate limits as additional defense layer

## Local development

This project uses **Yarn 4** with corepack.

```bash
# Enable corepack (first time only)
corepack enable

# Install dependencies
yarn install

# Run all checks
yarn validate

# Build
yarn build
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
  - structured reconnect signal handling (typed MCP / Node transport errors)
  - reconnect lifecycle failure/recovery behavior

## CI quality gates

GitHub Actions workflow enforces:

- lint
- typecheck
- tests
- coverage threshold gate

## Documentation

📚 **Full documentation is available at GitHub Pages** (deployed via GitBook)

- [`docs/architecture/README.md`](./docs/architecture/README.md) - Architecture overview
- [`SECURITY_AUDIT_2026-02-11.md`](./SECURITY_AUDIT_2026-02-11.md) - Security audit report
- [`CLAUDE.md`](./CLAUDE.md) - Development guide
- [`docs/research/01-openclaw-plugin-best-practices.md`](./docs/research/01-openclaw-plugin-best-practices.md)
- [`docs/research/02-template-evaluation.md`](./docs/research/02-template-evaluation.md)

## Secure Credential Providers (migration)

The plugin now supports three credential providers:

- `git-credential` (default, recommended)
- `pass-cli`
- `env` (legacy/backward-compatible, less secure)

### Important changes

- Username is non-secret and should be configured as `reddit.username`.
- For secure providers (`git-credential`, `pass-cli`), the plugin does **not** inject `REDDIT_CLIENT_SECRET` / `REDDIT_PASSWORD` into the MCP subprocess environment.
- `env` mode keeps old behavior for compatibility.

### Example production config (recommended)

```json
{
  "reddit": {
    "authMode": "authenticated",
    "credentialProvider": "git-credential",
    "username": "your_reddit_username",
    "gitCredential": {
      "host": "reddit.com",
      "clientSecretPath": "oauth-client-secret",
      "passwordPath": "password"
    }
  },
  "write": {
    "enabled": true,
    "allowedTools": ["create_post", "reply_to_post"],
    "requireSubredditAllowlist": true,
    "allowedSubreddits": ["yoursubreddit"]
  }
}
```

### pass-cli config

```json
{
  "reddit": {
    "credentialProvider": "pass-cli",
    "username": "your_reddit_username",
    "passCli": {
      "command": "pass-cli",
      "clientSecretKey": "reddit/client-secret",
      "passwordKey": "reddit/password"
    }
  }
}
```
