/**
 * Runtime Runner - Manages global runtime exposure for cross-tool access
 *
 * The team_run tool requires a runtime context, but may be invoked from
 * interactive mode where ctx.runtime is not always directly available.
 * This module provides a global fallback mechanism.
 */
let globalRuntime = null;
/**
 * Set the current global runtime (called by main.ts during startup)
 */
export function setGlobalRuntime(runtime) {
    globalRuntime = runtime;
}
/**
 * Get the current global runtime (fallback for tools)
 */
export function getGlobalRuntime() {
    return globalRuntime;
}
/**
 * Clear the global runtime (cleanup on shutdown)
 */
export function clearGlobalRuntime() {
    globalRuntime = null;
}
//# sourceMappingURL=runtime-runner.js.map