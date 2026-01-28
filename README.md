# clawdbot-plugin-feishu

Feishu channel plugin for [Clawdbot](https://github.com/anthropics/clawdbot).

## Install

```bash
clawdbot plugins install github:samzong/clawdbot-plugin-feishu
```

## Configure

### Environment Variables (recommended)

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### Config File

```yaml
# ~/.clawdbot/config.yml
channels:
  feishu:
    enabled: true
    appId: "cli_xxx"        # or use env var
    appSecret: "xxx"        # or use env var
    domain: feishu          # feishu | lark
    dmPolicy: pairing       # open | pairing | allowlist
    groupPolicy: allowlist  # open | allowlist | disabled
```

## Feishu App Setup

1. Go to [Feishu Open Platform](https://open.feishu.cn)
2. Create a self-built app
3. Enable permissions: `im:message`, `im:chat`, `contact:user.base:readonly`
4. Get App ID and App Secret from Credentials page
5. Publish the app

## License

MIT
