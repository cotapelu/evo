#!/usr/bin/env node
/**
 * Code Health Tool
 *
 * Runs multiple code quality checks: lint, type-check, test, build.
 * Useful for CI-like validation locally.
 *
 * Actions:
 * - audit (default): runs all configured checks
 *
 * Optional parameters:
 *   checks?: string[] - subset of ['lint', 'typecheck', 'test', 'build'] to run
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export declare function registerCodeHealthTool(api: ExtensionAPI): void;
//# sourceMappingURL=code-health-tool.d.ts.map