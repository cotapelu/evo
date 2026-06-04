/**
 * Evo Runtime Provider - Creates and configures the agent session runtime
 *
 * Uses public API from @earendil-works/pi-coding-agent
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
  getAgentDir,
  createAgentSessionServices,
  createAgentSessionFromServices,
} from '@earendil-works/pi-coding-agent';

import type { ThinkingLevel } from '@earendil-works/pi-agent-core';
import type { Model } from '@earendil-works/pi-ai';
import type { DefaultResourceLoaderOptions } from '@earendil-works/pi-coding-agent/dist/core/resource-loader.js';

import extensionsAggregator from '../extensions/index.js';
import { setGlobalRuntime } from './runtime-runner.js';

// Re-export types
export type {
  AgentSessionRuntime,
  AgentSessionServices,
  CreateAgentSessionResult,
  AgentSessionRuntimeDiagnostic,
};

/** Runtime configuration options */
export interface RuntimeOptions {
  authStoragePath?: string;
  modelsJsonPath?: string;
  thinkingLevel?: ThinkingLevel;
  scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
  tools?: string[];
  excludeTools?: string[];
  noTools?: 'all' | 'builtin';
  customTools?: any[];
  settingsOverrides?: Record<string, any>;
  resourceLoaderOptions?: Omit<DefaultResourceLoaderOptions, 'cwd' | 'agentDir' | 'settingsManager'>;
  additionalExtensionPaths?: string[];
  systemPrompt?: string;
  appendSystemPrompt?: string[];
  customSkills?: any[];
  noExtensions?: boolean;
  noSkills?: boolean;
  noPromptTemplates?: boolean;
  noThemes?: boolean;
  noContextFiles?: boolean;
  enableEventBus?: boolean;
  autoLoginProviders?: Record<string, string>;
}

/** Startup metrics */
export interface StartupMetrics {
  totalMs: number;
  servicesMs: number;
  sessionMs: number;
}

/** Runtime creation result */
export interface RuntimeCreationResult {
  runtime: AgentSessionRuntime;
  services: AgentSessionServices;
  sessionResult: CreateAgentSessionResult;
  metrics: StartupMetrics;
  diagnostics: AgentSessionRuntimeDiagnostic[];
  extensionsResult: any;
}

/**
 * Main runtime creation function
 */
