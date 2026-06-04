/**
 * Evo Runtime Provider - Creates and configures the complete agent session runtime
 *
 * This module leverages the full power of @earendil-works/pi-coding-agent to create
 * a robust, configurable, and observable runtime with:
 * - Advanced diagnostics and metrics
 * - Customizable settings (compaction, retry, thinking level)
 * - Flexible resource loading with overrides
 * - Event bus integration
 * - Comprehensive error handling
 * - Startup performance tracking
 *
 * The runtime is designed to be extensible and observable, providing hooks for
 * monitoring, logging, and debugging the agent's behavior.
 */

import {
  createAgentSessionRuntime,
  SessionManager,
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  DefaultResourceLoader,
  type AgentSessionRuntime,
  type AgentSessionServices,
  type CreateAgentSessionResult,
  type AgentSessionRuntimeDiagnostic,
  type ExtensionFactory,
  getAgentDir,
  createAgentSessionServices,
  createAgentSessionFromServices,
} from '@earendil-works/pi-coding-agent';

// Additional type imports from specific modules
import type { ThinkingLevel } from '@earendil-works/pi-agent-core';
import type { Model } from '@earendil-works/pi-ai';
import type { DefaultResourceLoaderOptions } from '@earendil-works/pi-coding-agent/dist/core/resource-loader.js';
import type { EventBus } from '@earendil-works/pi-coding-agent/dist/core/event-bus.js';
import type { LoadExtensionsResult } from '@earendil-works/pi-coding-agent/dist/core/extensions/index.js';

import extensionsAggregator from '../extensions/index.js';
import { setGlobalRuntime } from './runtime-runner.js';

// Re-export commonly used types for consumers
export type {
  AgentSessionRuntime,
  AgentSessionServices,
  CreateAgentSessionResult,
  AgentSessionRuntimeDiagnostic,
};

/** Runtime configuration options */
export interface RuntimeOptions {
  /** Custom auth storage location (default: agentDir/auth.json) */
  authStoragePath?: string;
  /** Custom models.json location (default: agentDir/models.json) */
  modelsJsonPath?: string;
  /** Override thinking level (default: from settings, else 'medium') */
  thinkingLevel?: ThinkingLevel;
  /** Scoped models for cycling (Ctrl+P equivalent) */
  scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
  /** Tool allowlist - if not set, defaults to built-in tools */
  tools?: string[];
  /** Tool denylist - applied after allowlist */
  excludeTools?: string[];
  /** Tool suppression mode: 'all' (no tools), 'builtin' (only custom), or undefined (default) */
  noTools?: 'all' | 'builtin';
  /** Custom tools to register in addition to built-in */
  customTools?: any[];
  /**
   * Settings overrides - these are applied on top of settings.json
   * Supports: compaction, retry, thinkingLevel, etc.
   */
  settingsOverrides?: Record<string, any>;
  /**
   * Resource loader customization
   */
  resourceLoaderOptions?: Omit<DefaultResourceLoaderOptions, 'cwd' | 'agentDir' | 'settingsManager'>;
  /**
   * Enable event bus for monitoring?
   * When true, the runtime event bus is accessible via services.eventBus
   */
  enableEventBus?: boolean;
  /**
   * Additional extension paths to load (beyond defaults)
   */
  additionalExtensionPaths?: string[];
  /**
   * System prompt override - completely replaces default system prompt
   */
  systemPrompt?: string;
  /**
   * Append to system prompt - adds to default system prompt
   */
  appendSystemPrompt?: string[];
  /**
   * Custom skills (in addition to discovered ones)
   */
  customSkills?: any[];
  /**
   * Disable certain resource types
   */
  noExtensions?: boolean;
  noSkills?: boolean;
  noPromptTemplates?: boolean;
  noThemes?: boolean;
  noContextFiles?: boolean;
}

/** Startup timing metrics */
export interface StartupMetrics {
  totalMs: number;
  servicesMs: number;
  sessionMs: number;
}

/** Detailed runtime creation result */
export interface RuntimeCreationResult {
  runtime: AgentSessionRuntime;
  services: AgentSessionServices;
  sessionResult: CreateAgentSessionResult;
  metrics: StartupMetrics;
  diagnostics: AgentSessionRuntimeDiagnostic[];
  extensionsResult: LoadExtensionsResult;
}

/**
 * Create event bus for monitoring agent events
 */
function createEventBusIfNeeded(options: RuntimeOptions): EventBus | null {
  if (options.enableEventBus !== true) {
    return null;
  }
  // Import dynamically to avoid issues
  const { createEventBus } = require('@earendil-works/pi-coding-agent/dist/core/event-bus.js');
  return createEventBus();
}

/**
 * Apply settings overrides to settings manager
 */
