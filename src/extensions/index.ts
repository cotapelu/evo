#!/usr/bin/env node

/**
 * Piclaw Extensions - Main Entry Point
 *
 * This file registers all custom extensions for Piclaw.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerKicadSchTool, registerKicadPcbTool } from "./tools/index.js";
import autoContinueExtension from "./hooks/auto-continue.js";

import piclawHeader from "./piclaw-header.js";
import gitIntegrationExtension from "./git-integration.js";
import { registerTeamTool } from "./team/index.js";

export default function (api: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  // ============================================
  // PROVIDERS
  // ============================================
  registerKiloProvider(api);

  // ============================================
  // CUSTOM TOOLS
  // ============================================
  registerTodosTool(api);
  registerMemoryTool(api);
  registerKicadSchTool(api);
  registerKicadPcbTool(api);

  // ============================================
  // EXTENSIONS (Event Handlers, UI, etc.)
  // ============================================
  autoContinueExtension(api);
  gitIntegrationExtension(api);
  registerTeamTool(api);
  piclawHeader(api);
}
