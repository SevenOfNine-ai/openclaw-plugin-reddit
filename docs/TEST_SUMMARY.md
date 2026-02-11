# Test & Coverage Summary

Validation command:

```bash
yarn validate
```

Executed suites:

- Unit tests
  - config parsing + env resolution
  - write policy guardrails
  - read/write rate limiting
  - MCP bridge launch/edge behavior
  - plugin registration + runtime guardrails
- Integration tests
  - mock stdio MCP harness
  - realistic harness against pinned `reddit-mcp-server`

Latest results:

- Test files: 7 passed
- Tests: 58 passed, 0 failed

Coverage (v8):

- Statements: **97.5%**
- Branches: **89.47%**
- Functions: **96.29%**
- Lines: **97.81%**

Coverage gates enforced in config:

- statements >= 95
- lines >= 95
- functions >= 94
- branches >= 88

Notes:

- Security-critical logic paths (config, policy, rate-limit, tool registry) are fully line-covered.
- Additional negative/security tests cover:
  - blocked writes in read-only mode
  - blocked writes not explicitly allowlisted
  - blocked deletes without explicit delete opt-in
  - missing-credential write denials
  - subprocess env secret-boundary behavior
  - startup parity drift diagnostics
  - reconnect + shutdown resilience paths in MCP bridge
