# System Design

## Objective

Build an OpenClaw plugin wrapper that exposes Reddit tools via the pinned dependency `SevenOfNine-ai/reddit-mcp-server` with secure defaults.

## High-level architecture

```text
OpenClaw Gateway
  └─ Plugin: openclaw-plugin-reddit
      ├─ Config + policy parser (strict defaults)
      ├─ Write guardrails engine
      ├─ Read/Write rate limiters
      ├─ MCP Bridge (stdio client)
      │   └─ subprocess: reddit-mcp-server (pinned commit)
      └─ Tool wrappers (OpenClaw agent tools)
```

## Component responsibilities

### 1) Plugin entrypoint

- Parses plugin config with defaults.
- Registers tools:
  - read tools (default enabled)
  - write tools (`optional: true`)
- Registers service lifecycle:
  - startup preflight (optional tool discovery/health)
  - graceful teardown of MCP client/subprocess

### 2) Config and policy engine

- Enforces read-only default behavior.
- Defines write enablement and delete-specific opt-in.
- Controls subreddit allowlist checks for posting.
- Resolves credential env var names without persisting values.

### 3) Rate limiter

- Separate budgets for read vs write operations.
- Minimum interval between writes.
- Deterministic rejection with retry guidance.

### 4) MCP bridge

- Spawns and maintains stdio client connection to reddit-mcp-server.
- Forwards tool calls and returns normalized responses.
- Supports typed reconnect strategy using structured MCP/Node transport signals (no string matching).
- Tracks reconnect lifecycle state for diagnostics (`disconnectCount`, `reconnectCount`, last disconnect reason/code).

### 5) Tool wrappers

- Map OpenClaw tool invocations to MCP tool calls.
- Apply policy and rate checks before forwarding.
- Return safe, concise result/error payloads.

## Runtime flow (tool call)

1. Agent invokes `get_top_posts` (or another Reddit tool).
2. Wrapper classifies tool as read or write.
3. Wrapper enforces:
   - policy gates (write mode, delete mode, subreddit constraints)
   - rate limits (read/write buckets + write interval)
4. Bridge ensures MCP server is connected.
5. Bridge forwards `tools/call` to reddit-mcp-server.
6. Wrapper normalizes and returns response.

## Runtime flow (startup)

1. OpenClaw loads plugin from package entrypoint.
2. Manifest schema validates plugin config before code execution.
3. Plugin registers tools and service.
4. Service optionally preflights MCP connectivity and logs readiness.

## Design choices

- Chosen transport: stdio MCP client to local subprocess.
  - Rationale: clear isolation boundary, no open local HTTP port required.
- Chosen defaults: read-only enabled, writes opt-in + optional tools.
  - Rationale: least privilege and safer operation in prompt-injection scenarios.
- Chosen secret model: env-only pass-through.
  - Rationale: avoid plaintext secret persistence in plugin config/repo.
