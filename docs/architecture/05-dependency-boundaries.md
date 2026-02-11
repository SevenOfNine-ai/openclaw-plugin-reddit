# Dependency Boundaries

## Pinned downstream dependency

- Source repo: `https://github.com/SevenOfNine-ai/reddit-mcp-server`
- Pinned commit: `aa188ec7aba1b6a81398c626dc0ddd45baa6fb68`
- Package manager spec: git-commit pinned dependency in `package.json`

Rationale:

- deterministic behavior
- reduced supply-chain drift
- explicit audit target

## Runtime boundary model

1. OpenClaw plugin (in-process, trusted)
2. MCP subprocess (`reddit-mcp-server`, stdio transport)
3. Reddit API endpoints (network boundary)

The plugin never directly calls Reddit HTTP APIs; it delegates to the pinned MCP server.

## Allowed dependency categories

- OpenClaw SDK surface (`openclaw/plugin-sdk`) for plugin integration
- MCP client SDK for transport bridge
- Validation/runtime helpers (zod, typescript utilities)

## Disallowed / avoided patterns

- Dynamic unpinned dependency fetching at runtime
- Persisting secrets to local plugin state files
- Hidden sidecar daemons or persistent background agents

## Upgrade policy

Any dependency update to reddit-mcp-server requires:

1. commit hash bump in `package.json`
2. architecture/risk review update
3. integration test run (mock + realistic harness)
4. changelog note summarizing security impact
