# Design Checkpoint — Milestone E

Date: 2026-02-11
Milestone: Bridge lifecycle assurance tests

## Goal

Increase confidence in MCP bridge lifecycle behavior (reconnect/close) under failure conditions.

## Proposed changes

1. Add explicit test for internal reconnect sequence (`close` then `connect`).
2. Keep tests behavior-driven and scoped to resilience guarantees.
3. Re-run full validate pipeline and capture updated metrics.

## Self-critique

- Testing a private method can be implementation-coupled.
- However, reconnect behavior is safety-critical and currently not fully represented.
- Must avoid fragile assertions on internal call ordering details beyond core guarantees.

## Failure modes / security risks (feature set: bridge lifecycle)

### FM1: Broken reconnect sequence leaves stale client state

Risk:

- repeated tool-call failures after transient transport errors.

Mitigation:

- explicit reconnect test ensures close/connect path remains wired.

### FM2: Reconnect path silently regresses during refactors

Risk:

- hidden reliability degradation not caught in unit tests.

Mitigation:

- regression test for reconnect invocation and result behavior.

### FM3: Cleanup path throws and blocks service shutdown

Risk:

- degraded restart/shutdown behavior.

Mitigation:

- shutdown is best-effort (close swallows transport close failures).
- test coverage for close failure path retained.

## Decision

Proceed with one focused reconnect lifecycle test.
