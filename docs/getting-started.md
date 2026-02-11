# Getting Started

This guide will walk you through installing and configuring the OpenClaw Reddit Plugin.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js >= 22.0.0** installed
- ✅ **Corepack** enabled (`corepack enable`)
- ✅ **OpenClaw Gateway >= 2026.2.0** installed
- ✅ **Reddit API credentials** (optional for read-only mode)

## Installation

### Step 1: Install the Plugin

```bash
# Local installation from directory
openclaw plugins install ./openclaw-plugin-reddit

# Or from package registry (once published)
openclaw plugins install openclaw-plugin-reddit
```

### Step 2: Configure Credentials (Optional)

For **read-only mode**, you can use anonymous access. For **write mode**, you need Reddit API credentials.

Set environment variables:

```bash
export REDDIT_CLIENT_ID="your_client_id"
export REDDIT_CLIENT_SECRET="your_client_secret"
export REDDIT_USERNAME="your_username"
export REDDIT_PASSWORD="your_password"
export REDDIT_USER_AGENT="OpenClaw Reddit Plugin v0.1.0"
```

> 💡 **Tip:** Add these to your shell profile (~/.bashrc, ~/.zshrc) or use a secret manager.

### Step 3: Configure the Plugin

Edit your OpenClaw configuration file:

#### Read-Only Configuration (Recommended)

```json5
{
  "plugins": {
    "entries": {
      "openclaw-plugin-reddit": {
        "enabled": true,
        "config": {
          "reddit": {
            "authMode": "auto"  // Uses credentials if available
          },
          "write": {
            "enabled": false
          }
        }
      }
    }
  }
}
```

#### Write-Enabled Configuration (Advanced)

```json5
{
  "plugins": {
    "entries": {
      "openclaw-plugin-reddit": {
        "enabled": true,
        "config": {
          "reddit": {
            "authMode": "authenticated",
            "safeModeWriteEnabled": "strict"
          },
          "write": {
            "enabled": true,
            "allowDelete": false,
            "allowedTools": [
              "create_post",
              "reply_to_post"
            ],
            "requireSubredditAllowlist": true,
            "allowedSubreddits": ["test", "sandbox"]
          },
          "rateLimit": {
            "readPerMinute": 60,
            "writePerMinute": 6,
            "minWriteIntervalMs": 5000
          }
        }
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": [
            "create_post",
            "reply_to_post"
          ]
        }
      }
    ]
  }
}
```

### Step 4: Restart the Gateway

```bash
openclaw gateway restart
```

### Step 5: Verify Installation

Check plugin status:

```bash
openclaw plugins list
```

Test the plugin:

```bash
openclaw chat "Can you test the Reddit plugin?"
```

## Quick Test

Try reading top posts from a subreddit:

```
Agent: I'll check the top posts in r/typescript
[Agent uses get_top_posts tool]
```

## Configuration Options

### Authentication Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `auto` | Uses credentials if available, falls back to anonymous | Flexible read-only or write mode |
| `authenticated` | Requires credentials | Write operations required |
| `anonymous` | No authentication | Public read-only access |

### Safe Modes

| Mode | Description |
|------|-------------|
| `off` | No content filtering |
| `standard` | Basic content filtering |
| `strict` | Maximum content safety (recommended for write mode) |

### Rate Limits

Default rate limits are:
- **Read operations:** 60 per minute
- **Write operations:** 6 per minute
- **Minimum write interval:** 5 seconds

Adjust these based on your use case, but keep within Reddit API limits.

## Security Best Practices

1. ✅ **Start with read-only mode** - Test with `write.enabled: false`
2. ✅ **Use subreddit allowlists** - Restrict where posts can be created
3. ✅ **Keep delete disabled** - Set `allowDelete: false` unless absolutely needed
4. ✅ **Minimal tool allowlist** - Only enable the write tools you need
5. ✅ **Monitor logs** - Watch for `[SECURITY]` events in gateway logs
6. ✅ **Test in safe subreddits** - Use r/test or private communities first

## Troubleshooting

### Plugin Not Loading

**Symptom:** Plugin doesn't appear in `openclaw plugins list`

**Solutions:**
1. Check plugin path is correct
2. Verify `openclaw.plugin.json` exists
3. Check OpenClaw Gateway logs for errors
4. Run `openclaw plugins validate ./openclaw-plugin-reddit`

### Credential Errors

**Symptom:** Write operations blocked with "missing credentials"

**Solutions:**
1. Verify environment variables are set: `echo $REDDIT_CLIENT_ID`
2. Check credentials are valid on Reddit
3. Ensure `authMode` is set to `authenticated`
4. Restart gateway after setting environment variables

### Rate Limit Errors

**Symptom:** Tools blocked with "Rate limit exceeded"

**Solutions:**
1. Wait for the retry time specified in error message
2. Increase rate limits in config (but stay within Reddit API limits)
3. Check for runaway agent loops
4. Monitor with `openclaw-plugin-reddit.status` gateway method

### Write Operations Not Working

**Symptom:** Write tools return "write mode is disabled"

**Solutions:**
1. Set `write.enabled: true` in plugin config
2. Add tool to `write.allowedTools` array
3. Add tool to agent's `tools.allow` list
4. For delete operations, also set `allowDelete: true`
5. For create_post, add subreddit to `allowedSubreddits`

## Next Steps

- 📖 Read the [Architecture Overview](architecture/README.md)
- 🔒 Review the [Security Best Practices](security-best-practices.md)
- 🔐 Check the [Security Audit Report](security-audit.md)
- 🛠️ Explore the [API Reference](api-reference.md)
- 📋 Check the [FAQ](faq.md)

## Getting Help

- 📝 **Documentation:** This GitBook site
- 🐛 **Issues:** [GitHub Issues](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/issues)
- 🔒 **Security:** Report privately to repository maintainers
- 💬 **Discussions:** [GitHub Discussions](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/discussions)
