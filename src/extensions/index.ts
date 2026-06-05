#!/usr/bin/env node

/**
 * Piclaw Extensions - Main Entry Point
 *
 * This file registers all custom extensions for Piclaw.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerBranchTool, registerSessionInfoTool, registerTestRunnerTool, registerGitTool, registerKicadSchTool, registerKicadPcbTool, registerCodeHealthTool, registerFormatTool, registerMetricsTool, registerSecurityAuditTool, registerExtensionTemplateGeneratorTool, registerWatchTool, registerCoverageTool } from "./tools/index.js";
import autoContinueExtension from "./hooks/auto-continue.js";

import piclawHeader from "./piclaw-header.js";
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
  registerBranchTool(api);
  registerSessionInfoTool(api);
  registerTestRunnerTool(api);
  registerGitTool(api);
  registerKicadSchTool(api);
  registerKicadPcbTool(api);
  registerCodeHealthTool(api);
  registerFormatTool(api);
  registerMetricsTool(api);
  registerSecurityAuditTool(api);
  registerExtensionTemplateGeneratorTool(api);
  registerWatchTool(api);
  registerCoverageTool(api);

  // ============================================
  // EXTENSIONS (Event Handlers, UI, etc.)
  // ============================================
  autoContinueExtension(api);
  registerTeamTool(api);
  piclawHeader(api);
}
