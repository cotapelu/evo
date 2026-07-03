import crypto from 'node:crypto';
import os from 'node:os';
import {
  createAgentSessionServices,
  createAgentSessionRuntime,
  createAgentSessionFromServices,
  InteractiveMode,
  SessionManager,
  type AgentSessionServices,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
} from './buildin/deps.js';
import type { ToolDefinition } from './buildin/deps.js';
import { createServicesOptions, registerAllBuildinAndCustomTools } from './buildin/index.js';
import { runWithCorrelationId } from './buildin/utils/async-context.js';
import { metrics, METRIC_NAMES } from './buildin/utils/metrics.js';
import { createToolDefinitionFromAgentTool } from './buildin/tools/tool-definition-wrapper.js';
import type { AgentTool } from './buildin/deps.js';

async function main(args: string[] = []): Promise<void> {
  void args;
  const cwd = process.cwd();
  const agentDir = process.env.PI_CONFIG_DIR ?? `${os.homedir()}/.pi/agent`;

  const correlationId = crypto.randomUUID();
  const startTime = performance.now();
  metrics.incrementCounter(METRIC_NAMES.CORRELATION_ID_GENERATED);
  metrics.incrementCounter(METRIC_NAMES.SESSION_START);
  metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 1);
  try {
    await runWithCorrelationId(correlationId, async () => {
      const { allExtensionFactories, allCustomTools } = await loadAllExtensionsAndTools(cwd);

      const servicesOptions = createServicesOptions(cwd, agentDir, {
        resourceLoaderOverrides: {
          extensionFactories: allExtensionFactories,
          customToolDefinitions: allCustomTools,
        },
      });
      const services = await createAgentSessionServices(servicesOptions);
      const sessionManager = SessionManager.create(cwd);
      const runtime = await createAgentSessionRuntime(createRuntimeFactory(services, allCustomTools), {
        cwd,
        agentDir,
        sessionManager,
      });
      await new InteractiveMode(runtime, { verbose: true }).run();
    });
  } catch (error) {
    metrics.incrementCounter(METRIC_NAMES.SESSION_ERROR);
    throw error;
  } finally {
    metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 0);
    metrics.observeHistogram(METRIC_NAMES.SESSION_DURATION_MS, performance.now() - startTime);
  }
}

export { main };

export function handleMainError(error: unknown): never {
  console.error('Failed to start procman:', error);
  process.exit(1);
}

async function loadAllExtensionsAndTools(cwd: string): Promise<{
  allExtensionFactories: unknown[];
  allCustomTools: ToolDefinition[];
}> {
  const { getExtensionFactories } = await import('./plugin/index.js');
  const registerAllAddonModule = await import('./addon/index.js');
  const registerAllAddon = registerAllAddonModule.default;
  const { registerAllBuiltin } = await import('./buildin/index.js');

  const pluginFactories = getExtensionFactories();
  const { extensions: addonExtensions, tools: addonTools } = registerAllAddon(cwd);
  const { extensions: builtinExtensions, tools: builtinRawTools } = registerAllBuiltin(cwd);

  const builtinTools: ToolDefinition[] = builtinRawTools.map((tool: any) => {
    if ('execute' in tool && 'parameters' in tool && !('prepareArguments' in tool)) {
      return createToolDefinitionFromAgentTool(tool as AgentTool<any>);
    }
    return tool as ToolDefinition;
  });

  return {
    allExtensionFactories: [...pluginFactories, ...addonExtensions, ...builtinExtensions],
    allCustomTools: [...addonTools, ...builtinTools],
  };
}

function createRuntimeFactory(
  services: AgentSessionServices,
  customTools: ToolDefinition[]
): CreateAgentSessionRuntimeFactory {
  return async (options) => {
    const allTools = customTools || (registerAllBuildinAndCustomTools(services.cwd) as ToolDefinition[]);
    const result = await createAgentSessionFromServices({
      services,
      sessionManager: options.sessionManager,
      sessionStartEvent: options.sessionStartEvent,
      customTools: allTools,
    }) as CreateAgentSessionRuntimeResult;
    return {
      ...result,
      services,
      diagnostics: services.diagnostics,
    } as CreateAgentSessionRuntimeResult;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(handleMainError);
}
