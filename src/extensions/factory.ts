#!/usr/bin/env node

/**
 * Piclaw Extensions - Factory Module
 *
 * This module contains the main extension aggregator function
 * and configuration utilities for extension loading.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerUniversalTool } from "./tools/index.js";
// Tools moved to plugins: git, test, format, audit, build, metrics, secret-scanner, scripts
import { registerTeamTool } from "./team/index.js";
import { registerSubToolLoaderExtension } from "./tools/subtool-loader.js";
import { registerToolTemplate } from "./tools/tool-template.js";
import capabilitySystemExtension from "./capability-system/extension.js";
import { registerSkillReaderExtension } from "./tools/skill-reader.js";
import autoContinueExtension from "./hooks/auto-continue.js";
import autoCompact85Extension from "./hooks/auto-compact-85.js";
import contextLoggerExtension from "./context-logger.js";

import piclawHeader from "./piclaw-header.js";
import { registerTodosRenderer } from "./renderers/todos-renderer.js";
import { registerTeamWidget } from "./team/team-widget.js";
import { registerMetricsWidget } from "./metrics/metrics-widget.js";
import { registerMemoryRenderer } from "./renderers/memory-renderer.js";
import { registerBranchSummaryRenderer } from "./renderers/branch-summary-renderer.js";
import { registerTeamOpsRenderer } from "./renderers/team-ops-renderer.js";
import { registerSessionTreeCommand } from "./commands/session-tree-command.js";
import { registerSettingsCommand } from "./commands/settings-command.js";
import { registerProviderCommand } from "./commands/provider-command.js";
import { registerCopyCommand } from "./commands/copy-command.js";
import { registerTeamCommand } from "./commands/team-command.js";
import { registerMetricsCommand } from "./commands/metrics-command.js";
import { registerKeybindingExtension } from "./keybinding/keybinding-extension.js";

/**
 * Main extension aggregator function
 *
 * Registers all custom extensions for Piclaw.
 * Called by the extension factory system.
 */
export default function extensionsAggregator(api: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  // ============================================================================
  // 1. CAPABILITY SYSTEM (Plugin Architecture)
  // ============================================================================
  // Loads plugins from ./plugins folder and registers capability router tool
  capabilitySystemExtension(api);

  // Register providers
  registerKiloProvider(api);

  // Register custom tools
  registerTodosTool(api);
  registerMemoryTool(api);
  registerTeamTool(api);
  registerToolTemplate(api);
  registerSkillReaderExtension(api);

  // Register universal tool
  registerUniversalTool(api);
  // Register sub-tool loader
  registerSubToolLoaderExtension(api);

  // Register custom message renderers
  registerTodosRenderer(api);
  registerMemoryRenderer(api);
  registerTeamWidget(api);
  registerBranchSummaryRenderer(api);
  registerTeamOpsRenderer(api);
  registerMetricsWidget(api);

  // Register commands
  registerSessionTreeCommand(api);
  registerSettingsCommand(api);
  registerProviderCommand(api);
  registerCopyCommand(api);
  registerTeamCommand(api);
  registerMetricsCommand(api);
  // Register keybinding extension
  registerKeybindingExtension(api);

  // Register Auto Continue Extension
  autoContinueExtension(api);

  // Register Auto Compact at 75% Extension
  autoCompact85Extension(api);

  // Register Piclaw Header
  piclawHeader(api);

  // Register Context Logger Extension
  contextLoggerExtension(api);
}

/**
 * Returns array of extension factory functions
 * Used by the extension loader system
 */
export function getExtensionFactories() {
  return [extensionsAggregator];
}

// Re-export aggregator with clear name
export { extensionsAggregator };

// Type-only export for consistency
export type { extensionsAggregator as ExtensionsAggregator };
