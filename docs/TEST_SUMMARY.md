# Test & Coverage Summary

Validation command:

```bash
npm run validate
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
- Tests: 48 passed, 0 failed

Coverage (v8):

- Statements: **96.01%**
- Branches: **89.3%**
- Functions: **94.23%**
- Lines: **96.35%**

Coverage gates enforced in config:

- statements >= 95
- lines >= 95
- functions >= 94
- branches >= 88

Notes:

- Branch coverage is lower than line coverage due defensive fallback branches around transport and runtime guards.
- Core policy modules (`config.ts`, `policy.ts`, `rate-limit.ts`, `tool-specs.ts`) are at or near full line coverage.
