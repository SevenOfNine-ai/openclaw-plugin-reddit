# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-grade OpenClaw plugin that wraps the `reddit-mcp-server` (pinned to commit `aa188ec7`) to expose Reddit tools with security-first defaults. The plugin acts as a bridge between OpenClaw Gateway agents and a Reddit MCP server subprocess, enforcing policy, rate limits, and credential isolation.

## Development Commands

This project uses **Yarn 4** with corepack.

```bash
# Enable corepack (first time only)
corepack enable

# Install dependencies
yarn install

# Validate all checks (lint, typecheck, tests with coverage)
yarn validate

# Run individual checks
yarn lint
yarn typecheck
yarn test
yarn test:coverage

# Security audit
yarn audit

# Build plugin
yarn build

# Clean build artifacts
yarn clean
```

**Run a single test file:**
```bash
yarn vitest run tests/unit/config.test.ts
yarn vitest run tests/integration/reddit-mcp-harness.test.ts
```

**Requirements:** Node.js >= 22.0.0, Corepack enabled

**Coverage thresholds:** Lines 95%, branches 88%, functions 94%, statements 95%

## Architecture Overview

### Three-Layer Design

1. **Plugin Layer** (`src/index.ts`): OpenClaw plugin entrypoint that registers tools and services
2. **Policy/Guard Layer** (`src/policy.ts`, `src/rate-limit.ts`, `src/config.ts`): Enforces security constraints before forwarding calls
3. **Bridge Layer** (`src/reddit-mcp-bridge.ts`): MCP client managing stdio transport to the reddit-mcp-server subprocess

### Request Flow

```
OpenClaw Agent
  → Tool call (e.g., create_post)
  → Plugin wrapper (src/index.ts:executeTool)
  → Policy check (WritePolicyGuard)
  → Rate limit check (RedditRatePolicy)
  → MCP Bridge (RedditMcpBridge.callTool)
  → Subprocess: reddit-mcp-server
  → Reddit API
```

### Key Components

**Config (`src/config.ts`):**
- Zod schema validation with strict parsing
- Defaults: read-only mode, writes disabled, delete disabled
- Credential env-var name mapping (no secrets in config)
- Subreddit normalization (strips `r/` prefix, lowercases)
- `verboseErrors` config: controls error message detail level (default: false for production)

**Policy (`src/policy.ts`):**
- `WritePolicyGuard`: Enforces write.enabled, write.allowedTools, write.allowDelete
- Subreddit allowlist enforcement for create_post
- Environment-based error verbosity (generic messages in production, detailed in debug)
- Throws policy violation errors that are logged for audit trail

**Rate Limit (`src/rate-limit.ts`):**
- Separate token buckets for read and write operations
- Minimum write interval enforcement (default 5s between writes)
- Returns retry-after guidance on exhaustion

**MCP Bridge (`src/reddit-mcp-bridge.ts`):**
- Launches subprocess via `StdioClientTransport`
- Finds reddit-mcp-server package in node_modules, prefers `dist/bin.js`, falls back to `src/index.ts` with tsx
- Auto-reconnect on recoverable transport errors (EPIPE, ECONNREFUSED, closed)
- Minimal child env: allowlists only essential vars (PATH, HOME, etc.), blocks unrelated host secrets

**Tool Specs (`src/tool-specs.ts`):**
- All tool definitions with OpenClaw API schemas
- Zod schemas for parameter validation (`paramsSchema` field)
- Read tools: test, get_post, get_top_posts, get_user_info, search_reddit, etc.
- Write tools: create_post, reply_to_post, edit_post, edit_comment, delete_post, delete_comment
- Write tools registered with `optional: true` in OpenClaw
- Parameter validation enforced before policy checks (defense-in-depth)

## Security Constraints (Critical)

**Never bypass these security patterns:**