export async function createAndRunRuntime(
  options: RuntimeOptions = {}
): Promise<RuntimeCreationResult> {
  const startTime = Date.now();

  const cwd = process.cwd();
  const agentDir = getAgentDir();

  if (!cwd) {
    throw new Error('Current working directory is not set');
  }

  const sessionManager = SessionManager.create(cwd);
  const authStorage = options.authStoragePath
    ? AuthStorage.create(options.authStoragePath)
    : AuthStorage.create();

  const modelRegistry = options.modelsJsonPath
    ? ModelRegistry.create(authStorage, options.modelsJsonPath)
    : ModelRegistry.create(authStorage);

  // Auto-login
  if (options.autoLoginProviders) {
    for (const [providerId, apiKey] of Object.entries(options.autoLoginProviders)) {
      authStorage.setRuntimeApiKey(providerId, apiKey);
    }
  }

  let eventBus: any = null;
  if (options.enableEventBus) {
    const { createEventBus } = await import('@earendil-works/pi-coding-agent/dist/core/event-bus.js');
    eventBus = createEventBus();
  }

  let services: AgentSessionServices | undefined;
  let sessionResult: CreateAgentSessionResult | undefined;
  let extensionsResult: any;

  const servicesStart = Date.now();

  const runtime = await createAgentSessionRuntime(
    async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
      const settingsManager = SettingsManager.create(innerCwd, innerAgentDir);

      // Apply overrides
      if (options.settingsOverrides?.thinkingLevel) {
        settingsManager.setDefaultThinkingLevel(options.settingsOverrides.thinkingLevel);
      }

      // Build resource loader options
      const baseResourceOptions: Omit<DefaultResourceLoaderOptions, 'cwd' | 'agentDir' | 'settingsManager'> = {
        eventBus,
        extensionFactories: options.additionalExtensionPaths ? [] : [extensionsAggregator],
        additionalExtensionPaths: options.additionalExtensionPaths,
        noExtensions: options.noExtensions,
        noSkills: options.noSkills,
        noPromptTemplates: options.noPromptTemplates,
        noThemes: options.noThemes,
        noContextFiles: options.noContextFiles,
        systemPrompt: options.systemPrompt,
        appendSystemPrompt: options.appendSystemPrompt,
      };

      const mergedResourceOptions = { ...baseResourceOptions, ...options.resourceLoaderOptions };

      // Create services
      services = await createAgentSessionServices({
        cwd: innerCwd,
        agentDir: innerAgentDir,
        authStorage,
        settingsManager,
        modelRegistry,
        resourceLoaderOptions: mergedResourceOptions,
      });

      // Session options
      const sessionOptions = {
        services,
        sessionManager: innerSessionManager,
        thinkingLevel: options.thinkingLevel,
        scopedModels: options.scopedModels,
        tools: options.tools,
        excludeTools: options.excludeTools,
        noTools: options.noTools,
        customTools: options.customTools,
      } as const;

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

  const totalMs = Date.now() - startTime;
  const servicesMs = Date.now() - servicesStart;
  const sessionMs = totalMs - servicesMs;

  const metrics: StartupMetrics = {
    totalMs,
    servicesMs,
    sessionMs,
  };

  const allDiagnostics: AgentSessionRuntimeDiagnostic[] = [
    ...services!.diagnostics,
    ...runtime.diagnostics,
    ...(extensionsResult?.errors?.map((err: any) => ({
      type: 'error' as const,
      message: `Extension error: ${err.message || String(err)}`,
    })) || []),
  ];

  setGlobalRuntime(runtime);

  return {
    runtime,
    services: services!,
    sessionResult: sessionResult!,
    metrics,
    diagnostics: allDiagnostics,
    extensionsResult,
  };
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print banner
 */
export function printBanner(): void {
  console.log(`\n🧬 Evo Agent v0.0.1\n`);
}

/**
 * Print diagnostics
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
 * Print startup metrics
 */
export function printStartupMetrics(metrics: StartupMetrics): void {
  console.log('\n⏱️  Startup Timing:');
  console.log(`  Total:   ${formatDuration(metrics.totalMs)}`);
  console.log(`  Services: ${formatDuration(metrics.servicesMs)}`);
  console.log(`  Session:  ${formatDuration(metrics.sessionMs)}`);
  console.log('');
}

/**
 * Get runtime status
 */
export function getRuntimeStatus(runtime: AgentSessionRuntime): {
  sessionActive: boolean;
  sessionFile: string | null;
  diagnosticsCount: number;
} {
  const session = runtime.session;
  return {
    sessionActive: session !== null,
    sessionFile: session?.sessionFile || null,
    diagnosticsCount: runtime.diagnostics.length,
  };
}

/**
 * Create minimal runtime for testing
 */
export async function createMinimalRuntime(
  options: {
    cwd?: string;
    tools?: string[];
    thinkingLevel?: ThinkingLevel;
  } = {}
): Promise<AgentSessionRuntime> {
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
 * Validate runtime options
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
  if (options.compactionOptions) {
    if (options.compactionOptions.threshold !== undefined && (options.compactionOptions.threshold < 0 || options.compactionOptions.threshold > 1)) {
      errors.push('compactionOptions.threshold must be between 0 and 1');
    }
    if (
      options.compactionOptions.maxTokensBeforeCompaction !== undefined &&
      options.compactionOptions.maxTokensBeforeCompaction < 1000
    ) {
      errors.push('compactionOptions.maxTokensBeforeCompaction must be >= 1000');
    }
  }
  if (options.retryOptions) {
    if (options.retryOptions.maxRetries !== undefined && options.retryOptions.maxRetries < 0) {
      errors.push('retryOptions.maxRetries must be >= 0');
    }
  }
  if (options.modelSelection && !['first', 'available', 'explicit'].includes(options.modelSelection)) {
    errors.push('modelSelection must be "first", "available", or "explicit"');
  }
  return errors;
}
