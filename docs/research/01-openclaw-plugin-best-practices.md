# OpenClaw Plugin Best Practices Research

Date: 2026-02-11
Scope: architecture conventions, least privilege defaults, secret handling, testing strategy.

## Sources reviewed

### Local OpenClaw docs (primary)

- `tmp/openclaw/docs/tools/plugin.md`
- `tmp/openclaw/docs/plugins/manifest.md`
- `tmp/openclaw/docs/plugins/agent-tools.md`
- `tmp/openclaw/docs/cli/plugins.md`
- `tmp/openclaw/docs/gateway/security/index.md`
- `tmp/openclaw/docs/help/testing.md`

### Additional references

- OpenClaw docs site mirrors (for cross-check)
- Local OpenClaw source:
  - `tmp/openclaw/extensions/*` (official plugin implementations)
  - `tmp/openclaw/src/plugins/*.test.ts` (plugin-focused tests)

## Key findings

## 1) Plugin architecture and conventions

1. Plugins are loaded in-process and are trusted code.
2. Every plugin must provide `openclaw.plugin.json` with:
   - `id`
   - `configSchema` (JSON Schema object, required even if empty)
3. Config is validated from manifest/schema **without executing plugin code**.
4. Plugin package should expose entry file(s) via `package.json`:

```json
{
  "openclaw": {
    "extensions": ["./dist/index.js"]
  }
}
```

5. Recommended capabilities to register only when needed:
   - tools
   - gateway methods
   - CLI commands
   - services
6. Naming conventions:
   - tools: `snake_case`
   - gateway methods: `pluginId.action`

## 2) Least-privilege tool design

From OpenClaw docs and policy behavior:

- Use `api.registerTool(..., { optional: true })` for side-effecting tools.
- Optional tools are not auto-enabled; they require explicit allowlisting.
- Keep destructive or high-risk behavior behind explicit config toggles.
- Add server-side guardrails in plugin runtime (never rely only on model prompt).

Applied policy for this plugin:

- Read tools: enabled by default.
- Write tools: optional + runtime policy gates.
- Delete tools: separate explicit opt-in (`allowDelete=true`).
- Subreddit write scope can be allowlisted.

## 3) Secret handling and credential hygiene

OpenClaw security docs emphasize minimizing and isolating secrets.

Recommended plugin practices:

1. Never persist secrets to repository files.
2. Avoid secret values in plugin config where possible.
3. Prefer environment variable lookup at runtime.
4. Redact sensitive values from logs and error payloads.
5. Fail closed when required secrets are missing.

Applied to this project:

- Plugin config references secret **env var names**, not raw secret values.
- Credentials are read from process environment at runtime and passed to subprocess env.
- No secret serialization to disk.

## 4) Testing strategy (unit/integration/security)

OpenClaw testing guidance and source patterns support:

- fast deterministic unit tests for policy/config logic
- integration tests with realistic process-level harnesses
- dedicated negative/security tests
- coverage gating in CI

Target strategy adopted:

- Unit tests: config parsing, policy enforcement, rate limiting, bridge command/env composition.
- Integration tests:
  - mock MCP server harness (process + stdio)
  - realistic harness against pinned `reddit-mcp-server`
- Negative/security tests:
  - missing credentials for write mode
  - blocked write attempts in read-only mode
  - blocked deletes without explicit delete opt-in
  - write rate limit and interval enforcement

## Design implications for this repo

- Ship production plugin manifest + strict schema.
- Use read-only by default and optional write tools.
- Add explicit runtime guardrails (not just optional tools).
- Add rate limits and safe mode defaults in wrapper + downstream server.
- Pin dependency to `SevenOfNine-ai/reddit-mcp-server` commit.
- Add CI gates: lint, typecheck, test, coverage threshold.
