# openclaw-plugin-reddit Documentation

Welcome to the **openclaw-plugin-reddit** documentation. This is a production-grade OpenClaw plugin that exposes Reddit capabilities through the pinned `reddit-mcp-server` dependency with secure defaults.

## 🔒 Security First

This plugin is built with security as the primary concern:

- ✅ **Read-only by default** - Write operations require explicit opt-in
- ✅ **Write tools are optional** - Excluded from default agent allowlists
- ✅ **Delete operations double opt-in** - Extra layer of protection
- ✅ **Rate limiting enforced** - Prevents abuse and Reddit API bans
- ✅ **Credential isolation** - No plaintext secrets, minimal subprocess env
- ✅ **Comprehensive logging** - Security events tracked with audit trail

**Security Audit Status:** ✅ STRONG - [View Full Audit Report](security-audit.md)

## 📚 Quick Links

### Getting Started
- [Installation & Setup](../README.md#install)
- [Configuration Guide](../README.md#configuration)
- [Development Setup](../CLAUDE.md#development-commands)

### Security & Architecture
- [Security Audit Report](security-audit.md) - Full security analysis
- [Security Enhancements](enhancements.md) - Recent improvements
- [Threat Model](architecture/02-threat-model.md) - Security analysis
- [System Design](architecture/01-system-design.md) - Architecture overview

### Development
- [Development Guide](../CLAUDE.md) - For contributors
- [Test Summary](TEST_SUMMARY.md) - Coverage & test strategy
- [API & Tool Surface](architecture/03-api-tool-surface.md) - Available tools

## 🛠️ Tool Surface

### Read Tools (Default Enabled)
- `test_reddit_mcp_server` - Server health check
- `get_reddit_post` - Fetch post details
- `get_top_posts` - List top posts
- `get_user_info` - User profile & karma
- `get_user_posts` - User's post history
- `get_user_comments` - User's comment history
- `get_subreddit_info` - Subreddit details
- `get_trending_subreddits` - Trending communities
- `get_post_comments` - Post comments
- `search_reddit` - Search posts

### Write Tools (Optional - Explicit Opt-in Required)
- `create_post` - Create new post (with subreddit allowlist)
- `reply_to_post` - Reply to post/comment
- `edit_post` - Edit self post
- `edit_comment` - Edit comment
- `delete_post` - Delete post (requires allowDelete=true)
- `delete_comment` - Delete comment (requires allowDelete=true)

## ⚙️ Configuration Modes

### Read-Only Mode (Recommended Default)
```json5
{
  "reddit": {
    "authMode": "auto"
  },
  "write": {
    "enabled": false
  }
}
```

### Write-Enabled Mode (Explicit Opt-in)
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
    "allowedSubreddits": ["test", "myprivatecommunity"]
  }
}
```

## 🔐 Security Features

### Defense-in-Depth Layers
1. **Tool Registration** - Write tools marked as optional
2. **Parameter Validation** - Zod schemas validate all inputs
3. **Credential Validation** - Missing credentials block writes
4. **Policy Enforcement** - WritePolicyGuard checks all write operations
5. **Rate Limiting** - Separate budgets for read/write operations
6. **Subprocess Isolation** - Minimal environment variable allowlist

### Security Event Logging
All security-relevant events are logged with `[SECURITY]` prefix:
- Write operation approvals/denials
- Rate limit violations
- Policy violations
- Credential validation failures

### Known Limitations
- **Rate limit persistence**: State resets on process restart ([details](architecture/02-threat-model.md#t2-high-volume-or-repetitive-writes-cause-reddit-anti-spamban-events))

## 📊 Test Coverage

- **Lines:** 97.81%
- **Branches:** 89.47%
- **Functions:** 96.29%
- **Statements:** 97.5%

All security-critical code paths are fully covered. [View Test Summary](TEST_SUMMARY.md)

## 🚀 Development

This project uses **Yarn 4** with corepack:

```bash
# Enable corepack (first time)
corepack enable

# Install dependencies
yarn install

# Run all validation
yarn validate

# Security audit
yarn audit
```

See the [Development Guide](../CLAUDE.md) for detailed instructions.

## 📖 Architecture Documentation

- [System Design](architecture/01-system-design.md) - Component architecture
- [Threat Model](architecture/02-threat-model.md) - Security analysis
- [API & Tool Surface](architecture/03-api-tool-surface.md) - Tool specifications
- [Configuration Schema](architecture/04-config-schema.md) - Config reference
- [Dependency Boundaries](architecture/05-dependency-boundaries.md) - Module organization

## 🔬 Research & Best Practices

- [OpenClaw Plugin Best Practices](research/01-openclaw-plugin-best-practices.md)
- [Template Evaluation](research/02-template-evaluation.md)

## 📝 License

MIT License - See [LICENSE](../LICENSE) file for details.

## 🤝 Contributing

This project follows strict security practices. All contributions are reviewed against:
- Security guidelines in [CLAUDE.md](../CLAUDE.md#security-constraints-critical)
- Test coverage requirements (95%+ lines, 88%+ branches)
- Code ownership rules in [CODEOWNERS](../CODEOWNERS)

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/SevenOfNine-ai/openclaw-plugin-reddit/issues)
- **Security:** Report security issues privately to repository maintainers
- **Documentation:** This GitBook site + inline code documentation
