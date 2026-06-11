#!/usr/bin/env node
/**
 * Git Tool (with Retry and Circuit Breaker)
 *
 * Wraps common Git operations with exponential backoff retry and circuit breaker.
 * Network-dependent failures are retried; repeated failures open the circuit to fail fast.
 *
 * Actions: status, diff, commit, add, push, pull, log.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export declare function registerGitTool(api: ExtensionAPI): void;
//# sourceMappingURL=git-tool.d.ts.map