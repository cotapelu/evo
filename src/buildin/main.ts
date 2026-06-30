// ============================================================================
// 1. IMPORTS
// ============================================================================

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
} from './deps.js';
import type { ToolDefinition } from './deps.js';
import { createServicesOptions, registerAllBuildinAndCustomTools } from './index.js';
import { runWithCorrelationId } from './utils/async-context.js';
import { metrics, METRIC_NAMES } from './utils/metrics.js';

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Main entry point for procman.
 * Initializes services and starts interactive mode.
 * @param args - Command-line arguments (currently unused)
 * @param options - Optional configuration (e.g., extensionFactories)
 */
async function main(
  args: string[] = [],
  options: { extensionFactories?: unknown[] } = {}
): Promise<void> {
  // Mark args as intentionally unused for now (CLI arguments not yet processed)
  void args;
  const cwd = process.cwd();
  const agentDir = process.env.PI_CONFIG_DIR ?? `${os.homedir()}/.pi/agent`;

  // Generate correlation ID for this session and run within context
  const correlationId = crypto.randomUUID();
  const startTime = performance.now();
  metrics.incrementCounter(METRIC_NAMES.CORRELATION_ID_GENERATED);
  metrics.incrementCounter(METRIC_NAMES.SESSION_START);
  metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 1);
  try {
    await runWithCorrelationId(correlationId, async () => {
      // Build services options using centralized config manager
      const servicesOptions = createServicesOptions(cwd, agentDir, {
        resourceLoaderOverrides: {
          extensionFactories: options.extensionFactories || []
        },
      });
      const services = await createAgentSessionServices(servicesOptions);
      const sessionManager = SessionManager.create(cwd);
      const runtime = await createAgentSessionRuntime(createRuntimeFactory(services), { cwd, agentDir, sessionManager });
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

/**
 * Handles fatal errors from main entry point by logging and exiting.
 * @internal - Used by module IIFE only.
 */
export function handleMainError(error: unknown): never {
  console.error('Failed to start procman:', error);
  process.exit(1);
}

// ============================================================================
// 3. PRIVATE IMPLEMENTATION
// ============================================================================

/**
 * Creates the runtime factory with injected services.
 * @internal
 * @param services - Agent session services
 */
function createRuntimeFactory(services: AgentSessionServices): CreateAgentSessionRuntimeFactory {
  return async (options) => {
    // Register all tools (built-in + custom wrappers)
    const allTools = registerAllBuildinAndCustomTools(services.cwd) as ToolDefinition[];
    const result = await createAgentSessionFromServices({
      services,
      sessionManager: options.sessionManager,
      sessionStartEvent: options.sessionStartEvent,
      customTools: allTools,
    }) as CreateAgentSessionRuntimeResult;
    // Ensure result includes services and diagnostics as required by CreateAgentSessionRuntimeResult
    return {
      ...result,
      services,
      diagnostics: services.diagnostics,
    } as CreateAgentSessionRuntimeResult;
  };
}

// ============================================================================
// 4. MODULE EXECUTION
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(handleMainError);
}
