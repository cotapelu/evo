#!/usr/bin/env node
/**
 * Evo Extensions - Extension Function
 *
 * This function registers all custom extensions for Evo.
 * Exported as default extension function for factory creation.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerKiloProvider } from './providers/kilo-provider.js';
import {
  registerTodosTool,
  registerMemoryTool,
  registerBranchTool,
  registerSessionInfoTool,
  registerTestRunnerTool,
  registerGitTool,
  registerKicadSchTool,
  registerKicadPcbTool,
  registerCodeHealthTool,
  registerFormatTool,
  registerMetricsTool,
  registerSecurityAuditTool,
  registerExtensionTemplateGeneratorTool,
  registerWatchTool,
  registerCoverageTool,
  registerCoverageHistoryTool,
  registerNotesTool,
  registerToolMetricsTool,
  registerPerformanceAdvisorTool,
  registerCoverageLeadersTool,
} from './tools/index.js';
import metricsCollector from './metrics-collector.js';
import autoContinueExtension from './hooks/auto-continue.js';
import aboutCommand from './about-command.js';
import cancelCommand from './cancel-command.js';

import evoHeader from './evo-header.js';
import { registerTeamTool, registerTeamRunAutocomplete } from './team/index.js';
import { registerTeamWidget } from './team/team-widget.js';

// Commands from extensions_qclaw
import {
  registerProviderCommand,
  registerCopyCommand,
  registerTeamCommand,
  registerMetricsCommand,
} from './commands/index.js';

// Renderers from extensions_qclaw
import {
  registerBranchSummaryRenderer,
  registerMemoryRenderer,
  registerTeamOpsRenderer,
  registerMetricsWidget,
} from './renderers/index.js';

// Keybinding extension from extensions_qclaw
// import registerKeybindingExtension from './keybinding/keybinding-extension.js'; // skipped - needs config-manager

// Additional tools from extensions_qclaw
import {
  registerUniversalTool,
  registerAuditTool,
  registerBuildTool,
  registerFormatterTool,
  registerScriptsTool,
  registerSecretScannerTool,
  registerTestTool,
  registerToolTemplate,
  registerSubToolLoaderExtension,
  registerSkillReaderExtension,
} from './tools/index.js';
import registerFileToolsExtension from './file-tools-extension/index.js';
import autoCompact85 from './hooks/auto-compact-85.js';
import advancedSessionExtension from './advanced-session/index.js';
import globalAutocompleteExtension from './global-autocomplete/index.js';
import registerCodingToolsExtension from './coding-tools-extension/index.js';
import registerSdkMegaExtension from './sdk-mega-extension/index.js';
import registerAuthModelExtension from './auth-model-extension/index.js';
import registerPackageManagerExtension from './package-manager-extension/index.js';
import registerSandboxExtension from './sandbox-extension/index.js';
import registerSessionUtilsExtension from './session-utils-extension/index.js';
import registerResourceLoaderExtension from './resource-loader-extension/index.js';
import registerOAuthProviderExtension from './oauth-provider-extension/index.js';
import registerPromptTemplatesExtension from './prompt-templates-extension/index.js';
import registerCircuitBreakerExtension from './circuit-breaker-extension/index.js';
import registerBenchmarkExtension from './benchmark-extension/index.js';

function withMutedSendMessage(
  fn: (api: ExtensionAPI) => void | Promise<void>,
): (api: ExtensionAPI) => void | Promise<void> {
  return (api: ExtensionAPI) => {
    const original = api.sendMessage;
    api.sendMessage = () => {};
    try {
      return fn(api);
    } finally {
      api.sendMessage = original;
    }
  };
}

export default function extensionsAggregator(api: ExtensionAPI) {
  const allExtensions = [
    // PROVIDERS
    withMutedSendMessage(registerKiloProvider),
    withMutedSendMessage(metricsCollector),

    // CUSTOM TOOLS
    withMutedSendMessage(registerTodosTool),
    withMutedSendMessage(registerMemoryTool),
    withMutedSendMessage(registerBranchTool),
    withMutedSendMessage(registerSessionInfoTool),
    withMutedSendMessage(registerTestRunnerTool),
    withMutedSendMessage(registerGitTool),
    withMutedSendMessage(registerKicadSchTool),
    withMutedSendMessage(registerKicadPcbTool),
    withMutedSendMessage(registerCodeHealthTool),
    withMutedSendMessage(registerFormatTool),
    withMutedSendMessage(registerMetricsTool),
    withMutedSendMessage(registerSecurityAuditTool),
    withMutedSendMessage(registerExtensionTemplateGeneratorTool),
    withMutedSendMessage(registerWatchTool),
    withMutedSendMessage(registerCoverageTool),
    withMutedSendMessage(registerCoverageHistoryTool),
    withMutedSendMessage(registerNotesTool),
    withMutedSendMessage(registerToolMetricsTool),
    withMutedSendMessage(registerPerformanceAdvisorTool),
    withMutedSendMessage(registerCoverageLeadersTool),

    // EXTENSIONS (Event Handlers, UI, etc.)
    withMutedSendMessage(autoContinueExtension),
    withMutedSendMessage(autoCompact85),
    withMutedSendMessage(registerTeamTool),
    withMutedSendMessage(registerTeamRunAutocomplete),
    withMutedSendMessage(registerTeamWidget),
    withMutedSendMessage(evoHeader),
    withMutedSendMessage(aboutCommand),
    withMutedSendMessage(cancelCommand),

    // COMMANDS from extensions_qclaw
    withMutedSendMessage(registerProviderCommand),
    withMutedSendMessage(registerCopyCommand),
    withMutedSendMessage(registerTeamCommand),
    withMutedSendMessage(registerMetricsCommand),

    // RENDERERS from extensions_qclaw
    withMutedSendMessage(registerBranchSummaryRenderer),
    withMutedSendMessage(registerMemoryRenderer),
    withMutedSendMessage(registerTeamOpsRenderer),
    withMutedSendMessage(registerMetricsWidget),

    // ADDITIONAL TOOLS from extensions_qclaw
    withMutedSendMessage(registerUniversalTool),
    withMutedSendMessage(registerAuditTool),
    withMutedSendMessage(registerBuildTool),
    withMutedSendMessage(registerFormatterTool),
    withMutedSendMessage(registerScriptsTool),
    withMutedSendMessage(registerSecretScannerTool),
    withMutedSendMessage(registerTestTool),
    withMutedSendMessage(registerToolTemplate),
    withMutedSendMessage(registerSubToolLoaderExtension),
    withMutedSendMessage(registerSkillReaderExtension),

    // ADVANCED SESSION (Full SDK Power)
    withMutedSendMessage(advancedSessionExtension),

    // GLOBAL AUTOCOMPLETE (UX Enhancement)
    withMutedSendMessage(globalAutocompleteExtension),

    // FILE TOOLS EXTENSION (Full SDK Factory Usage)
    withMutedSendMessage(registerFileToolsExtension),

    // CODING TOOLS EXTENSION (Full SDK Factory Usage)
    withMutedSendMessage(registerCodingToolsExtension),

    // SDK INTEGRATION EXTENSION (Advanced Features)
    withMutedSendMessage(registerSdkMegaExtension),
    withMutedSendMessage(registerSandboxExtension),
    withMutedSendMessage(registerPackageManagerExtension),
    withMutedSendMessage(registerAuthModelExtension),
    withMutedSendMessage(registerSessionUtilsExtension),
    withMutedSendMessage(registerResourceLoaderExtension),
    withMutedSendMessage(registerOAuthProviderExtension),
    withMutedSendMessage(registerPromptTemplatesExtension),
    withMutedSendMessage(registerCircuitBreakerExtension),
    withMutedSendMessage(registerBenchmarkExtension),
  ];

  for (const ext of allExtensions) {
    ext(api);
  }
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