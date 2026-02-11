# Template / Boilerplate Evaluation for OpenClaw Plugins

Date: 2026-02-11

## Evaluation criteria

- Manifest correctness (`openclaw.plugin.json` with valid JSON Schema)
- Clear plugin entrypoint and package metadata (`openclaw.extensions`)
- Security defaults and guardrails
- Test coverage and CI hygiene
- Relevance for MCP wrapper use case

## Candidates reviewed

## 1) Official OpenClaw bundled extensions (local source)

Path: `tmp/openclaw/extensions/*`

### A) `extensions/discord`

Strengths:

- Minimal, clean baseline shape
- Correct manifest and package metadata
- Good for “hello world” channel plugin structure

Weaknesses:

- Not representative for MCP proxy/wrapper patterns

Use as template for this repo:

- Keep plugin entrypoint and manifest shape
- Keep minimal dependency surface

### B) `extensions/voice-call`

Strengths:

- Production-grade example with service lifecycle + tool + gateway methods
- Strong config schema + `uiHints`
- Good naming and registration patterns

Weaknesses:

- Domain complexity higher than needed

Use as template for this repo:

- Service lifecycle pattern
- Config + uiHints pattern
- Defensive runtime checks before side effects

## 2) `androidStern-personal/openclaw-mcp-adapter`

Repo: `https://github.com/androidStern-personal/openclaw-mcp-adapter`

Strengths:

- Directly relevant: MCP tool bridging into OpenClaw tools
- Good conceptual pattern for MCP stdio/http client pool

Weaknesses:

- Limited explicit security guardrails
- No obvious test suite in the repository
- Operational hardening is light

Use as template for this repo:

- MCP client bridge concept
- Tool-proxy registration approach

## 3) `sunnoy/openclaw-plugin-wecom`

Repo: `https://github.com/sunnoy/openclaw-plugin-wecom`

Strengths:

- Real-world plugin with practical channel integration
- Active project with broad operational concerns

Weaknesses:

- Large JS codebase; less suitable as minimal boilerplate
- Security/testing posture requires deeper audit per subsystem

Use as template for this repo:

- Practical docs structure and ops framing

## 4) `pepicrft/openclaw-plugin-vault`

Repo: `https://github.com/pepicrft/openclaw-plugin-vault`

Strengths:

- Has CI + test setup
- Good README ergonomics

Weaknesses:

- Manifest `configSchema` shape appears non-standard vs strict OpenClaw JSON Schema expectation
- Broad shell + git side effects increase risk profile

Use as template for this repo:

- Documentation and CI framing only
- Avoid schema and side-effect patterns that reduce strictness

## Decision

Primary implementation baseline:

1. Official local OpenClaw extensions (`discord`, `voice-call`) for correctness and conventions.
2. `openclaw-mcp-adapter` for MCP bridge mechanics.

Rejected as primary baselines:

- Community templates without strict manifest/schema rigor or strong tests.

## Concrete takeaways adopted

- Use strict manifest + JSON Schema + uiHints.
- Use service lifecycle to manage MCP subprocess.
- Keep write operations optional and policy-gated.
- Keep secret handling env-only and non-persistent.
- Add high-confidence unit + integration + negative/security tests.
