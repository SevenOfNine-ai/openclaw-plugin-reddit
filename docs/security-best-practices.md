# Security Best Practices

This page provides security guidance for operators deploying the OpenClaw Reddit Plugin.

## 🔒 Security Posture

**Current Status:** <span class="security-badge strong">STRONG</span>

The plugin has undergone comprehensive security audit with **no critical or high-severity findings**. See the [full security audit report](security-audit.md) for details.

---

## Default Security Settings

The plugin ships with secure defaults:

| Setting | Default | Security Impact |
|---------|---------|-----------------|
| Write mode | ❌ **Disabled** | Prevents unintended modifications |
| Delete operations | ❌ **Disabled** | Extra protection for destructive actions |
| Write tool allowlist | **Empty** | No write tools enabled by default |
| Subreddit allowlist | ✅ **Required** | Prevents posting to unintended communities |
| Safe mode (write) | **Strict** | Maximum content filtering |
| Rate limits | ✅ **Enforced** | Prevents abuse and API bans |
| Error verbosity | **Generic** | Prevents config detail leakage |

**Recommendation:** Start with these defaults and only enable what you need.

---

## Deployment Modes

### Read-Only Mode (Recommended)

**Use Case:** Browsing Reddit, searching posts, reading user info

**Security Level:** <span class="security-badge strong">Highest</span>

**Configuration:**
```json5
{
  "reddit": {
    "authMode": "auto"  // Optional credentials
  },
  "write": {
    "enabled": false  // Write operations blocked
  }
}
```

**Benefits:**
- ✅ No risk of unintended modifications
- ✅ Works with anonymous access
- ✅ No credential requirements
- ✅ Safe for untrusted agents

---

### Monitored Write Mode

**Use Case:** Automated posting to controlled subreddits with monitoring

**Security Level:** <span class="security-badge medium">Medium</span>

**Configuration:**
```json5
{
  "reddit": {
    "authMode": "authenticated",
    "safeModeWriteEnabled": "strict"
  },
  "write": {
    "enabled": true,
    "allowDelete": false,
    "allowedTools": ["create_post", "reply_to_post"],
    "requireSubredditAllowlist": true,
    "allowedSubreddits": ["test", "mybot"]
  },
  "rateLimit": {
    "writePerMinute": 6,
    "minWriteIntervalMs": 5000
  },
  "verboseErrors": false  // Production setting
}
```

**Requirements:**
- ✅ Monitor gateway logs for `[SECURITY]` events
- ✅ Set up alerts for rate limit violations
- ✅ Review agent behavior regularly
- ✅ Test in safe subreddits first (r/test, private communities)

---

### Full Access Mode

**Use Case:** Trusted automation with delete capabilities

**Security Level:** <span class="security-badge low">Lowest</span>

**⚠️ Warning:** Only use this mode if you fully trust the agent and have strong monitoring.

**Configuration:**
```json5
{
  "write": {
    "enabled": true,
    "allowDelete": true,  // ⚠️ Enables destructive operations
    "allowedTools": [
      "create_post",
      "reply_to_post",
      "edit_post",
      "edit_comment",
      "delete_post",
      "delete_comment"
    ],
    "requireSubredditAllowlist": true,
    "allowedSubreddits": ["mybot", "testing"]
  }
}
```

**Additional Safeguards:**
- ✅ Use minimal agent tool allowlist
- ✅ Enable comprehensive audit logging
- ✅ Set up automated alerts
- ✅ Regular security reviews
- ✅ Backup/restore procedures

---

## Defense-in-Depth Layers

The plugin implements multiple security layers:

```
1. Tool Registration
   └─ Write tools marked as optional
      └─ Excluded from default agent allowlists

2. Parameter Validation
   └─ Zod schemas validate all inputs
      └─ String length limits enforced

3. Credential Validation
   └─ Missing credentials block writes
      └─ Logged with [SECURITY] prefix

4. Policy Enforcement
   └─ WritePolicyGuard checks:
      ├─ write.enabled
      ├─ write.allowedTools
      ├─ write.allowDelete
      └─ subreddit allowlist

5. Rate Limiting
   └─ Separate budgets for read/write
      └─ Minimum interval between writes

6. Subprocess Isolation
   └─ Minimal environment allowlist
      └─ Host secrets blocked

7. Security Logging
   └─ All violations logged
      └─ Audit trail for compliance
```

**Principle:** Even if one layer fails, others provide protection.

---

## Credential Management

### Environment Variables (Recommended)

Store credentials in environment variables:

```bash
export REDDIT_CLIENT_ID="abc123"
export REDDIT_CLIENT_SECRET="xyz789"
export REDDIT_USERNAME="mybot"
export REDDIT_PASSWORD="secure_password"
export REDDIT_USER_AGENT="OpenClaw Reddit Plugin v0.1.0"
```

**Best Practices:**
- ✅ Use secret management systems (Vault, AWS Secrets Manager, etc.)
- ✅ Rotate credentials regularly
- ✅ Use application-specific passwords
- ✅ Never commit credentials to git
- ✅ Restrict environment variable access

### Credential Isolation

