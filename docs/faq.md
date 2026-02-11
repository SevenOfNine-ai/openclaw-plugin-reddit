# Frequently Asked Questions

Common questions and troubleshooting for the OpenClaw Reddit Plugin.

## General Questions

### What is this plugin?

The OpenClaw Reddit Plugin is a production-grade wrapper that exposes Reddit capabilities to OpenClaw agents through the `reddit-mcp-server`. It provides secure, rate-limited access to Reddit with write operations disabled by default.

### Is it safe to use?

Yes. The plugin has undergone comprehensive security audit and implements multiple security layers. It defaults to read-only mode and requires explicit opt-in for write operations. See the [Security Best Practices](security-best-practices.md) guide.

### Do I need Reddit API credentials?

**For read-only mode:** No, anonymous access works for public content.

**For write mode:** Yes, you need:
- Reddit client ID
- Reddit client secret
- Reddit username
- Reddit password

### How do I get Reddit API credentials?

1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app"
3. Select "script" type
4. Note your client ID and secret
5. Use your Reddit username/password

### What's the difference between read and write tools?

**Read tools:**
- View posts, comments, user info
- No Reddit account needed (anonymous)
- Enabled by default
- Lower risk

**Write tools:**
- Create posts, reply, edit, delete
- Require Reddit account and credentials
- Disabled by default (explicit opt-in)
- Higher risk, more restrictions

---

## Configuration Questions

### Where do I put the configuration?

In your OpenClaw Gateway configuration file under `plugins.entries["openclaw-plugin-reddit"].config`.

Example location: `~/.openclaw/config.json5`

### How do I enable write mode?

```json5
{
  "plugins": {
    "entries": {
      "openclaw-plugin-reddit": {
        "config": {
          "write": {
            "enabled": true,
            "allowedTools": ["create_post", "reply_to_post"]
          }
        }
      }
    }
  }
}
```

Also add tools to agent allowlist and configure credentials.

### What's the difference between plugin and agent tool allowlists?

**Plugin allowlist** (`write.allowedTools`):
- Controls which write tools the plugin will execute
- First layer of protection

**Agent allowlist** (`agents[].tools.allow`):
- Controls which tools the agent can invoke
- Second layer of protection

Both must approve a tool for it to work. Use the more restrictive of the two.

### Can I use different credentials for different agents?

Not directly. The plugin uses a single set of Reddit credentials from environment variables. To use multiple accounts, you would need to run separate OpenClaw Gateway instances.

---

## Troubleshooting

### Plugin not loading

**Symptom:** Plugin doesn't appear in `openclaw plugins list`

**Possible causes:**
1. Plugin path incorrect
2. `openclaw.plugin.json` missing or invalid
3. OpenClaw version incompatible (requires >= 2026.2.0)
4. Node.js version too old (requires >= 22.0.0)

**Solutions:**
```bash
# Validate plugin
openclaw plugins validate ./openclaw-plugin-reddit

# Check OpenClaw version
openclaw --version

# Check Node.js version
node --version

# View gateway logs
openclaw logs --tail 100
```

### "Write blocked: Missing Reddit credentials"

**Symptom:** Write tools return credential error even though env vars are set

**Possible causes:**
1. Environment variables not set in gateway process
2. Variable names misspelled
3. Gateway not restarted after setting env vars

**Solutions:**
```bash
# Verify env vars are set
echo $REDDIT_CLIENT_ID
echo $REDDIT_CLIENT_SECRET
echo $REDDIT_USERNAME
echo $REDDIT_PASSWORD

# Restart gateway
openclaw gateway restart

# Check credential resolution
openclaw gateway call openclaw-plugin-reddit.status
```

### "Write tool blocked: write mode is disabled"

**Symptom:** Write tools fail even with credentials

**Possible causes:**
1. `write.enabled` is false
2. Tool not in `write.allowedTools`
3. Tool not in agent's `tools.allow`

**Solutions:**
1. Enable write mode in plugin config
2. Add tool to `write.allowedTools` array
3. Add tool to agent's `tools.allow` list
4. Restart gateway after config changes

