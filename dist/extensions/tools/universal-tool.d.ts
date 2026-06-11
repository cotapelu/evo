#!/usr/bin/env node
/**
 * Universal Tool – Refactored to use SDK createBashToolDefinition
 *
 * All actions are executed via the SDK bash tool for consistency,
 * proper signal handling, and security (no manual command injection).
 *
 * Actions:
 * - echo: Echo a message
 * - system_info: OS, hardware, uptime
 * - date: Current date/time
 * - uuid: Generate UUID v4
 * - random: Random integer (min/max)
 * - calc: Evaluate math expression via bc
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
/**
 * Register the universal tool extension.
 */
export declare function registerUniversalTool(api: ExtensionAPI): void;
//# sourceMappingURL=universal-tool.d.ts.map