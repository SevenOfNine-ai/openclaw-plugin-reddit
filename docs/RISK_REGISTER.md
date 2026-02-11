# Risk Register

## R1: Prompt-injection-driven write calls

- Impact: unintended Reddit writes/deletes
- Likelihood: medium (tool-enabled agents)
- Mitigations:
  - write tools optional (`optional: true`)
  - `write.enabled=false` by default
  - explicit delete gate (`allowDelete=false` default)
  - subreddit allowlist for `create_post`

## R2: Reddit anti-spam/ban due to automation cadence

- Impact: account restrictions or bans
- Likelihood: medium
- Mitigations:
  - plugin rate limits (read/write + min write interval)
  - downstream `REDDIT_SAFE_MODE` strict in write-enabled mode

## R3: Credential leakage

- Impact: account takeover
- Likelihood: low-medium
- Mitigations:
  - env-only credentials, no plaintext secret persistence
  - no credential logging
  - fail-closed checks for write/authenticated mode

## R4: Upstream dependency drift or compromise

- Impact: behavior/security regression
- Likelihood: low-medium
- Mitigations:
  - pinned dependency to explicit commit `aa188ec...`
  - CI gates + integration harness tests
  - documented upgrade policy in architecture docs

## R5: MCP transport instability

- Impact: tool failures/intermittent outages
- Likelihood: medium
- Mitigations:
  - reconnect path for recoverable transport errors
  - explicit startup diagnostics and status method

## R6: Packaging/runtime mismatch for upstream MCP server

- Impact: plugin starts but cannot spawn downstream server
- Likelihood: medium
- Mitigations:
  - launch fallback logic:
    - prefer `dist/bin.js` if present
    - fallback to `src/index.ts` with `tsx`
  - integration tests against pinned dependency in current packaging mode
