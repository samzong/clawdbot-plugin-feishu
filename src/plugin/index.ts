/**
 * Clawdbot plugin entry point.
 */

import type { ClawdbotPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { feishuChannel } from "./channel.js";
import { initializeRuntime } from "../core/runtime.js";

// Re-export runtime management from core
export { initializeRuntime, getRuntime } from "../core/runtime.js";

const plugin = {
  id: "feishu",
  name: "Feishu",
  description: "Feishu/Lark channel plugin for Clawdbot",
  configSchema: emptyPluginConfigSchema(),

  register(api: ClawdbotPluginApi) {
    initializeRuntime(api.runtime);
    api.registerChannel({ plugin: feishuChannel });
  },
};

export default plugin;

// Re-export channel for direct access
export { feishuChannel } from "./channel.js";
