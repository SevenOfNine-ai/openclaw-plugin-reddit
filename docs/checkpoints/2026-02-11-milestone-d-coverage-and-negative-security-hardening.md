# Design Checkpoint — Milestone D

Date: 2026-02-11
Milestone: Coverage + negative/security-path hardening

## Goal

Increase confidence in failure-path behavior with meaningful tests and improve practical near-100 coverage posture without adding trivial assertions.

## Proposed changes

1. Add additional negative-path tests for MCP bridge launch/connect behavior.
2. Add plugin tests for CLI-optional path and status/parity behavior under startup failures.
3. Update test summary with latest metrics and explicit interpretation.

## Self-critique

- Pushing branch coverage too aggressively can lead to brittle tests tied to implementation details.
- Some private helper branches are hard to test without invasive mocks; avoid fake-value assertions with little safety value.
- Coverage numbers are useful but secondary to real security-path confidence.

## Failure modes / security risks (feature set: test hardening)

### FM1: False confidence from superficial tests

Risk:

- high coverage with low security value.

Mitigation:

- prefer behavior-driven tests for guardrails and error handling.
- include explicit negative and security paths.

### FM2: Unhandled startup/transport edge path regression

Risk:

- runtime failures in production despite passing happy-path tests.

Mitigation:

- add tests for startup failures, transport recovery, and fallback behavior.

### FM3: Over-mocking hides integration reality

Risk:

- unit tests pass while real subprocess interactions fail.

Mitigation:

- keep realistic integration harness against pinned reddit-mcp-server.
- keep mock harness for deterministic negative-path checks.

### FM4: Coverage-chasing degrades maintainability

Risk:

- tests become implementation-coupled and hard to maintain.

Mitigation:

- avoid private internals assertions unless tied to guardrail behavior.
- focus on public behavior and operator-visible outcomes.

## Decision

Proceed with targeted negative/security-path tests and documentation refresh.