1. **Write tools must be optional:** All write tools registered with `{ optional: true }` so they're excluded from default agent tool allowlists
2. **Parameter validation is first line of defense:** Every tool call validates params against Zod schema before any other processing
3. **Policy checks are mandatory:** Every write tool call must pass through `WritePolicyGuard.ensureToolAllowed()` before reaching the bridge
4. **Security event logging:** All security-relevant events (write operations, rate limits, policy violations) are logged with `[SECURITY]` prefix
5. **Credential isolation:** Only REDDIT_* env vars are injected into subprocess via allowlist in `buildChildProcessEnv()`
6. **No plaintext secrets:** Config only stores env-var names, never credential values
7. **Delete requires double opt-in:** `write.enabled=true` AND `write.allowDelete=true` required for delete_post/delete_comment
8. **Rate limits are non-optional:** Both read and write rate checks must occur before bridge forwarding
9. **Error verbosity control:** Production deployments should keep `verboseErrors: false` to avoid leaking config details

## Testing Strategy

**Unit tests** (`tests/unit/`):
- Pure functions: config parsing, policy decisions, rate limit logic
- No MCP transport, no subprocess spawning

**Integration tests** (`tests/integration/`):
- `mock-harness.test.ts`: Mock MCP stdio server (see `tests/fixtures/mock-mcp-server.mjs`)
- `reddit-mcp-harness.test.ts`: Real MCP bridge against pinned reddit-mcp-server

**Test patterns:**
- Use `vitest` with node environment
- Coverage gates enforce thresholds
- Negative tests for policy violations and missing credentials are critical

## Important Files

- `openclaw.plugin.json`: Plugin manifest for OpenClaw Gateway discovery
- `docs/architecture/02-threat-model.md`: Security threat analysis and mitigation rationale (includes rate limit persistence limitation)
- `docs/architecture/01-system-design.md`: Component responsibilities and flow
- `src/openclaw-api.ts`: Type definitions for OpenClaw plugin API (not implemented, only types)
- `SECURITY_AUDIT_2026-02-11.md`: Full security audit report with findings and recommendations
- `.github/dependabot.yml`: Automated dependency security updates

## Known Limitations

**Rate Limit Persistence:**
- Rate limit state is stored in-memory only and resets on process restart
- For high-security deployments, protect gateway process from unauthorized restarts
- Consider implementing persistent rate limit storage if needed
- Reddit's own API rate limits provide additional defense layer

## Common Development Patterns

**Adding a new tool:**
1. Add tool spec to `TOOL_SPECS` in `src/tool-specs.ts`
2. Define Zod schema for parameters and add as `paramsSchema` field
3. Classify as read or write in `isWriteTool()`
4. Add to `READ_TOOL_NAMES` or `WRITE_TOOL_NAMES` tuple
5. If write tool, add to `WritePolicyGuard` validation
6. Add test coverage for new tool in plugin.test.ts
7. Add parameter validation test cases

**Modifying config schema:**
1. Update Zod schema in `src/config.ts`
2. Update type exports if needed
3. Add validation tests in `tests/unit/config.test.ts`
4. Update README.md examples if user-facing

**Debugging subprocess issues:**
- Check `launchSpec.command` and `launchSpec.args` via `bridge.status()`
- Verify reddit-mcp-server is in node_modules with correct structure
- Check child env vars via `buildLaunchSpec()` output
- Use `npm run build` in reddit-mcp-server package if dist/bin.js is missing

## OpenClaw Integration

This plugin integrates with OpenClaw Gateway (peer dependency `>=2026.2.0`):
- **Plugin registration:** `api.registerTool()`, `api.registerService()`, `api.registerGatewayMethod()`
- **Service lifecycle:** `start()` preflights MCP connectivity, `stop()` closes transport
- **Gateway method:** `openclaw-plugin-reddit.status` returns plugin state (rate limits, bridge status, parity check)
- **CLI command:** `reddit-status` (if `api.registerCli()` is supported)

## Documentation

- Architecture docs are in `docs/architecture/` (read these for design rationale)
- Research docs in `docs/research/` cover OpenClaw plugin patterns and template evaluation
- Checkpoint docs in `docs/checkpoints/` track milestone completion
