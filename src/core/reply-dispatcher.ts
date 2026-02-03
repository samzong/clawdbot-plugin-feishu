/**
 * Reply dispatcher for Feishu.
 * Creates a dispatcher that sends agent replies back to Feishu.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { ClawdbotConfig, RuntimeEnv, ReplyPayload, PluginRuntime } from "openclaw/plugin-sdk";
import {
  createReplyPrefixContext,
  createTypingCallbacks,
  logTypingFailure,
} from "openclaw/plugin-sdk";

import { getRuntime } from "./runtime.js";
import { sendTextMessage } from "../api/messages.js";
import { addReaction, removeReaction, Emoji } from "../api/reactions.js";
import type { Config } from "../config/schema.js";

// ============================================================================
// Types
// ============================================================================

export interface CreateReplyDispatcherParams {
  cfg: ClawdbotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  chatId: string;
  replyToMessageId?: string;
}

interface TypingIndicatorState {
  messageId: string;
  emoji: string;
}

// ============================================================================
// Reply Dispatcher
// ============================================================================

export function createReplyDispatcher(params: CreateReplyDispatcherParams) {
  const core = getRuntime() as PluginRuntime;
  const { cfg, agentId, chatId, replyToMessageId } = params;
  const feishuCfg = cfg.channels?.feishu as Config | undefined;

  const prefixContext = createReplyPrefixContext({
    cfg,
    agentId,
  });

  // Typing indicator using reactions
  let typingState: TypingIndicatorState | null = null;

  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      if (!replyToMessageId || !feishuCfg) return;
      try {
        const reactionId = await addReaction(feishuCfg, {
          messageId: replyToMessageId,
          emojiType: Emoji.TYPING,
        });
        typingState = { messageId: replyToMessageId, emoji: reactionId };
        params.runtime.log?.(`Added typing indicator reaction`);
      } catch (err) {
        params.runtime.log?.(`Failed to add typing reaction: ${String(err)}`);
      }
    },
    stop: async () => {
      if (!typingState || !feishuCfg) return;
      try {
        await removeReaction(feishuCfg, {
          messageId: typingState.messageId,
          reactionId: typingState.emoji,
        });
        typingState = null;
        params.runtime.log?.(`Removed typing indicator reaction`);
      } catch (err) {
        params.runtime.log?.(`Failed to remove typing reaction: ${String(err)}`);
      }
    },
    onStartError: (err) => {
      logTypingFailure({
        log: (message) => params.runtime.log?.(message),
        channel: "feishu",
        action: "start",
        error: err,
      });
    },
    onStopError: (err) => {
      logTypingFailure({
        log: (message) => params.runtime.log?.(message),
        channel: "feishu",
        action: "stop",
        error: err,
      });
    },
  });

  const textChunkLimit = core.channel.text.resolveTextChunkLimit({
    cfg,
    channel: "feishu",
    defaultLimit: 4000,
  });
  const chunkMode = core.channel.text.resolveChunkMode(cfg, "feishu");
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "feishu",
  });

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),
      onReplyStart: typingCallbacks.onReplyStart,
      deliver: async (payload: ReplyPayload) => {
        params.runtime.log?.(`Deliver called: text=${payload.text?.slice(0, 100)}`);
        const text = payload.text ?? "";
        if (!text.trim()) {
          params.runtime.log?.(`Deliver: empty text, skipping`);
          return;
        }

        const converted = core.channel.text.convertMarkdownTables(text, tableMode);
        const chunks = core.channel.text.chunkTextWithMode(converted, textChunkLimit, chunkMode);

        params.runtime.log?.(`Deliver: sending ${chunks.length} chunks to ${chatId}`);
        for (const chunk of chunks) {
          await sendTextMessage(feishuCfg!, {
            to: chatId,
            text: chunk,
            replyToMessageId,
          });
        }
      },
      onError: (err, info) => {
        params.runtime.error?.(`${info.kind} reply failed: ${String(err)}`);
        typingCallbacks.onIdle?.();
      },
      onIdle: typingCallbacks.onIdle,
    });

  return {
    dispatcher,
    replyOptions: {
      ...replyOptions,
      onModelSelected: prefixContext.onModelSelected,
    },
    markDispatchIdle,
  };
}
