/**
 * Runtime Provider - Creates and configures the agent session runtime
 *
 * Handles all runtime initialization: paths, services, extensions, diagnostics, metrics.
 * Returns the ready-to-use AgentSessionRuntime.
 */
import { AgentSessionRuntime, AgentSessionServices, CreateAgentSessionResult, type AgentSessionRuntimeDiagnostic } from '@earendil-works/pi-coding-agent';
export type { AgentSessionRuntime };
export interface StartupMetrics {
    totalMs: number;
    servicesMs: number;
    sessionMs: number;
}
export declare function createAndRunRuntime(): Promise<{
    runtime: AgentSessionRuntime;
    services: AgentSessionServices;
    result: CreateAgentSessionResult;
    metrics: StartupMetrics;
    diagnostics: AgentSessionRuntimeDiagnostic[];
}>;
export declare function formatDuration(ms: number): string;
export declare function printBanner(): void;
export declare function printDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]): void;
export declare function printStartupMetrics(metrics: StartupMetrics): void;
//# sourceMappingURL=runtime-provider.d.ts.map