### "create_post blocked: subreddit not in allowlist"

**Symptom:** Can't create posts even with write mode enabled

**Possible causes:**
1. `requireSubredditAllowlist` is true (default)
2. Target subreddit not in `allowedSubreddits`

**Solutions:**
```json5
{
  "write": {
    "enabled": true,
    "allowedTools": ["create_post"],
    "requireSubredditAllowlist": true,
    "allowedSubreddits": ["test", "mysubreddit"]  // Add your subreddit
  }
}
```

Or disable allowlist (not recommended):
```json5
{
  "write": {
    "requireSubredditAllowlist": false  // ⚠️ Dangerous
  }
}
```

### "Rate limit exceeded"

**Symptom:** Tools blocked with "Retry in Xms"

**Possible causes:**
1. Too many requests in short time
2. Rate limits too restrictive
3. Runaway agent loop

**Solutions:**
1. **Wait:** Respect the retry-after time
2. **Investigate:** Check for agent loops
3. **Adjust limits:** Increase if legitimate usage
```json5
{
  "rateLimit": {
    "readPerMinute": 120,  // Increase if needed
    "writePerMinute": 10
  }
}
```

### "Delete operation blocked: explicit opt-in required"

**Symptom:** Can't delete posts/comments even with write mode

**Possible causes:**
1. `write.allowDelete` is false (default)

**Solutions:**
```json5
{
  "write": {
    "enabled": true,
    "allowDelete": true,  // ⚠️ Enable delete operations
    "allowedTools": ["delete_post", "delete_comment"]
  }
}
```

**Warning:** Deletes are irreversible. Use with caution.

### MCP server not starting

**Symptom:** Bridge connection errors, tools not available

**Possible causes:**
1. `reddit-mcp-server` package not installed
2. Node.js modules missing
3. Startup timeout too short

**Solutions:**
```bash
# Reinstall dependencies
yarn install

# Check reddit-mcp-server is installed
ls -la node_modules/reddit-mcp-server

# Increase startup timeout
{
  "startupTimeoutMs": 30000  // 30 seconds
}
```

### "Parameter validation failed"

**Symptom:** Tools rejected with validation error

**Possible causes:**
1. Invalid parameter types
2. String too long/short
3. Required parameter missing

**Solutions:**
Check parameter constraints:
- Post titles: 1-300 characters
- Post content: 1-40,000 characters
- Comment content: 1-10,000 characters
- Usernames/subreddits: 1-100 characters

Example error:
```
Invalid parameters for create_post: title must be between 1 and 300 characters
```

Fix: Ensure title is within limits.

---

## Security Questions

### Is my Reddit account safe?

Yes, if you follow security best practices:
1. Start with read-only mode
2. Use application-specific passwords
3. Monitor logs for unexpected activity
4. Use subreddit allowlists
5. Keep `allowDelete: false`

See [Security Best Practices](security-best-practices.md) for details.

### Can the agent post anywhere on Reddit?

**Default:** No. Subreddit allowlist is required by default.

**If you disable allowlist:** Yes, agent can post to any subreddit it can access.

**Recommendation:** Always use subreddit allowlists.

### What if my credentials are compromised?

1. Immediately rotate credentials on Reddit
2. Disable write mode: `write.enabled: false`
3. Restart gateway
4. Review logs for unauthorized activity
5. Report to Reddit if abuse detected

### Does the plugin store my credentials?

No. The plugin only stores environment variable **names**, not values. Credentials are read from environment variables at runtime and never persisted to disk.

### What data does the plugin log?

The plugin logs:
- Tool invocations (tool name, not full parameters)
- Security events (policy violations, rate limits)
- MCP bridge status
- Parity checks

**Not logged:**
- Reddit credentials
- Full post/comment content
- User passwords

---

## Performance Questions

### How fast are the tools?

**Read tools:** 100-500ms typical (depends on Reddit API)

**Write tools:** 500-1000ms typical (includes safety delays)

