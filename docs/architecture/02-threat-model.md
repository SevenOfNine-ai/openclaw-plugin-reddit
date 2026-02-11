# Threat Model

## Scope

Threat model for `openclaw-plugin-reddit` wrapper and its interaction with `reddit-mcp-server`.

## Assets

- Reddit account integrity (avoid abusive/unsafe writes)
- Reddit credentials (`client_id`, `client_secret`, username/password)
- OpenClaw host integrity (plugin runs in-process)
- Chat/session safety (avoid unintended side effects from prompt injection)

## Trust boundaries

1. Untrusted inbound content (messages, links, prompts)
2. OpenClaw model/tool decisioning
3. Plugin runtime policy enforcement
4. MCP subprocess boundary
5. External Reddit API

## Key threats and mitigations

## T1: Prompt-injection triggers unintended writes

Risk:

- LLM may call create/edit/delete tools from malicious prompts.

Mitigations:

- Write tools are registered as `optional: true`.
- Runtime default: `write.enabled=false`.
- Per-tool explicit write allowlist (`write.allowedTools`).
- Additional runtime policy checks before every write.
- Delete tools require separate explicit opt-in (`allowDelete`).

Residual risk:

- If operator explicitly enables writes and broad allowlists, model misuse remains possible.

## T2: High-volume or repetitive writes cause Reddit anti-spam/ban events

Risk:

- Excess posting/commenting can trigger anti-abuse systems.

Mitigations:

- Plugin-level read/write rate limits.
- Minimum delay between write operations.
- Downstream `REDDIT_SAFE_MODE` defaults to strict when writes are enabled.

Residual risk:

- Human/operator can still configure unsafe values.

## T3: Credential leakage via logs or repo files

Risk:

- Credentials accidentally stored in config or printed to logs.

Mitigations:

- Plugin config carries env-var names, not raw secret values.
- Child-process environment is allowlisted/minimized; unrelated host secrets are not forwarded.
- No file writes of credentials.
- Error/log paths redact or avoid secret-bearing content.

Residual risk:

- Host process environment remains sensitive and must be protected by host ops.

## T4: Plugin/dependency supply chain compromise

Risk:

- Upstream package update introduces malicious behavior.

Mitigations:

- Dependency pinned to explicit git commit (`aa188ec7...`).
- Minimal dependency surface in this plugin.
- CI + tests validate expected behavior before release.

Residual risk:

- Trust in pinned commit still required.

## T5: MCP subprocess instability causes degraded or undefined behavior

Risk:

- Broken connection yields partial failures.

Mitigations:

- Bridge implements deterministic error handling and reconnect attempt.
- Service lifecycle closes transports cleanly.
- Tool wrappers fail closed with explicit errors.

Residual risk:

- Temporary availability impact under host resource pressure.

## T6: Overly broad subreddit write scope

Risk:

- Automated posting into unintended communities.

Mitigations:

- Subreddit allowlist check for create-post flow (when enabled).
- Explicit config gate to disable allowlist bypass.

Residual risk:

- Reply/edit/delete on existing IDs may still affect unintended content if operator permits writes.

## Security defaults summary

- Read tools ON by default.
- Write tools OFF by default and optional.
- Delete OFF by default even when writes are ON.
- Rate limits ON by default.
- Strict safe mode ON by default for write-enabled mode.
- No plaintext secret persistence.
