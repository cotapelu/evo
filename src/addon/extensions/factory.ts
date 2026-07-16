#!/usr/bin/env node

/**
 * Piclaw Extensions - Factory Module
 *
 * This module contains the main extension aggregator function
 * and configuration utilities for extension loading.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool } from "./tools/index.js";
// Tools moved to plugins: git, test, format, audit, build, metrics, secret-scanner, scripts
import { registerTeamTool } from "./team/index.js";
import { registerSubToolLoaderExtension } from "./tools/subtool-loader.js";
import { registerToolTemplate } from "./tools/tool-template.js";
import capabilitySystemExtension from "./capability-system/extension.js";
import { registerSkillReaderExtension } from "./tools/skill-reader.js";

import autoContinueExtension from "./hooks/auto-continue.js";
import autoCompact85Extension from "./hooks/auto-compact-85.js";
import contextLoggerExtension from "./context-logger.js";

// Import built-in tools override extension (disabled - overrides default built-in tools)
// import registerBuiltinsExtension from "./buildin-tools/index.js";
import multiAgentToolExtension from "./multi-agent-tool/index.js";
import sessionToolExtension from "./session-tool/index.js";
import promptHookExtension from "./prompt-hooks/index.js";
// skillsToolExtension removed - skill_reader extension handles skills

import piclawHeader from "./piclaw-header.js";
import { registerTodosRenderer } from "./renderers/todos-renderer.js";
import { registerTeamWidget } from "./team/team-widget.js";
import { registerMemoryRenderer } from "./renderers/memory-renderer.js";
import { registerBranchSummaryRenderer } from "./renderers/branch-summary-renderer.js";
import { registerTeamOpsRenderer } from "./renderers/team-ops-renderer.js";
import { registerProviderCommand } from "./commands/provider-command.js";
import { registerTeamCommand } from "./commands/team-command.js";
// Removed conflicting built-in command registrations:
// - registerSessionTreeCommand (conflicts with built-in /tree)
// - registerSettingsCommand (conflicts with built-in /settings)
// - registerCopyCommand (conflicts with built-in /copy)
import { registerKeybindingExtension } from "./keybinding/keybinding-extension.js";

/**
 * Main extension aggregator function
 *
 * Registers all custom extensions for Piclaw.
 * Called by the extension factory system.
 */
export default async function extensionsAggregator(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): Promise<any> {
  // ============================================================================
  // 1. CAPABILITY SYSTEM (Plugin Architecture)
  // ============================================================================
  // Loads plugins from ./plugins folder and registers capability router tool
  await capabilitySystemExtension(api);

  // Register providers
  registerKiloProvider(api);

  registerTodosTool(api);
  registerMemoryTool(api);
  registerTeamTool(api);
  registerToolTemplate(api);
  registerSkillReaderExtension(api);

  // // Register built-in tools override (same name, uses createXTool(ctx.cwd))
  // registerBuiltinsExtension(api);
  
  // Register multi-agent tool
  multiAgentToolExtension(api);
  
  // Register session tool
  sessionToolExtension(api);
  
  // Register prompt hooks extension
  promptHookExtension(api);
  
  // skills tool removed (use skill_reader extension)

  // Register action tool (removed)
  // registerActionTool(api);
  // Register sub-tool loader
  registerSubToolLoaderExtension(api);

  // Register custom message renderers
  registerTodosRenderer(api);
  registerMemoryRenderer(api);
  registerTeamWidget(api);
  registerBranchSummaryRenderer(api);
  registerTeamOpsRenderer(api);

  // Register commands (non-conflicting)
  registerProviderCommand(api);
  registerTeamCommand(api);
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

  // Master-tool extension removed (not efficient)

  // Return an empty object to satisfy extension discovery requirements
  return {};
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
