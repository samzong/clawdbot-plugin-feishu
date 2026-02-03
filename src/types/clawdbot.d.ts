/**
 * Type declarations for openclaw/plugin-sdk.
 * This stub allows strict TypeScript compilation against the peer dependency.
 */

declare module "openclaw/plugin-sdk" {
  export const DEFAULT_ACCOUNT_ID: string;
  export const PAIRING_APPROVED_MESSAGE: string;
  export const DEFAULT_GROUP_HISTORY_LIMIT: number;

  export function emptyPluginConfigSchema(): unknown;
  export function addWildcardAllowFrom(allowFrom?: (string | number)[]): (string | number)[];
  export function formatDocsLink(path: string, label: string): string;

  // History management
  export interface HistoryEntry {
    sender: string;
    body: string;
    timestamp: number;
    messageId?: string;
  }

  export function buildPendingHistoryContextFromMap(params: {
    historyMap: Map<string, HistoryEntry[]>;
    historyKey: string;
    limit: number;
    currentMessage: string;
    formatEntry: (entry: HistoryEntry) => string;
  }): string;

  export function recordPendingHistoryEntryIfEnabled(params: {
    historyMap: Map<string, HistoryEntry[]>;
    historyKey: string;
    limit: number;
    entry: HistoryEntry;
  }): void;

  export function clearHistoryEntriesIfEnabled(params: {
    historyMap: Map<string, HistoryEntry[]>;
    historyKey: string;
    limit: number;
  }): void;

  // Reply dispatcher
  export interface ReplyPayload {
    text?: string;
    [key: string]: unknown;
  }

  export interface ReplyPrefixContext {
    responsePrefix: string;
    responsePrefixContextProvider: () => unknown;
    onModelSelected: (model: string) => void;
  }

  export function createReplyPrefixContext(params: {
    cfg: ClawdbotConfig;
    agentId: string;
  }): ReplyPrefixContext;

  export interface TypingCallbacks {
    onReplyStart: () => Promise<void>;
    onIdle?: () => void;
  }