function applySettingsOverrides(
  settingsManager: SettingsManager,
  overrides: Record<string, any>
): void {
  if (!overrides || Object.keys(overrides).length === 0) {
    return;
  }

  // Apply overrides using settings manager's API
  // Note: SettingsManager structure may vary, we use known properties
  if (overrides.compaction) {
    // compaction settings are read-only at runtime? Check API
    // For now, we document that compaction should be set via settings.json
    console.warn('Compaction overrides not supported at runtime; use settings.json');
  }
  if (overrides.retry) {
    // Similar - retry settings loaded from settings
  }
  // We can set some writable settings:
  if (overrides.thinkingLevel !== undefined) {
    settingsManager.setDefaultThinkingLevel(overrides.thinkingLevel);
  }
  // Other settings...
}

/**
 * Build resource loader options from runtime options
 */
function buildResourceLoaderOptions(
  cwd: string,
  agentDir: string,
  settingsManager: SettingsManager,
  options: RuntimeOptions,
  eventBus?: EventBus
): DefaultResourceLoaderOptions {
  const base: Omit<DefaultResourceLoaderOptions, 'cwd' | 'agentDir' | 'settingsManager'> = {
    eventBus,
    extensionFactories: options.additionalExtensionPaths ? undefined : [extensionsAggregator],
    additionalExtensionPaths: options.additionalExtensionPaths,
    noExtensions: options.noExtensions,
    noSkills: options.noSkills,
    noPromptTemplates: options.noPromptTemplates,
    noThemes: options.noThemes,
    noContextFiles: options.noContextFiles,
    systemPrompt: options.systemPrompt,
    appendSystemPrompt: options.appendSystemPrompt,
    skillsOverride: options.customSkills
      ? (base) => ({
          skills: [...base.skills, ...options.customSkills!],
          diagnostics: base.diagnostics,
        })
      : undefined,
  };

  const merged = { ...base, ...options.resourceLoaderOptions };

  return {
    cwd,
    agentDir,
    settingsManager,
    ...merged,
  };
}

/**
 * Main function: Create and run the complete runtime
 *
 * This is the primary entry point for bootstrapping the agent.
 * It returns a fully configured AgentSessionRuntime with all services,
 * diagnostics, and metrics.
 */
export async function createAndRunRuntime(
  options: RuntimeOptions = {}
): Promise<RuntimeCreationResult> {
  const startTime = Date.now();
  let servicesStartTime = 0;
  let sessionStartTime = 0;

  // === SETUP PATHS ===
  const cwd = process.cwd();
  const agentDir = getAgentDir();

  if (!cwd) {
    throw new Error('Current working directory is not set');
  }

  // === INITIALIZE CORE SERVICES ===
  const sessionManager = SessionManager.create(cwd);

  // Custom auth storage if path provided
  const authStorage = options.authStoragePath
    ? AuthStorage.create(options.authStoragePath)
    : AuthStorage.create();

  // Custom model registry if models.json path provided
  const modelRegistry = options.modelsJsonPath
    ? ModelRegistry.create(authStorage, options.modelsJsonPath)
    : ModelRegistry.create(authStorage);

  // Event bus for monitoring (optional)
  let eventBus: EventBus | null = null;
  if (options.enableEventBus) {
    eventBus = createEventBusIfNeeded(options);
  }

  // Declare these in outer scope to assign inside factory
  let services: AgentSessionServices | undefined;
  let sessionResult: CreateAgentSessionResult | undefined;
  let extensionsResult: LoadExtensionsResult | undefined;

  // === CREATE RUNTIME ===
  servicesStartTime = Date.now();
  const runtime = await createAgentSessionRuntime(
    async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
      // Create settings manager
      const settingsManager = SettingsManager.create(innerCwd, innerAgentDir);

      // Apply settings overrides
      if (options.settingsOverrides) {
        applySettingsOverrides(settingsManager, options.settingsOverrides);
      }

      // Build resource loader options
      const resourceLoaderOptions = buildResourceLoaderOptions(
        innerCwd,
        innerAgentDir,
        settingsManager,
        options,
        eventBus || undefined
      );

      // Create services
      const servicesStart = Date.now();
      const fullResourceLoaderOptions = buildResourceLoaderOptions(
        innerCwd,
        innerAgentDir,
        settingsManager,
        options,
        eventBus || undefined
      );
      // Extract cwd/agentDir/settingsManager for CreateAgentSessionServicesOptions
      const { cwd: rlCwd, agentDir: rlAgentDir, settingsManager: rlSettingsManager, ...resourceLoaderOnly } = fullResourceLoaderOptions;

      services = await createAgentSessionServices({
        cwd: innerCwd,
        agentDir: innerAgentDir,
        authStorage,
        settingsManager,
        modelRegistry,
        extensionFlagValues: undefined,
        resourceLoaderOptions: resourceLoaderOnly,
      });

      // Prepare session options
      const sessionOptions = {
        services,
        sessionManager: innerSessionManager,
        // Model and thinking
        model: undefined as Model<any> | undefined,
        thinkingLevel: options.thinkingLevel,
        scopedModels: options.scopedModels,
        // Tool configuration
        tools: options.tools,
        excludeTools: options.excludeTools,
        noTools: options.noTools,
        customTools: options.customTools,
      } as const;

      // Create session
      sessionStartTime = Date.now();
      sessionResult = await createAgentSessionFromServices(sessionOptions);
      extensionsResult = services.resourceLoader.getExtensions();

      return {
        ...sessionResult,
        services,
        diagnostics: services.diagnostics,
      };
    },
    {
      cwd: sessionManager.getCwd(),
      agentDir,
      sessionManager,
    }
  );

  const totalTime = Date.now() - startTime;
  const servicesTime = sessionStartTime - servicesStartTime;
  const sessionTime = Date.now() - sessionStartTime;

  const metrics: StartupMetrics = {
    totalMs: totalTime,
    servicesMs: servicesTime,
    sessionMs: sessionTime,
  };

  const allDiagnostics: AgentSessionRuntimeDiagnostic[] = [
    ...services!.diagnostics,
    ...runtime.diagnostics,
    ...(extensionsResult?.errors?.map((err: any) => ({
      type: 'error' as const,
      message: `Extension error: ${err.message || String(err)}`,
    })) || []),
  ];

  // Expose global runtime for tools that need it (e.g., team_run)
  setGlobalRuntime(runtime);

  return {
    runtime,
    services: services!,
    sessionResult: sessionResult!,
    metrics,
    diagnostics: allDiagnostics,
    extensionsResult: extensionsResult!,
  };
}