The plugin only forwards these env vars to the MCP subprocess:

```typescript
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
REDDIT_USERNAME
REDDIT_PASSWORD
REDDIT_USER_AGENT
REDDIT_AUTH_MODE
REDDIT_SAFE_MODE
```

**Blocked from subprocess:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `AWS_SECRET_ACCESS_KEY`
- All other unrelated secrets

**Validation:** See test coverage in `tests/unit/reddit-mcp-bridge.test.ts:32-44`

---

## Rate Limiting Strategy

### Default Limits

| Operation | Limit | Rationale |
|-----------|-------|-----------|
| Read | 60/minute | Reddit API comfort zone |
| Write | 6/minute | Conservative to avoid bans |
| Write interval | 5 seconds | Prevents burst posting |

### Adjusting Limits

**Guidelines:**
1. Stay well below Reddit's actual limits (unknown but ~30/minute)
2. Lower limits for untrusted agents
3. Higher limits only if monitoring is in place
4. Test with low limits first

**Example - Aggressive (requires monitoring):**
```json5
{
  "rateLimit": {
    "readPerMinute": 120,
    "writePerMinute": 10,
    "minWriteIntervalMs": 3000
  }
}
```

**Example - Conservative (safe for production):**
```json5
{
  "rateLimit": {
    "readPerMinute": 30,
    "writePerMinute": 3,
    "minWriteIntervalMs": 10000
  }
}
```

### Known Limitation

⚠️ **Rate limit state resets on gateway restart.**

**Impact:** Brief window where limits can be bypassed via process restart.

**Mitigations:**
- Protect gateway process from unauthorized restarts
- Monitor for unusual restart patterns
- Reddit's own API limits provide additional defense
- Consider persistent rate limiting for high-security deployments

