# Design Checkpoint — Milestone B

Date: 2026-02-11
Milestone: Subprocess secret-boundary hardening

## Goal

Reduce accidental secret exposure by minimizing environment variables inherited by the reddit-mcp-server subprocess.

## Proposed changes

1. Replace full env passthrough with allowlisted baseline env for child process.
2. Keep only runtime-critical keys (e.g., PATH/HOME/TMPDIR/LANG/LC_*/SystemRoot on Windows).
3. Inject Reddit-specific environment values explicitly (`REDDIT_*`, `REDDIT_AUTH_MODE`, `REDDIT_SAFE_MODE`).

## Self-critique

- Aggressive env pruning can break unexpected host setups (proxy, TLS, locale edge cases).
- Allowlist maintenance may lag across OS/runtime edge cases.
- Some users may rely on inherited env for custom command overrides.

## Failure modes / security risks (feature set: subprocess boundary)

### FM1: Over-pruned environment breaks downstream runtime

Risk:

- reddit-mcp-server fails to start or behaves inconsistently.

Mitigation:

- include baseline cross-platform execution keys.
- keep command override path available.
- add integration tests ensuring boot with pruned env.

### FM2: Sensitive host env leaks to subprocess

Risk:

- unrelated API keys/tokens become readable to child process.

Mitigation:

- strict allowlist strategy.
- explicit injection of only required Reddit env keys.
- tests asserting unrelated env keys are not forwarded.

### FM3: Missing proxy/TLS env in constrained networks

Risk:

- outbound Reddit API access fails in proxied environments.

Mitigation:

- allowlist common proxy/env networking keys (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, etc.).
- document behavior in README.

### FM4: Locale/encoding mismatch in subprocess output

Risk:

- malformed Unicode/log output.

Mitigation:

- pass locale keys (`LANG`, `LC_*`).
- retain deterministic text extraction tests.

## Decision

Proceed with allowlisted child env + focused tests + docs note.