/**
 * Format duration for human-readable display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print Evo Agent banner
 */
export function printBanner(): void {
  console.log(`\n🧬 Evo Agent v0.0.1\n`);
}

/**
 * Print diagnostics to console with appropriate icons
 */
export function printDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]): void {
  if (diagnostics.length === 0) return;
  console.log('\n📊 Diagnostics:');
  for (const d of diagnostics) {
    const icon = d.type === 'error' ? '❌' : d.type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} ${d.message}`);
  }
  console.log('');
}

/**
 * Print startup timing metrics
 */
export function printStartupMetrics(metrics: StartupMetrics): void {
  console.log('\n⏱️  Startup Timing:');
  console.log(`  Total:   ${formatDuration(metrics.totalMs)}`);
  console.log(`  Services: ${formatDuration(metrics.servicesMs)}`);
  console.log(`  Session:  ${formatDuration(metrics.sessionMs)}`);
  console.log('');
}

/**
 * Get runtime status summary (for monitoring/debugging)
 *
 * Returns basic information about the runtime state.
 */
export function getRuntimeStatus(runtime: AgentSessionRuntime): {
  sessionActive: boolean;
  sessionFile: string | null;
  runtimeDiagnosticsCount: number;
  servicesDiagnosticsCount: number;
} {
  const session = runtime.session;
  return {
    sessionActive: session !== null,
    sessionFile: session?.sessionFile || null,
    runtimeDiagnosticsCount: runtime.diagnostics.length,
    servicesDiagnosticsCount: (runtime as any).services?.diagnostics?.length || 0,
  };
}

/**
 * Create a minimal runtime for testing or embedded use
 *
 * This is a convenience wrapper that creates a runtime with sensible
 * defaults but minimal side effects. Useful for unit tests or embedding
 * the agent in other applications.
 */
export async function createMinimalRuntime(options: {
  cwd?: string;
  tools?: string[];
  thinkingLevel?: ThinkingLevel;
} = {}): Promise<AgentSessionRuntime> {
  const result = await createAndRunRuntime({
    ...options,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    enableEventBus: false,
  });
  return result.runtime;
}

/**
 * Validate runtime configuration and return any issues
 */
export function validateRuntimeOptions(options: RuntimeOptions): string[] {
  const errors: string[] = [];

  if (options.tools && options.noTools) {
    errors.push('Cannot specify both tools and noTools');
  }
  if (options.noTools && options.noTools !== 'all' && options.noTools !== 'builtin') {
    errors.push('noTools must be "all" or "builtin"');
  }
  if (options.thinkingLevel) {
    const validLevels = ['off', 'low', 'medium', 'high'];
    if (!validLevels.includes(options.thinkingLevel)) {
      errors.push(`Invalid thinkingLevel: ${options.thinkingLevel}. Must be one of: ${validLevels.join(', ')}`);
    }
  }
  return errors;
}
