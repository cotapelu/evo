#!/usr/bin/env node
/**
 * SubTool Loader - SECURE VERSION
 *
 * Provides a tool that delegates to SDK tool factories.
 * No manual command execution → no injection vulnerabilities.
 *
 * Uses SDK tool definitions:
 * - createReadToolDefinition
 * - createLsToolDefinition
 * - createFindToolDefinition
 * - createGrepToolDefinition
 * - createBashToolDefinition (for HTTP via curl)
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
/**
 * Subtool Loader Tool Definition
 *
 * Facade to multiple SDK tools with safe parameter validation.
 */
export declare function createSubLoaderToolDefinition(): ToolDefinition;
/**
 * Register the sub-tool loader extension.
 */
export declare function registerSubToolLoaderExtension(api: ExtensionAPI): void;
//# sourceMappingURL=subtool-loader.d.ts.map