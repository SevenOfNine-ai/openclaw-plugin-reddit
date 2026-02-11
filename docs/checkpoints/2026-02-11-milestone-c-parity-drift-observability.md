# Design Checkpoint — Milestone C

Date: 2026-02-11
Milestone: Feature-parity drift observability

## Goal

Strengthen confidence that plugin wrapper remains fully aligned with reddit-mcp-server tool surface over time.

## Proposed changes

1. At startup, compare upstream MCP advertised tools against expected wrapper tool set.
2. Track parity snapshot in runtime state:
   - missing expected tools
   - unexpected upstream tools
   - total upstream tool count
3. Expose parity in gateway status method and CLI status output.

## Self-critique

- Static expected list still requires maintenance when upstream adds tools.
- Treating unknown upstream tools as warnings (not failures) may hide breaking change urgency.
- Extra observability fields increase surface area for tests and maintenance.

## Failure modes / security risks (feature set: parity observability)

### FM1: Upstream adds a new high-impact write tool and wrapper does not expose it

Risk:

- hidden feature gap contrary to parity expectations.

Mitigation:

- startup warning for unexpected upstream tools.
- parity details exposed in status endpoint for operator monitoring.
- docs include update policy requiring parity review.

### FM2: Upstream removes/renames a tool expected by wrapper

Risk:

- runtime failures when called, possible degraded reliability.

Mitigation:

- startup warning for missing expected tools.
- status endpoint includes missing list for monitoring/alerting.

### FM3: False confidence from stale parity snapshot

Risk:

- operator assumes parity state remains valid after startup.

Mitigation:

- include snapshot timestamp in status.
- refresh parity snapshot on startup and store in service state.

### FM4: Excessive logging of tool metadata

Risk:

- noisy logs or leakage of unnecessary metadata.

Mitigation:

- log only tool names/counts, not sensitive params/content.

## Decision

Proceed with parity snapshot + status exposure + targeted tests.
