/**
 * Clawdbot channel plugin implementation.
 */

import type {
  ChannelPlugin,
  ClawdbotConfig,
  ChannelGroupContext,
  GroupToolPolicyConfig,
} from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, PAIRING_APPROVED_MESSAGE } from "clawdbot/plugin-sdk";

import type { Config } from "../config/schema.js";
import { resolveCredentials } from "../config/schema.js";
import { probeConnection } from "../api/client.js";
import { sendTextMessage, normalizeTarget, isValidId } from "../api/messages.js";
import { sendMedia } from "../api/media.js";
import { listUsers, listGroups } from "../api/directory.js";
import { resolveGroupToolPolicy } from "../core/policy.js";
import { feishuOnboarding } from "./onboarding.js";

// ============================================================================
// Types
// ============================================================================

export interface ResolvedAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  appId?: string;
  domain: "feishu" | "lark";
}

// ============================================================================
// Account Resolution
// ============================================================================

function resolveAccount(cfg: ClawdbotConfig): ResolvedAccount {
  const feishuCfg = cfg.channels?.feishu as Config | undefined;
  const credentials = resolveCredentials(feishuCfg);

  return {
    accountId: DEFAULT_ACCOUNT_ID,
    enabled: feishuCfg?.enabled ?? false,
    configured: credentials !== null,
    appId: credentials?.appId,
    domain: feishuCfg?.domain ?? "feishu",
  };
}

// ============================================================================
// Channel Metadata
// ============================================================================

const meta = {
  id: "feishu",
  label: "Feishu",
  selectionLabel: "Feishu",
  docsPath: "/channels/feishu",
  docsLabel: "feishu",
  blurb: "Feishu enterprise messaging.",
  aliases: ["lark"] as string[],
  order: 70,
};

// ============================================================================
// Channel Plugin
// ============================================================================

