#!/usr/bin/env node

/**
 * Piclaw Extensions - Extension Function
 *
 * This function registers all custom extensions for Piclaw.
 * Exported as default extension function for factory creation.
 */

import { registerKiloProvider } from "./providers/kilo-provider.js";
import { registerTodosTool, registerMemoryTool, registerBranchTool, registerSessionInfoTool, registerTestRunnerTool, registerGitTool, registerKicadSchTool, registerKicadPcbTool, registerCodeHealthTool, registerFormatTool, registerMetricsTool, registerSecurityAuditTool, registerExtensionTemplateGeneratorTool, registerWatchTool, registerCoverageTool, registerCoverageHistoryTool, registerNotesTool, registerToolMetricsTool, registerPerformanceAdvisorTool, registerCoverageLeadersTool } from "./tools/index.js";
import metricsCollector from "./metrics-collector.js";
import autoContinueExtension from "./hooks/auto-continue.js";
import aboutCommand from "./about-command.js";
import cancelCommand from "./cancel-command.js";

import piclawHeader from "./piclaw-header.js";
import { registerTeamTool, registerTeamRunAutocomplete } from "./team/index.js";
import registerFileToolsExtension from "./file-tools-extension/index.js";
import autoCompact85 from "./hooks/auto-compact-85.js";
import advancedSessionExtension from "./advanced-session/index.js";
import globalAutocompleteExtension from "./global-autocomplete/index.js";
import registerCodingToolsExtension from "./coding-tools-extension/index.js";
import registerSdkMegaExtension from "./sdk-mega-extension/index.js";
import registerAuthModelExtension from "./auth-model-extension/index.js";
import registerPackageManagerExtension from "./package-manager-extension/index.js";

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
  registerCoverageLeadersTool(api);

  // ============================================
  // EXTENSIONS (Event Handlers, UI, etc.)
  // ============================================
  autoContinueExtension(api);
  autoCompact85(api);
  registerTeamTool(api);
  registerTeamRunAutocomplete(api);
  piclawHeader(api);
  aboutCommand(api);
  cancelCommand(api);

  // ============================================
  // ADVANCED SESSION (Full SDK Power)
  // ============================================
  advancedSessionExtension(api);

  // ============================================
  // GLOBAL AUTOCOMPLETE (UX Enhancement)
  // ============================================
  globalAutocompleteExtension(api);

  // ============================================
  // FILE TOOLS EXTENSION (Full SDK Factory Usage)
  // ============================================
  registerFileToolsExtension(api);

  // ============================================
  // CODING TOOLS EXTENSION (Full SDK Factory Usage)
  // ============================================
  registerCodingToolsExtension(api);

  // ============================================
  // SDK INTEGRATION EXTENSION (Advanced Features)
  // ============================================
  registerSdkMegaExtension(api);
  registerPackageManagerExtension(api);
  registerAuthModelExtension(api);
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
