#!/usr/bin/env node
/**
 * Auth & Model Registry Extension
 *
 * Tools and commands for managing authentication and model configurations.
 * Requires sdk.init to be called first to initialize services.
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
export declare function createListCredentialsTool(): ToolDefinition;
export declare function createClearCredentialTool(): ToolDefinition;
export declare function createListModelsTool(): ToolDefinition;
export declare function createGetModelTool(): ToolDefinition;
export declare function registerAuthModelExtension(api: ExtensionAPI): void;
export default registerAuthModelExtension;
//# sourceMappingURL=index.d.ts.map