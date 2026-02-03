/**
 * Runtime management for Feishu plugin.
 * Separated to avoid circular dependencies between plugin and core modules.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";

let feishuRuntime: PluginRuntime | null = null;

/**
 * Initialize the runtime for Feishu operations.
 * Called during plugin registration.
 */
export function initializeRuntime(runtime: PluginRuntime): void {
  feishuRuntime = runtime;
}

/**
 * Get the current runtime.
 * @throws Error if runtime not initialized
 */
export function getRuntime(): PluginRuntime {
  if (!feishuRuntime) {
    throw new Error("Feishu runtime not initialized");
  }
  return feishuRuntime;
}
