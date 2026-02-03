/**
 * Message handler for Feishu events.
 * Integrates with Clawdbot runtime for routing and agent execution.
 */

import type { ClawdbotConfig, RuntimeEnv, HistoryEntry, PluginRuntime } from "openclaw/plugin-sdk";
import {
  buildPendingHistoryContextFromMap,
  recordPendingHistoryEntryIfEnabled,
  clearHistoryEntriesIfEnabled,
  DEFAULT_GROUP_HISTORY_LIMIT,
} from "openclaw/plugin-sdk";

import type { Config } from "../config/schema.js";
import type { MessageReceivedEvent } from "../types/index.js";
import { parseMessageEvent } from "./parser.js";
import { checkGroupPolicy, shouldRequireMention, matchAllowlist } from "./policy.js";
import { createReplyDispatcher } from "./reply-dispatcher.js";
import { getMessage } from "../api/messages.js";
import { getRuntime } from "./runtime.js";

// ============================================================================
// Types
// ============================================================================

export interface MessageHandlerParams {
  cfg: ClawdbotConfig;
  event: MessageReceivedEvent;
  botOpenId?: string;
  runtime?: RuntimeEnv;
  chatHistories?: Map<string, HistoryEntry[]>;
}

// ============================================================================
// Message Handler
// ============================================================================

export async function handleMessage(params: MessageHandlerParams): Promise<void> {
  const { cfg, event, botOpenId, runtime, chatHistories } = params;
  const feishuCfg = cfg.channels?.feishu as Config | undefined;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  // Early guard: require feishu config
  if (!feishuCfg) {
    log("Feishu config not found, skipping message");
    return;
  }

  // Parse the event
  const parsed = parseMessageEvent(event, botOpenId);
  const isGroup = parsed.chatType === "group";

  log(`Received message from ${parsed.senderOpenId} in ${parsed.chatId} (${parsed.chatType})`);

  const historyLimit = Math.max(
    0,
    feishuCfg.historyLimit ?? cfg.messages?.groupChat?.historyLimit ?? DEFAULT_GROUP_HISTORY_LIMIT
  );

  // Check policies
  if (isGroup) {
    const result = checkGroupPolicy(feishuCfg, parsed.chatId, parsed.senderOpenId);

    if (!result.allowed) {
      log(`Sender ${parsed.senderOpenId} not in group allowlist`);
      return;
    }

    const requireMention = shouldRequireMention(feishuCfg, parsed.chatType, parsed.chatId);

    if (requireMention && !parsed.mentionedBot) {
      log(`Message in group ${parsed.chatId} did not mention bot, recording to history`);
      if (chatHistories) {
        recordPendingHistoryEntryIfEnabled({
          historyMap: chatHistories,
          historyKey: parsed.chatId,
          limit: historyLimit,
          entry: {
            sender: parsed.senderOpenId,
            body: parsed.content,
            timestamp: Date.now(),
            messageId: parsed.messageId,
          },
        });
      }
      return;
    }
  } else {
    const dmPolicy = feishuCfg?.dmPolicy ?? "pairing";
    const allowFrom = feishuCfg?.allowFrom ?? [];

    if (dmPolicy === "allowlist") {
      const match = matchAllowlist(allowFrom as (string | number)[], parsed.senderOpenId);
      if (!match) {
        log(`Sender ${parsed.senderOpenId} not in DM allowlist`);
        return;
      }
    }
  }

  // Dispatch to agent
  try {
    const core = getRuntime() as PluginRuntime;

    const feishuFrom = isGroup ? `feishu:group:${parsed.chatId}` : `feishu:${parsed.senderOpenId}`;
    const feishuTo = isGroup ? `chat:${parsed.chatId}` : `user:${parsed.senderOpenId}`;

    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "feishu",
      peer: {
        kind: isGroup ? "group" : "dm",
        id: isGroup ? parsed.chatId : parsed.senderOpenId,
      },
    });

    const preview = parsed.content.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = isGroup
      ? `Feishu message in group ${parsed.chatId}`
      : `Feishu DM from ${parsed.senderOpenId}`;

    core.system.enqueueSystemEvent(`${inboundLabel}: ${preview}`, {
      sessionKey: route.sessionKey,
      contextKey: `feishu:message:${parsed.chatId}:${parsed.messageId}`,
    });

    // Fetch quoted message if replying
    let quotedContent: string | undefined;
    if (parsed.parentId) {
      try {
        const quotedMsg = await getMessage(feishuCfg, parsed.parentId);
        if (quotedMsg) {
          quotedContent = quotedMsg.content;
          log(`Fetched quoted message: ${quotedContent?.slice(0, 100)}`);
        }
      } catch (err) {
        log(`Failed to fetch quoted message: ${String(err)}`);
      }
    }

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);

    // Build message body
    let messageBody = parsed.content;
    if (quotedContent) {
      messageBody = `[Replying to: "${quotedContent}"]\n\n${parsed.content}`;
    }

    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Feishu",
      from: isGroup ? parsed.chatId : parsed.senderOpenId,
      timestamp: new Date(),
      envelope: envelopeOptions,
      body: messageBody,
    });

    let combinedBody = body;
    const historyKey = isGroup ? parsed.chatId : undefined;

    if (isGroup && historyKey && chatHistories) {
      combinedBody = buildPendingHistoryContextFromMap({
        historyMap: chatHistories,
        historyKey,
        limit: historyLimit,
        currentMessage: combinedBody,
        formatEntry: (entry: HistoryEntry) =>
          core.channel.reply.formatAgentEnvelope({
            channel: "Feishu",
            from: parsed.chatId,
            timestamp: entry.timestamp,
            body: `${entry.sender}: ${entry.body}`,
            envelope: envelopeOptions,
          }),
      });
    }

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: combinedBody,
      RawBody: parsed.content,
      CommandBody: parsed.content,
      From: feishuFrom,
      To: feishuTo,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: isGroup ? "group" : "direct",
      GroupSubject: isGroup ? parsed.chatId : undefined,
      SenderName: parsed.senderOpenId,
      SenderId: parsed.senderOpenId,
      Provider: "feishu" as const,
      Surface: "feishu" as const,
      MessageSid: parsed.messageId,
      Timestamp: Date.now(),
      WasMentioned: parsed.mentionedBot,
      CommandAuthorized: true,
      OriginatingChannel: "feishu" as const,
      OriginatingTo: feishuTo,
    });

    const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime as RuntimeEnv,
      chatId: parsed.chatId,
      replyToMessageId: parsed.messageId,
    });

    log(`Dispatching to agent (session=${route.sessionKey})`);

    const { queuedFinal, counts } = await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();

    if (isGroup && historyKey && chatHistories) {
      clearHistoryEntriesIfEnabled({
        historyMap: chatHistories,
        historyKey,
        limit: historyLimit,
      });
    }

    log(`Dispatch complete (queuedFinal=${queuedFinal}, replies=${counts.final})`);
  } catch (err) {
    error(`Failed to dispatch message: ${String(err)}`);
  }
}
