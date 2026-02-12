# Configuration Schema

## Top-level shape

```json5
{
  command: "node",               // optional MCP command override
  args: ["path/to/server.js"],   // optional MCP args override
  startupTimeoutMs: 15000,
  strictStartup: false,          // optional fail-fast startup

  reddit: {
    authMode: "auto",            // auto | authenticated | anonymous
    safeModeReadOnly: "off",     // off | standard | strict
    safeModeWriteEnabled: "strict",
    env: {
      clientId: "REDDIT_CLIENT_ID",
      clientSecret: "REDDIT_CLIENT_SECRET",
      username: "REDDIT_USERNAME",
      password: "REDDIT_PASSWORD",
      userAgent: "REDDIT_USER_AGENT"
    }
  },

  write: {
    enabled: false,
    allowDelete: false,
    allowedTools: [],
    requireSubredditAllowlist: true,
    allowedSubreddits: []
  },

  rateLimit: {
    readPerMinute: 60,
    writePerMinute: 6,
    minWriteIntervalMs: 5000
  }
}
```

## Default security posture

- `strictStartup = false` (backward-safe startup default)
- `write.enabled = false`
- `write.allowDelete = false`
- `write.allowedTools = []` (explicit per-write-tool opt-in)
- `write.requireSubredditAllowlist = true`
- `rateLimit` enabled with conservative defaults
- no secret values in config itself

## Validation rules

- Unknown properties rejected (`additionalProperties: false`).
- Numeric rate limits must be positive and bounded.
- Environment variable key names must be non-empty strings.
- `write.allowedTools` must be valid known write tool names.
- `allowedSubreddits` normalized to lowercase unique list.

## Hardening guidance

- Prefer `authMode=authenticated` in production with app credentials.
- Enable `strictStartup=true` in controlled deployments where startup parity drift must fail fast.
- Keep `safeModeWriteEnabled=strict` unless human-supervised high-throughput use is required.
- Keep delete disabled except when explicitly needed.
- Maintain explicit `allowedSubreddits` for write-enabled accounts.
- With `write.requireSubredditAllowlist=true`, every write call must include a `subreddit` value so the wrapper can enforce allowlist policy.
