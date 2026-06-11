#!/usr/bin/env node
/**
 * Package Manager Extension (with Retry and Circuit Breaker)
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
export declare function createListPackagesTool(): ToolDefinition<any, any>;
export declare function createInstallPackageTool(): ToolDefinition<any, any>;
export declare function createRemovePackageTool(): ToolDefinition<any, any>;
export declare function createUpdatePackagesTool(): ToolDefinition<any, any>;
export declare function createCheckUpdatesTool(): ToolDefinition<any, any>;
export declare function registerPackageManagerExtension(api: ExtensionAPI): void;
export default registerPackageManagerExtension;
//# sourceMappingURL=index.d.ts.map