export const feishuChannel: ChannelPlugin<ResolvedAccount> = {
  id: "feishu",
  meta: { ...meta },

  // Pairing configuration
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(feishu|user|open_id):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) return;
      await sendTextMessage(feishuCfg, {
        to: id,
        text: PAIRING_APPROVED_MESSAGE,
      });
    },
  },

  // Capabilities declaration
  capabilities: {
    chatTypes: ["direct", "channel"],
    polls: false,
    threads: true,
    media: true,
    reactions: true,
    edit: true,
    reply: true,
  },

  // Agent prompt hints
  agentPrompt: {
    messageToolHints: () => [
      "- Feishu targeting: omit `target` to reply to current conversation. Explicit: `user:open_id` or `chat:chat_id`.",
      "- Feishu supports interactive cards for rich messages.",
    ],
  },

  // Group tool policy resolution
  groups: {
    resolveToolPolicy: (params: ChannelGroupContext): GroupToolPolicyConfig | undefined => {
      const cfg = params.cfg.channels?.feishu as Config | undefined;
      if (!cfg) return undefined;
      return resolveGroupToolPolicy(cfg, params.groupId);
    },
  },

  // Config reload triggers
  reload: { configPrefixes: ["channels.feishu"] },

  // JSON Schema for config validation
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        appId: { type: "string" },
        appSecret: { type: "string" },
        encryptKey: { type: "string" },
        verificationToken: { type: "string" },
        domain: { type: "string", enum: ["feishu", "lark"] },
        connectionMode: { type: "string", enum: ["websocket", "webhook"] },
        webhookPath: { type: "string" },
        webhookPort: { type: "integer", minimum: 1 },
        dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist"] },
        allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
        groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
        groupAllowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        requireMention: { type: "boolean" },
        historyLimit: { type: "integer", minimum: 0 },
        dmHistoryLimit: { type: "integer", minimum: 0 },
        textChunkLimit: { type: "integer", minimum: 1 },
        chunkMode: { type: "string", enum: ["length", "newline"] },
        mediaMaxMb: { type: "number", minimum: 0 },
      },
    },
  },

  // Account management
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg) => resolveAccount(cfg),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,

    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: { ...cfg.channels?.feishu, enabled },
      },
    }),

    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete (nextChannels as Record<string, unknown>).feishu;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },

    isConfigured: (_account, cfg) =>
      Boolean(resolveCredentials(cfg.channels?.feishu as Config | undefined)),

    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),

    resolveAllowFrom: ({ cfg }) => (cfg.channels?.feishu as Config | undefined)?.allowFrom ?? [],

    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },

  // Security warnings
  security: {
    collectWarnings: ({ cfg }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      const groupPolicy = feishuCfg?.groupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        `- Feishu groups: groupPolicy="open" allows any member to trigger. Set groupPolicy="allowlist" to restrict.`,
      ];
    },
  },

  // Setup helpers
  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: { ...cfg.channels?.feishu, enabled: true },
      },
    }),
  },

  // Onboarding wizard
  onboarding: feishuOnboarding,

  // Message targeting
  messaging: {
    normalizeTarget: normalizeTarget,
    targetResolver: {
      looksLikeId: isValidId,
      hint: "<chatId|user:openId|chat:chatId>",
    },
  },

  // Directory operations
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) return [];
      return listUsers(feishuCfg, { query, limit });
    },
    listGroups: async ({ cfg, query, limit }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) return [];
      return listGroups(feishuCfg, { query, limit });
    },
    listPeersLive: async ({ cfg, query, limit }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) return [];
      return listUsers(feishuCfg, { query, limit });
    },
    listGroupsLive: async ({ cfg, query, limit }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) return [];
      return listGroups(feishuCfg, { query, limit });
    },
  },

  // Outbound message adapter
  outbound: {
    deliveryMode: "direct",
    chunkerMode: "markdown",
    textChunkLimit: 4000,

    chunker: (text, limit) => {
      if (text.length <= limit) return [text];
      const chunks: string[] = [];
      let remaining = text;
      while (remaining.length > limit) {
        let breakPoint = remaining.lastIndexOf("\n\n", limit);
        if (breakPoint === -1) breakPoint = remaining.lastIndexOf("\n", limit);
        if (breakPoint === -1) breakPoint = limit;
        chunks.push(remaining.slice(0, breakPoint).trim());
        remaining = remaining.slice(breakPoint).trim();
      }
      if (remaining) chunks.push(remaining);
      return chunks;
    },

    sendText: async ({ cfg, to, text }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) throw new Error("Feishu not configured");
      const result = await sendTextMessage(feishuCfg, { to, text });
      return { channel: "feishu", ...result };
    },

    sendMedia: async ({ cfg, to, text, mediaUrl }) => {
      const feishuCfg = cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) throw new Error("Feishu not configured");

      // Send text first if provided
      if (text?.trim()) {
        await sendTextMessage(feishuCfg, { to, text });
      }

      // Send media if URL provided
      if (mediaUrl) {
        try {
          const result = await sendMedia(feishuCfg, { to, mediaUrl });
          return { channel: "feishu", ...result };
        } catch {
          // Fallback to URL link
          const fallback = `📎 ${mediaUrl}`;
          const result = await sendTextMessage(feishuCfg, { to, text: fallback });
          return { channel: "feishu", ...result };
        }
      }

      const result = await sendTextMessage(feishuCfg, { to, text: text ?? "" });
      return { channel: "feishu", ...result };
    },
  },

  // Status and probing
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },

    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      port: snapshot.port ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),

    probeAccount: async ({ cfg }) =>
      await probeConnection(cfg.channels?.feishu as Config | undefined),

    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      port: runtime?.port ?? null,
      probe,
    }),
  },

  // Gateway lifecycle
  gateway: {
    startAccount: async (ctx) => {
      const { startGateway } = await import("../core/gateway.js");
      const feishuCfg = ctx.cfg.channels?.feishu as Config | undefined;
      if (!feishuCfg) throw new Error("Feishu not configured");

      const port = feishuCfg.webhookPort ?? null;
      ctx.setStatus({ accountId: ctx.accountId, port });
      ctx.log?.info(`Starting Feishu provider (mode: ${feishuCfg.connectionMode ?? "websocket"})`);

      return startGateway({
        cfg: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
  },
};