**Rate limits add delays when exhausted.**

### Can I make concurrent requests?

Yes, but within rate limits:
- Read: 60/minute default
- Write: 6/minute default

Concurrent requests count toward the same limits.

### Why is there a 5-second delay between writes?

**Default `minWriteIntervalMs: 5000`** prevents:
1. Burst posting (Reddit anti-spam)
2. Agent loops
3. Accidental spam

Configurable, but keep >= 3000ms recommended.

### Do rate limits persist across restarts?

**No.** Rate limit state is in-memory only and resets on gateway restart.

**Impact:** Brief window where limits can be bypassed via restart.

**Mitigation:** Protect gateway from unauthorized restarts. See [threat model](architecture/02-threat-model.md#t2-high-volume-or-repetitive-writes-cause-reddit-anti-spamban-events).

---

## Feature Questions

### Can I edit other users' posts?

No. Reddit API only allows editing your own posts/comments.

### Can I moderate subreddits?

Not directly. This plugin exposes basic user operations. Moderator actions (ban, remove, approve) are not currently supported.

**Workaround:** Use moderator-specific Reddit API tools or create custom plugin.

### Can I send private messages?

Not currently. The plugin focuses on public content (posts, comments).

**Future:** May be added in future version.

### Can I upload images/videos?

Not directly. The `create_post` tool supports text posts only.

**Workaround:** Use URLs to existing images/videos in post content.

### Can I access private subreddits?

Yes, if your Reddit account has access. Use `authMode: "authenticated"` and ensure credentials are configured.

### Can I get real-time notifications?

No. The plugin is pull-based (you request data), not push-based (notifications).

**Workaround:** Poll with `get_post_comments` or `get_user_info` periodically.

---

## Development Questions

### How do I contribute?

See [CONTRIBUTING.md](contributing.md) for guidelines.

Key points:
1. Fork the repository
2. Create feature branch
3. Add tests (95%+ coverage required)
4. Follow security guidelines
5. Submit PR (CODEOWNERS will review)

### How do I run tests?

```bash
# All tests with coverage
yarn validate

# Single test file
yarn vitest run tests/unit/policy.test.ts

# Watch mode
yarn vitest watch
```

### How do I add a new tool?

See [CLAUDE.md](../CLAUDE.md#common-development-patterns) for detailed steps.

Summary:
1. Add tool spec to `src/tool-specs.ts`
2. Add Zod schema for parameters
3. Classify as read or write
4. Update policy if write tool
5. Add test coverage

### Where are the docs deployed?

GitHub Pages: `https://sevenofnine-ai.github.io/openclaw-plugin-reddit/`

Deployed automatically on push to main (if docs changed).

---

## Compatibility Questions

### What OpenClaw version is required?

**Minimum:** OpenClaw Gateway >= 2026.2.0

Check version: `openclaw --version`

### What Node.js version is required?

**Minimum:** Node.js >= 22.0.0

Check version: `node --version`

### Does it work with other package managers?

The project uses **Yarn 4** with corepack. While you can use npm for installation, all scripts and CI use yarn.

**Recommendation:** Use `corepack enable` and `yarn install`.

### Is it compatible with Docker?

Yes. Example Dockerfile:

```dockerfile
FROM node:22-alpine

# Enable corepack
RUN corepack enable

# Install plugin
COPY . /app/openclaw-plugin-reddit
WORKDIR /app/openclaw-plugin-reddit
RUN yarn install --immutable

# Install OpenClaw and configure
# ... (your OpenClaw setup)
```

---

## Still Have Questions?

- 📖 **Documentation:** [Full docs on GitHub Pages](https://sevenofnine-ai.github.io/openclaw-plugin-reddit/)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/discussions)
- 🔒 **Security:** Email repository maintainers privately

---

## Quick Links

- [Getting Started](getting-started.md)
- [API Reference](api-reference.md)
- [Security Best Practices](security-best-practices.md)
- [Configuration Schema](architecture/04-config-schema.md)
- [Troubleshooting](getting-started.md#troubleshooting)
