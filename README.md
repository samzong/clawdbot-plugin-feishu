# moltbot-channel-feishu

**Turn Feishu into your AI super-gateway.** A production-grade Feishu/Lark channel plugin for [OpenClaw](https://openclaw.ai) / [Moltbot](https://molt.bot) — the brilliant AI agent framework.

## Install

```bash
# OpenClaw (recommended)
openclaw plugins install moltbot-channel-feishu

# Moltbot
moltbot plugins install moltbot-channel-feishu

# Clawdbot (legacy)
clawdbot plugins install moltbot-channel-feishu

# From GitHub (for testing)
openclaw plugins install github:samzong/moltbot-channel-feishu
```

## Configure

Edit `~/.openclaw/openclaw.json` (or `~/.moltbot/moltbot.json` / `~/.clawdbot/clawdbot.json`):

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "domain": "feishu",
      "dmPolicy": "pairing",
      "groupPolicy": "open"
    }
  }
}
```

Or use environment variables (takes precedence if config values are empty):

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable the channel |
| `appId` | string | - | Feishu App ID |
| `appSecret` | string | - | Feishu App Secret |
| `domain` | `"feishu"` \| `"lark"` | `"feishu"` | API domain (China / International) |
| `dmPolicy` | `"open"` \| `"pairing"` \| `"allowlist"` | `"pairing"` | DM access policy |
| `allowFrom` | string[] | `[]` | User IDs allowed for DM (when `dmPolicy: "allowlist"`) |
| `groupPolicy` | `"open"` \| `"allowlist"` \| `"disabled"` | `"allowlist"` | Group chat access policy |
| `groupAllowFrom` | string[] | `[]` | Group IDs allowed (when `groupPolicy: "allowlist"`) |
| `requireMention` | boolean | `true` | Require @mention in groups |

## Feishu App Setup

1. Go to [Feishu Open Platform](https://open.feishu.cn)
2. Create a self-built app
3. Enable permissions: `im:message`, `im:chat`, `contact:user.base:readonly`
4. Events → Use **Long Connection** mode
5. Subscribe to event: `im.message.receive_v1`
6. Get App ID and App Secret from **Credentials** page
7. Publish the app

## License

[MIT](LICENSE)

