#!/usr/bin/env node
/**
 * Prompt Templates Extension
 *
 * Provides tools to interact with prompt templates loaded by ResourceLoader.
 * - List available templates
 * - View template content
 * - Expand template with arguments (basic $1, $2, $@ substitution)
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
export declare function createListPromptTemplatesTool(): ToolDefinition<any, any>;
export declare function createExpandPromptTemplateTool(): ToolDefinition<any, any>;
export declare function registerPromptTemplatesExtension(api: ExtensionAPI): void;
export default registerPromptTemplatesExtension;
//# sourceMappingURL=index.d.ts.map