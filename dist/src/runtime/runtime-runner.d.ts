/**
 * Runtime Runner - Manages global runtime exposure for cross-tool access
 *
 * The team_run tool requires a runtime context, but may be invoked from
 * interactive mode where ctx.runtime is not always directly available.
 * This module provides a global fallback mechanism.
 */
import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
/**
 * Set the current global runtime (called by main.ts during startup)
 */
export declare function setGlobalRuntime(runtime: AgentSessionRuntime): void;
/**
 * Get the current global runtime (fallback for tools)
 */
export declare function getGlobalRuntime(): AgentSessionRuntime | null;
/**
 * Clear the global runtime (cleanup on shutdown)
 */
export declare function clearGlobalRuntime(): void;
//# sourceMappingURL=runtime-runner.d.ts.map