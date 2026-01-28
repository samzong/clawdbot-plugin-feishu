/**
 * WebSocket gateway for real-time Feishu events.
 */

import type * as Lark from "@larksuiteoapi/node-sdk";
import type { ClawdbotConfig, RuntimeEnv, HistoryEntry } from "clawdbot/plugin-sdk";
import type { Config } from "../config/schema.js";
import type { MessageReceivedEvent, BotAddedEvent, BotRemovedEvent } from "../types/index.js";
import { createWsClient, createEventDispatcher, probeConnection } from "../api/client.js";
import { handleMessage } from "./handler.js";

// ============================================================================
// Types
// ============================================================================

export interface GatewayOptions {
  cfg: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
}

export interface GatewayState {
  botOpenId: string | undefined;
  wsClient: Lark.WSClient | null;
  chatHistories: Map<string, HistoryEntry[]>;
}

// ============================================================================
// Gateway State
// ============================================================================

const state: GatewayState = {
  botOpenId: undefined,
  wsClient: null,
  chatHistories: new Map(),
};

/**
 * Get the current bot's open_id.
 */
export function getBotOpenId(): string | undefined {
  return state.botOpenId;
}

// ============================================================================
// Gateway Lifecycle
// ============================================================================

/**
 * Start the WebSocket gateway.
 * Connects to Feishu and begins processing events.
 */
export async function startGateway(options: GatewayOptions): Promise<void> {
  const { cfg, runtime, abortSignal } = options;
  const feishuCfg = cfg.channels?.feishu as Config | undefined;
  const log = (msg: string) => runtime?.log?.(msg);
  const error = (msg: string) => runtime?.error?.(msg);

  if (!feishuCfg) {
    throw new Error("Feishu not configured");
  }

  // Probe to get bot info
  const probeResult = await probeConnection(feishuCfg);
  if (probeResult.ok) {
    state.botOpenId = probeResult.botOpenId;
    log(`Gateway: bot open_id resolved: ${state.botOpenId ?? "unknown"}`);
  }

  const connectionMode = feishuCfg.connectionMode ?? "websocket";
  if (connectionMode !== "websocket") {
    log("Gateway: webhook mode not implemented, use HTTP server");
    return;
  }

  log("Gateway: starting WebSocket connection...");

  const wsClient = createWsClient(feishuCfg);
  state.wsClient = wsClient;

  const eventDispatcher = createEventDispatcher(feishuCfg);

  // Register event handlers
  eventDispatcher.register({
    "im.message.receive_v1": async (data: unknown) => {
      try {
        const event = data as MessageReceivedEvent;
        await handleMessage({
          cfg,
          event,
          botOpenId: state.botOpenId,
          runtime,
          chatHistories: state.chatHistories,
        });
      } catch (err) {
        error(`Gateway: error handling message: ${String(err)}`);
      }
    },

    "im.message.message_read_v1": async () => {
      // Ignore read receipts
    },

    "im.chat.member.bot.added_v1": async (data: unknown) => {
      try {
        const event = data as BotAddedEvent;
        log(`Gateway: bot added to chat ${event.chat_id}`);
      } catch (err) {
        error(`Gateway: error handling bot added: ${String(err)}`);
      }
    },

    "im.chat.member.bot.deleted_v1": async (data: unknown) => {
      try {
        const event = data as BotRemovedEvent;
        log(`Gateway: bot removed from chat ${event.chat_id}`);
      } catch (err) {
        error(`Gateway: error handling bot removed: ${String(err)}`);
      }
    },
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (state.wsClient === wsClient) {
        state.wsClient = null;
      }
    };

    const handleAbort = () => {
      log("Gateway: abort signal received, stopping...");
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    try {
      wsClient.start({ eventDispatcher });
      log("Gateway: WebSocket client started");
    } catch (err) {
      cleanup();
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    }
  });
}

/**
 * Stop the WebSocket gateway.
 */
export function stopGateway(): void {
  state.wsClient = null;
  state.botOpenId = undefined;
  state.chatHistories.clear();
}
