# Design Checkpoint — Milestone A

Date: 2026-02-11
Milestone: Full feature parity with stronger explicit write guardrails

## Goal

Preserve complete reddit-mcp-server feature surface while enforcing stronger, explicit gating for write operations.

## Proposed changes

1. Add per-tool write allowlist in config:
   - `write.allowedTools: string[]`
   - write tools only execute if explicitly listed
2. Keep delete tools behind dual gate:
   - tool allowlisted in `write.allowedTools`
   - `write.allowDelete=true`
3. Keep default least-privilege posture:
   - `write.enabled=false` by default
   - `write.allowedTools=[]` by default

## Self-critique

- This increases configuration complexity and may surprise users enabling writes without reading docs.
- Empty default allowlist for write mode can feel strict/friction-heavy, but is intentional for safety.
- There is a potential overlap between OpenClaw tool allowlists and plugin allowlists; need clear error messages to avoid confusion.

## Failure modes / security risks (major feature set: write feature parity)

### FM1: Operator enables write mode but forgets to allowlist tools

Risk:

- Writes always fail; perceived plugin breakage.

Mitigation:

- Return explicit error: “write tool blocked by write.allowedTools”.
- Document write-enabled example with explicit allowlist.

### FM2: Delete operations accidentally enabled via broad config

Risk:

- irreversible content loss.

Mitigation:

- retain separate `allowDelete=false` default.
- enforce dual gate (allowlist + allowDelete).
- keep negative tests for accidental delete attempts.

### FM3: Prompt injection triggers high-impact write tool call

Risk:

- unauthorized posting/editing/deleting.

Mitigation:

- maintain optional write tools + runtime policy guard.
- require explicit per-tool allowlist for writes.
- rate limit + interval + subreddit allowlist checks remain active.

### FM4: Config drift introduces tool-name mismatch

Risk:

- intended tool enablement not applied.

Mitigation:

- enforce enum validation for `write.allowedTools` against known write tool names.
- unit tests validating schema and enforcement.

## Decision

Proceed with per-tool write allowlist + docs + tests.
