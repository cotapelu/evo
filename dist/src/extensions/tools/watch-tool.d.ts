#!/usr/bin/env node
/**
 * Watch Tool
 *
 * Watches project files for changes and automatically runs configured commands.
 * Useful for continuous code quality feedback during development.
 *
 * Parameters:
 *   commands?: string[] - array of command strings to run (default: ['code-health', 'test --coverage'])
 *   debounceMs?: number - debounce delay in ms (default: 500)
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export declare function registerWatchTool(api: ExtensionAPI): void;
//# sourceMappingURL=watch-tool.d.ts.map