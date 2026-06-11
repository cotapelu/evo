#!/usr/bin/env node
/**
 * Sandbox Mode Extension – Read-Only Safeguard
 *
 * Provides sandbox mode with only read capabilities: read, ls, grep, find.
 * Disables write/edit/bash for safety. Uses createReadOnlyTools from SDK.
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
export declare function createSandboxEnterTool(): ToolDefinition<any, any>;
export declare function createSandboxExitTool(): ToolDefinition<any, any>;
export declare function createSandboxStatusTool(): ToolDefinition<any, any>;
export declare function createSandboxCreateTool(): ToolDefinition<any, any>;
export declare function registerSandboxExtension(api: ExtensionAPI): void;
export default registerSandboxExtension;
//# sourceMappingURL=index.d.ts.map