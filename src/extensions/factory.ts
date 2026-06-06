#!/usr/bin/env node

/**
 * Piclaw Extensions - Extension Function
 *
 * This function registers all custom extensions for Piclaw.
 * Exported as default extension function for factory creation.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerBranchTool, registerSessionInfoTool, registerTestRunnerTool, registerGitTool, registerKicadSchTool, registerKicadPcbTool, registerCodeHealthTool, registerFormatTool, registerMetricsTool, registerSecurityAuditTool, registerExtensionTemplateGeneratorTool, registerWatchTool, registerCoverageTool, registerCoverageHistoryTool, registerNotesTool, registerToolMetricsTool, registerPerformanceAdvisorTool } from "./tools/index.js";
import metricsCollector from "./metrics-collector.js";
import autoContinueExtension from "./hooks/auto-continue.js";
import aboutCommand from "./about-command.js";
import cancelCommand from "./cancel-command.js";

import piclawHeader from "./piclaw-header.js";
import { registerTeamTool } from "./team/index.js";

export default function extensionsAggregator(api: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  // ============================================
  // PROVIDERS
  // ============================================
  registerKiloProvider(api);
  metricsCollector(api);

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
  registerCoverageHistoryTool(api);
  registerNotesTool(api);
  registerToolMetricsTool(api);
  registerPerformanceAdvisorTool(api);

  // ============================================
  // EXTENSIONS (Event Handlers, UI, etc.)
  // ============================================
  autoContinueExtension(api);
  registerTeamTool(api);
  piclawHeader(api);
  aboutCommand(api);
  cancelCommand(api);
}

/**
 * Extension Configuration
 */
export function getExtensionFactories() {
  return [extensionsAggregator];
}

export function getResourceLoaderOptions() {
  return {
    extensionFactories: getExtensionFactories(),
  };
}

// Re-export với tên rõ ràng
export { extensionsAggregator };

// Type-only export cho consistency
type ExtensionsAggregator = typeof extensionsAggregator;
export type { ExtensionsAggregator };
