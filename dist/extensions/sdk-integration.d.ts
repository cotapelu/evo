#!/usr/bin/env node
/**
 * SDK Integration Extension – Simple Implementation
 *
 * Minimal tools to showcase SDK integration without complex typing issues.
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
export declare function createSessionInfoTool(): ToolDefinition;
export declare function createSettingsTool(): ToolDefinition;
export declare function createResourceTool(): ToolDefinition;
export declare function registerSdkIntegrationExtension(api: ExtensionAPI): void;
export default registerSdkIntegrationExtension;
//# sourceMappingURL=sdk-integration.d.ts.map