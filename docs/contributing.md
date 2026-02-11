# Contributing Guide

Thank you for considering contributing to the OpenClaw Reddit Plugin! This document provides guidelines for contributing.

## Code of Conduct

Be respectful, inclusive, and collaborative. We welcome contributions from everyone.

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- Corepack enabled (`corepack enable`)
- Git
- Familiarity with TypeScript

### Development Setup

1. **Fork the repository**
   ```bash
   # On GitHub, click "Fork"
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/openclaw-plugin-reddit.git
   cd openclaw-plugin-reddit
   ```

3. **Enable corepack and install dependencies**
   ```bash
   corepack enable
   yarn install
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

6. **Run validation**
   ```bash
   yarn validate
   ```

7. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

8. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # On GitHub, create Pull Request
   ```

---

## Development Commands

```bash
# Install dependencies
yarn install

# Run all validation (lint + typecheck + test + coverage)
yarn validate

# Individual checks
yarn lint              # ESLint
yarn typecheck         # TypeScript type checking
yarn test              # Vitest tests
yarn test:coverage     # Tests with coverage report

# Build
yarn build

# Security audit
yarn audit

# Clean build artifacts
yarn clean
```

---

## Code Style

### TypeScript

- **Strict mode enabled** - No `any` types without justification
- **Explicit types** - Prefer explicit types over inference where clarity matters
- **Functional style** - Prefer pure functions and immutability
- **Error handling** - Always handle errors explicitly

**Example:**
```typescript
// Good
function validateInput(input: string): Result<Data, Error> {
  if (!input.trim()) {
    return { success: false, error: new Error("Input required") };
  }
  return { success: true, data: parse(input) };
}

// Bad
function validateInput(input: any) {
  return parse(input);  // No validation, no error handling
}
```

### Linting

We use ESLint with TypeScript rules. Run `yarn lint` before committing.

**Auto-fix:**
```bash
yarn lint --fix
```

### Formatting

Code is formatted automatically by ESLint. Follow the existing style in the codebase.

---

## Testing Requirements

### Coverage Thresholds

All PRs must maintain or improve coverage:

- **Lines:** >= 95%
- **Branches:** >= 88%
- **Functions:** >= 94%
- **Statements:** >= 95%

Check coverage: `yarn test:coverage`

### Test Types

**1. Unit Tests** (`tests/unit/`)

Test individual modules in isolation.

**Example:**
```typescript
import { describe, expect, it } from "vitest";
import { WritePolicyGuard } from "../../src/policy.js";

describe("WritePolicyGuard", () => {
  it("blocks write tools when write mode is disabled", () => {
    const guard = new WritePolicyGuard({
      enabled: false,
      allowDelete: false,
      allowedTools: [],
      requireSubredditAllowlist: true,
      allowedSubreddits: [],
    });

    expect(() => guard.ensureToolAllowed("create_post", {}))
      .toThrow("write mode is disabled");
  });
});
```

**2. Integration Tests** (`tests/integration/`)

Test interaction with MCP server.

**Example:**
```typescript
import { describe, expect, it } from "vitest";
import { RedditMcpBridge } from "../../src/reddit-mcp-bridge.js";

describe("integration: reddit-mcp-server", () => {
  it("calls test tool successfully", async () => {
    const bridge = new RedditMcpBridge(launchSpec, 20_000);
    const result = await bridge.callTool("test_reddit_mcp_server", {});

    expect(result).toBeDefined();
  });
});
```

**3. Negative Tests**

Always test error cases:
- Invalid inputs
- Missing credentials
- Policy violations
- Rate limit exhaustion

**Example:**
```typescript
it("rejects oversized post title", async () => {
  const toolSpec = TOOL_SPECS.create_post;
  const params = {
    subreddit: "test",
    title: "x".repeat(301),  // > 300 char limit
    content: "test"
  };

  expect(() => toolSpec.paramsSchema?.parse(params))
    .toThrow("title must be between 1 and 300 characters");
});
```

### Running Tests

```bash
# All tests
yarn test

# Single file
yarn vitest run tests/unit/policy.test.ts

# Watch mode
yarn vitest watch

# With coverage
yarn test:coverage
```

---

## Security Guidelines

### Required Security Practices

1. **No credential leakage**
   - Never log credentials
   - Never commit secrets
   - Use environment variables only

2. **Input validation**
   - Validate all user inputs with Zod schemas
   - Enforce string length limits
   - Check parameter types

3. **Policy enforcement**
   - Never bypass WritePolicyGuard
   - Always check rate limits
   - Maintain defense-in-depth layers

4. **Error handling**
   - Use `verboseErrors` flag for sensitive details
   - Log security events with `[SECURITY]` prefix
   - Fail closed on errors

### Security Checklist for PRs

- [ ] No hardcoded credentials or API keys
- [ ] Input validation added for new parameters
- [ ] Policy checks maintained for write operations
- [ ] Security events logged appropriately
- [ ] Error messages don't leak sensitive data
- [ ] Tests cover security-critical paths
- [ ] Documentation updated for security impact

---

## Adding a New Tool

Follow these steps to add a new Reddit tool:

### 1. Define Tool Spec

In `src/tool-specs.ts`:

```typescript
// Add to READ_TOOL_NAMES or WRITE_TOOL_NAMES
export const READ_TOOL_NAMES = [
  // ... existing tools
  "my_new_tool",
] as const;

// Define Zod schema
const myNewToolSchema = z.object({
  param1: z.string().min(1).max(100),
  param2: z.number().int().min(1).max(10).optional(),
});

// Add to TOOL_SPECS
export const TOOL_SPECS: Record<RedditToolName, ToolSpec> = {
  // ... existing tools
  my_new_tool: {
    name: "my_new_tool",
    description: "Description of what this tool does",
    mode: "read",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["param1"],
      properties: {
        param1: { type: "string" },
        param2: { type: "number" },
      },
    },
    paramsSchema: myNewToolSchema,
  },
};
```

### 2. Add Policy Logic (if write tool)

In `src/policy.ts` (only for write tools):

```typescript
// Add specific policy checks if needed
if (toolName === "my_new_write_tool" && someCondition) {
  throw new Error("Policy violation");
}
```

### 3. Add Tests

Create test file `tests/unit/my-new-tool.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { TOOL_SPECS } from "../../src/tool-specs.js";

describe("my_new_tool", () => {
  it("validates parameters correctly", () => {
    const spec = TOOL_SPECS.my_new_tool;

    expect(() => spec.paramsSchema?.parse({
      param1: "valid"
    })).not.toThrow();

    expect(() => spec.paramsSchema?.parse({
      param1: "x".repeat(101)  // Too long
    })).toThrow();
  });
});
```

### 4. Update Documentation

Add to `docs/api-reference.md`:

```markdown
### my_new_tool

**Description:** Description of what this tool does.

**Parameters:**
- `param1` (string, required) - Description
- `param2` (number, optional) - Description

**Example:**
\`\`\`typescript
{
  param1: "value"
}
\`\`\`
```

### 5. Verify

```bash
yarn validate  # Must pass all checks
```

---

## Commit Message Format

We use conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Examples

```
feat(tools): add get_saved_posts tool

Adds support for fetching user's saved posts. Includes parameter
validation and rate limiting.

Closes #123
```

```
fix(policy): correct subreddit normalization for uppercase input

Subreddit names are now lowercased before allowlist check to handle
case-insensitive matching correctly.

Fixes #456
```

```
docs(security): update threat model with rate limit limitation

Documents the in-memory rate limit reset behavior and provides
recommendations for high-security deployments.
```

---

## Pull Request Process

### Before Submitting

1. ✅ Run `yarn validate` (all checks pass)
2. ✅ Add tests for new code
3. ✅ Update documentation
4. ✅ Write clear commit messages
5. ✅ Rebase on latest main

### PR Description Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Security improvement

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All checks pass
- [ ] No security regressions

## Security Impact

Describe any security-related changes or N/A.

## Breaking Changes

List any breaking changes or "None".
```

### Review Process

1. **Automated checks** run on PR
2. **CODEOWNER review** required (@SevenOfNine-ai)
3. **Address feedback** from reviewers
4. **Squash and merge** when approved

### CI Checks

Your PR must pass:
- ✅ Lint
- ✅ Typecheck
- ✅ Tests with coverage
- ✅ Dependency audit
- ✅ Build

---

## Documentation

### When to Update Docs

Update documentation when you:
- Add new features
- Change behavior
- Add configuration options
- Fix bugs (if user-visible)
- Improve security

### Documentation Files

- **README.md** - Overview, installation, quick start
- **docs/getting-started.md** - Installation and setup guide
- **docs/api-reference.md** - Complete tool reference
- **docs/security-best-practices.md** - Security guidance
- **docs/faq.md** - Common questions
- **CLAUDE.md** - Development guide for contributors

### GitBook Updates

Documentation is automatically deployed to GitHub Pages when you push to main.

Preview locally:
```bash
# Install GitBook CLI globally
yarn global add gitbook-cli

# Build and serve
gitbook serve
```

---

## Release Process

### Version Bumping

We follow semantic versioning:

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features (backward compatible)
- **Patch** (0.0.1): Bug fixes

### Release Checklist

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run `yarn validate`
4. Create git tag: `git tag v0.1.0`
5. Push tag: `git push origin v0.1.0`
6. GitHub Actions creates release

---

## Getting Help

### Questions?

- 📖 Read the [documentation](https://sevenofnine-ai.github.io/openclaw-plugin-reddit/)
- 💬 Start a [GitHub Discussion](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/discussions)
- 🐛 Open an [issue](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/issues)

### Found a Bug?

1. Search existing issues first
2. Create detailed bug report with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details
   - Logs (redact secrets!)

### Security Vulnerability?

**DO NOT** open a public issue.

Email repository maintainers privately with:
- Detailed description
- Reproduction steps
- Impact assessment

---

## Code Review Guidelines

### For Contributors

- Be open to feedback
- Respond promptly to comments
- Keep PRs focused and small
- Write clear descriptions

### For Reviewers

- Be respectful and constructive
- Focus on code quality and security
- Provide actionable feedback
- Approve when ready

---

## Recognition

Contributors who make significant improvements will be:
- Added to contributors list
- Credited in release notes
- Recognized in documentation

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort! 🎉