  export function createTypingCallbacks(params: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    onStartError?: (err: unknown) => void;
    onStopError?: (err: unknown) => void;
  }): TypingCallbacks;

  export function logTypingFailure(params: {
    log: (message: string) => void;
    channel: string;
    action: string;
    error: unknown;
  }): void;

  // Runtime types
  export type DmPolicy = "open" | "pairing" | "allowlist";

  export interface RuntimeEnv {
    log?: (message: string) => void;
    error?: (message: string) => void;
    [key: string]: unknown;
  }

  export interface PluginRuntime {
    channel: {
      routing: {
        resolveAgentRoute(params: {
          cfg: ClawdbotConfig;
          channel: string;
          peer: { kind: string; id: string };
        }): { sessionKey: string; accountId: string; agentId: string };
      };
      reply: {
        resolveEnvelopeFormatOptions(cfg: ClawdbotConfig): unknown;
        formatAgentEnvelope(params: {
          channel: string;
          from: string;
          timestamp: Date | number;
          envelope: unknown;
          body: string;
        }): string;
        finalizeInboundContext(params: Record<string, unknown>): unknown;
        createReplyDispatcherWithTyping(params: {
          responsePrefix: string;
          responsePrefixContextProvider: () => unknown;
          humanDelay: unknown;
          onReplyStart: () => Promise<void>;
          deliver: (payload: ReplyPayload) => Promise<void>;
          onError: (err: unknown, info: { kind: string }) => void;
          onIdle?: () => void;
        }): {
          dispatcher: unknown;
          replyOptions: Record<string, unknown>;
          markDispatchIdle: () => void;
        };
        dispatchReplyFromConfig(params: {
          ctx: unknown;
          cfg: ClawdbotConfig;
          dispatcher: unknown;
          replyOptions: unknown;
        }): Promise<{ queuedFinal: boolean; counts: { final: number } }>;
        resolveHumanDelayConfig(cfg: ClawdbotConfig, agentId: string): unknown;
      };
      text: {
        resolveTextChunkLimit(params: {
          cfg: ClawdbotConfig;
          channel: string;
          defaultLimit: number;
        }): number;
        resolveChunkMode(cfg: ClawdbotConfig, channel: string): string;
        resolveMarkdownTableMode(params: { cfg: ClawdbotConfig; channel: string }): string;
        convertMarkdownTables(text: string, mode: string): string;
        chunkTextWithMode(text: string, limit: number, mode: string): string[];
      };
    };
    system: {
      enqueueSystemEvent(
        message: string,
        params: {
          sessionKey: string;
          contextKey: string;
        }
      ): void;
    };
    [key: string]: unknown;
  }

  export interface ClawdbotConfig {
    channels?: {
      feishu?: Record<string, unknown>;
      [key: string]: unknown;
    };
    messages?: {
      groupChat?: {
        historyLimit?: number;
      };
    };
    [key: string]: unknown;
  }

  export interface ClawdbotPluginApi {
    runtime: PluginRuntime;
    registerChannel(params: { plugin: ChannelPlugin<unknown> }): void;
  }

  export interface ChannelGroupContext {
    cfg: ClawdbotConfig;
    groupId?: string | null;
    [key: string]: unknown;
  }

  export interface GroupToolPolicyConfig {
    allow?: string[];
    deny?: string[];
  }

  export interface WizardPrompter {
    note(message: string, title?: string): Promise<void>;
    text(params: {
      message: string;
      placeholder?: string;
      initialValue?: string;
      validate?: (value: string | undefined) => string | undefined;
    }): Promise<string | symbol>;
    confirm(params: { message: string; initialValue?: boolean }): Promise<boolean>;
    select<T>(params: {
      message: string;
      options: { value: T; label: string }[];
      initialValue?: T;
    }): Promise<T | symbol>;
  }

  export interface ChannelOnboardingDmPolicy {
    label: string;
    channel: string;
    policyKey: string;
    allowFromKey: string;
    getCurrent(cfg: ClawdbotConfig): DmPolicy;
    setPolicy(cfg: ClawdbotConfig, policy: DmPolicy): ClawdbotConfig;
    promptAllowFrom(params: {
      cfg: ClawdbotConfig;
      prompter: WizardPrompter;
    }): Promise<ClawdbotConfig>;
  }

  export interface ChannelOnboardingAdapter {
    channel: string;
    getStatus(params: { cfg: ClawdbotConfig }): Promise<{
      channel: string;
      configured: boolean;
      statusLines: string[];
      selectionHint?: string;
      quickstartScore?: number;
    }>;
    configure(params: {
      cfg: ClawdbotConfig;
      prompter: WizardPrompter;
    }): Promise<{ cfg: ClawdbotConfig; accountId: string }>;
    dmPolicy: ChannelOnboardingDmPolicy;
    disable(cfg: ClawdbotConfig): ClawdbotConfig;
  }

  export interface ChannelPluginCapabilities {
    chatTypes: string[];
    polls: boolean;
    threads: boolean;
    media: boolean;
    reactions: boolean;
    edit: boolean;
    reply: boolean;
  }

  export interface ChannelPluginOutbound {
    deliveryMode: string;
    chunkerMode: string;
    textChunkLimit: number;
    chunker(text: string, limit: number): string[];
    sendText(params: {
      cfg: ClawdbotConfig;
      to: string;
      text: string;
    }): Promise<{ channel: string; messageId: string; chatId: string }>;
    sendMedia(params: {
      cfg: ClawdbotConfig;
      to: string;
      text?: string;
      mediaUrl?: string;
    }): Promise<{ channel: string; messageId: string; chatId: string }>;
  }

  export interface ChannelPluginStatus {
    defaultRuntime: {
      accountId: string;
      running: boolean;
      lastStartAt: null;
      lastStopAt: null;
      lastError: null;
      port: null;
    };
    buildChannelSummary(params: { snapshot: Record<string, unknown> }): Record<string, unknown>;
    probeAccount(params: { cfg: ClawdbotConfig }): Promise<{
      ok: boolean;
      error?: string;
      appId?: string;
      botName?: string;
      botOpenId?: string;
    }>;
    buildAccountSnapshot(params: {
      account: { accountId: string; enabled: boolean; configured: boolean };
      runtime?: Record<string, unknown>;
      probe?: Record<string, unknown>;
    }): Record<string, unknown>;
  }

  export interface ChannelPluginGateway {
    startAccount(ctx: {
      cfg: ClawdbotConfig;
      accountId: string;
      runtime?: RuntimeEnv;
      abortSignal?: AbortSignal;
      setStatus(status: Record<string, unknown>): void;
      log?: { info(msg: string): void; error(msg: string): void };
    }): Promise<void>;
  }

  export interface ChannelPlugin<TAccount> {
    id: string;
    meta: {
      id: string;
      label: string;
      selectionLabel: string;
      docsPath: string;
      docsLabel: string;
      blurb: string;
      aliases: string[];
      order: number;
    };
    pairing?: {
      idLabel: string;
      normalizeAllowEntry(entry: string): string;
      notifyApproval(params: { cfg: ClawdbotConfig; id: string }): Promise<void>;
    };
    capabilities: ChannelPluginCapabilities;
    agentPrompt?: {
      messageToolHints(): string[];
    };
    groups?: {
      resolveToolPolicy(params: ChannelGroupContext): GroupToolPolicyConfig | undefined;
    };
    reload?: { configPrefixes: string[] };
    threading?: {
      resolveReplyToMode?(params: { cfg: ClawdbotConfig; accountId?: string | null; chatType?: string | null }): "off" | "first" | "all";
    };
    configSchema?: { schema: Record<string, unknown> };
    config: {
      listAccountIds(): string[];
      resolveAccount(cfg: ClawdbotConfig): TAccount;
      defaultAccountId(): string;
      setAccountEnabled(params: { cfg: ClawdbotConfig; enabled: boolean }): ClawdbotConfig;
      deleteAccount(params: { cfg: ClawdbotConfig }): ClawdbotConfig;
      isConfigured(account: TAccount, cfg: ClawdbotConfig): boolean;
      describeAccount(account: TAccount): {
        accountId: string;
        enabled: boolean;
        configured: boolean;
      };
      resolveAllowFrom(params: { cfg: ClawdbotConfig }): (string | number)[];
      formatAllowFrom(params: { allowFrom: (string | number)[] }): string[];
    };
    security?: {
      collectWarnings(params: { cfg: ClawdbotConfig }): string[];
    };
    setup?: {
      resolveAccountId(): string;
      applyAccountConfig(params: { cfg: ClawdbotConfig }): ClawdbotConfig;
    };
    onboarding: ChannelOnboardingAdapter;
    messaging: {
      normalizeTarget(target: string): string | null;
      targetResolver: {
        looksLikeId(id: string): boolean;
        hint: string;
      };
    };
    directory: {
      self(): Promise<null>;
      listPeers(params: {
        cfg: ClawdbotConfig;
        query?: string;
        limit?: number;
      }): Promise<{ kind: "user"; id: string; name?: string }[]>;
      listGroups(params: {
        cfg: ClawdbotConfig;
        query?: string;
        limit?: number;
      }): Promise<{ kind: "group"; id: string; name?: string }[]>;
      listPeersLive(params: {
        cfg: ClawdbotConfig;
        query?: string;
        limit?: number;
      }): Promise<{ kind: "user"; id: string; name?: string }[]>;
      listGroupsLive(params: {
        cfg: ClawdbotConfig;
        query?: string;
        limit?: number;
      }): Promise<{ kind: "group"; id: string; name?: string }[]>;
    };
    outbound: ChannelPluginOutbound;
    status: ChannelPluginStatus;
    gateway: ChannelPluginGateway;
  }
}