See [threat model](architecture/02-threat-model.md#t2-high-volume-or-repetitive-writes-cause-reddit-anti-spamban-events) for details.

---

## Monitoring & Logging

### Security Event Log Format

All security events are logged with `[SECURITY]` prefix:

```
[SECURITY] Write operation allowed: create_post
[SECURITY] Write operation blocked: create_post - missing credentials
[SECURITY] Write rate limit exceeded: reply_to_post - retry in 3000ms
[SECURITY] Read rate limit exceeded: get_top_posts - retry in 1500ms
[SECURITY] Policy violation: create_post - subreddit not in allowlist
[SECURITY] Parameter validation failed: create_post
```

### Log Monitoring Setup

**1. Search for security events:**
```bash
# Real-time monitoring
tail -f /path/to/openclaw/logs | grep "\[SECURITY\]"

# Daily summary
grep "\[SECURITY\]" /path/to/openclaw/logs | tail -100
```

**2. Set up alerts:**
```bash
# Example: Alert on rate limit violations
grep "rate limit exceeded" /path/to/openclaw/logs | \
  mail -s "OpenClaw Rate Limit Alert" admin@example.com
```

**3. Aggregate logs:**
- Use centralized logging (ELK, Splunk, etc.)
- Create dashboards for security metrics
- Track trends over time

### Key Metrics to Monitor

| Metric | Normal | Alert Threshold |
|--------|--------|-----------------|
| Write operations/day | Expected usage | >2x expected |
| Rate limit hits/hour | <5 | >10 |
| Policy violations/hour | 0 | >1 |
| Credential failures | 0 (after setup) | >0 |
| Gateway restarts/day | 0-1 | >3 |

---

## Subreddit Allowlist Strategy

### Why Use Allowlists?

Prevents agents from posting to unintended communities due to:
- Prompt injection attacks
- Agent confusion/hallucination
- Misconfigured instructions
- Typos in subreddit names

### Allowlist Configuration

**Example - Single test subreddit:**
```json5
{
  "write": {
    "requireSubredditAllowlist": true,
    "allowedSubreddits": ["test"]
  }
}
```

**Example - Multiple controlled communities:**
```json5
{
  "write": {
    "requireSubredditAllowlist": true,
    "allowedSubreddits": [
      "test",
      "sandbox",
      "mybot",
      "mycompanycommunity"
    ]
  }
}
```

**Example - Disable allowlist (not recommended):**
```json5
{
  "write": {
    "requireSubredditAllowlist": false  // ⚠️ Agent can post anywhere
  }
}
```

### Subreddit Normalization

The plugin automatically normalizes subreddit names:
- Strips `r/` prefix: `r/typescript` → `typescript`
- Lowercases: `TypeScript` → `typescript`
- Deduplicates: `["test", "Test", "r/test"]` → `["test"]`

**Both formats work:**
```json5
"allowedSubreddits": ["typescript"]
"allowedSubreddits": ["r/typescript"]  // Equivalent
```

---

## Agent Tool Allowlists

### Two-Layer Protection

Write tools require approval at **two levels**:

**1. Plugin Level** (`write.allowedTools`)
```json5
{
  "write": {
    "allowedTools": ["create_post", "reply_to_post"]
  }
}
```

**2. Agent Level** (`agents.list[].tools.allow`)
```json5
{
  "agents": {
    "list": [{
      "id": "main",
      "tools": {
        "allow": ["create_post"]  // Even more restrictive
      }
    }]
  }
}
```

### Principle of Least Privilege

Only enable the minimum tools needed:

**Example - Posting bot:**
```json5
{
  "allowedTools": ["create_post"]  // Only posting, no replies/edits/deletes
}
```

**Example - Reply bot:**
```json5
{
  "allowedTools": ["reply_to_post"]  // Only replies, no posts/edits/deletes
}
```

**Example - Moderation bot:**
```json5
{
  "allowedTools": [
    "reply_to_post",
    "edit_comment",
    "delete_comment"
  ]
}
```

---

## Error Message Verbosity

### Production vs Development

**Production setting:**
```json5
{
  "verboseErrors": false  // Generic error messages
}
```

**Error example:** `"Write operation blocked: write mode is disabled."`

**Development setting:**
```json5
{
  "verboseErrors": true  // Detailed error messages
}
```

**Error example:** `"Write tool 'create_post' is blocked: write mode is disabled. Enable write mode explicitly in plugin config."`

### Why Reduce Verbosity in Production?

**Security through obscurity** (as additional layer):
- Prevents agents from learning allowlist contents
- Reduces information leakage in prompt injection scenarios
- Makes reconnaissance harder

**Note:** This is **not** a primary security control. Policy enforcement is the main protection.

---

## Hardening Checklist

Before deploying to production:

### Configuration Review
- [ ] Write mode disabled unless strictly needed
- [ ] If enabling writes, `safeModeWriteEnabled` is "strict"
- [ ] `allowDelete` is false unless absolutely required
- [ ] Minimal `write.allowedTools` (only what's needed)
- [ ] Subreddit allowlist is populated and reviewed
- [ ] Rate limits are appropriate for use case
- [ ] `verboseErrors` is false for production
- [ ] Credentials are stored in environment variables (not config)

### Access Control
- [ ] OpenClaw agent tool allowlists match plugin allowlist
- [ ] Only trusted operators can restart gateway
- [ ] CODEOWNERS file configured for PR reviews
- [ ] Gateway logs have restricted access

### Monitoring
- [ ] Gateway logs are aggregated centrally
- [ ] Alerts configured for `[SECURITY]` events
- [ ] Rate limit violations trigger notifications
- [ ] Dashboard created for security metrics

### Operational
- [ ] Test in safe subreddits first (r/test, private communities)
- [ ] Document rollback procedures
- [ ] Schedule regular security reviews
- [ ] Run `yarn audit` for dependency vulnerabilities
- [ ] Review Dependabot security PRs weekly

### Validation
- [ ] Run `openclaw security audit --deep` after deployment
- [ ] Verify credentials work with test tool
- [ ] Test rate limiting behavior
- [ ] Verify policy enforcement with deliberate violations
- [ ] Check logs show `[SECURITY]` events correctly

---

## Incident Response

### Rate Limit Violations

**Symptom:** Multiple `[SECURITY] Rate limit exceeded` logs

**Actions:**
1. Check for runaway agent loops
2. Review recent agent instructions
3. Increase rate limits if legitimate usage
4. Add cooldown period if abuse detected

### Unauthorized Write Attempts

**Symptom:** `[SECURITY] Policy violation` logs

**Actions:**
1. Review agent prompt history
2. Check for prompt injection attempts
3. Verify allowlist configuration is correct
4. Consider disabling write mode temporarily

### Credential Compromise

**Symptom:** Unexpected posts/comments on Reddit

**Actions:**
1. Immediately rotate all Reddit credentials
2. Disable write mode: `write.enabled: false`
3. Review gateway logs for unauthorized access
4. Audit all recent write operations
5. Report to Reddit if abuse detected

### Gateway Compromise

**Symptom:** Unexpected restarts, config changes

**Actions:**
1. Stop gateway immediately
2. Review system logs for unauthorized access
3. Rotate all credentials
4. Audit configuration files
5. Restore from known-good backup
6. Investigate root cause before restart

---

## Security Audit Results

The plugin has undergone comprehensive security audit:

| Finding | Severity | Status |
|---------|----------|--------|
| M1: Rate limit persistence | Medium | ✅ Documented |
| L1: Parameter validation | Low | ✅ Implemented |
| L2: Error verbosity | Low | ✅ Implemented |
| L3: Security logging | Low | ✅ Implemented |

**No critical or high-severity findings.**

See [full audit report](security-audit.md) for details.

---

## Additional Resources

- [Threat Model](architecture/02-threat-model.md) - Security threat analysis
- [Security Audit Report](security-audit.md) - Full audit findings
- [Security Enhancements](enhancements.md) - Recent improvements
- [Configuration Schema](architecture/04-config-schema.md) - All config options
- [API Reference](api-reference.md) - Tool specifications

---

## Reporting Security Issues

Found a security vulnerability?

**DO NOT** open a public GitHub issue.

Instead:
1. Email repository maintainers privately
2. Include detailed reproduction steps
3. Provide impact assessment
4. Allow time for fix before disclosure

**Security Hall of Fame:** Contributors who responsibly disclose security issues will be credited (with permission).
