/**
 * Evo Runtime Provider - Creates and configures the agent session runtime
 *
 * Uses public API from @earendil-works/pi-coding-agent
 */
import { type AgentSessionRuntime, type AgentSessionServices, type CreateAgentSessionResult, type AgentSessionRuntimeDiagnostic } from '@earendil-works/pi-coding-agent';
import type { ThinkingLevel } from '@earendil-works/pi-agent-core';
import type { Model } from '@earendil-works/pi-ai';
import type { DefaultResourceLoaderOptions } from '@earendil-works/pi-coding-agent/dist/core/resource-loader.js';
export type { AgentSessionRuntime, AgentSessionServices, CreateAgentSessionResult, AgentSessionRuntimeDiagnostic, };
/** Runtime configuration options */
export interface RuntimeOptions {
    authStoragePath?: string;
    modelsJsonPath?: string;
    thinkingLevel?: ThinkingLevel;
    scopedModels?: Array<{
        model: Model<any>;
        thinkingLevel?: ThinkingLevel;
    }>;
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
export declare function createAndRunRuntime(options?: RuntimeOptions): Promise<RuntimeCreationResult>;
/**
 * Format duration
 */
export declare function formatDuration(ms: number): string;
/**
 * Print banner
 */
export declare function printBanner(): void;
/**
 * Print diagnostics
 */
export declare function printDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]): void;
/**
 * Print startup metrics
 */
export declare function printStartupMetrics(metrics: StartupMetrics): void;
/**
 * Get runtime status
 */
export declare function getRuntimeStatus(runtime: AgentSessionRuntime): {
    sessionActive: boolean;
    sessionFile: string | null;
    diagnosticsCount: number;
};
/**
 * Create minimal runtime for testing
 */
export declare function createMinimalRuntime(options?: {
    cwd?: string;
    tools?: string[];
    thinkingLevel?: ThinkingLevel;
}): Promise<AgentSessionRuntime>;
/**
 * Validate runtime options
 */
export declare function validateRuntimeOptions(options: RuntimeOptions): string[];
//# sourceMappingURL=runtime-provider.d.ts.map