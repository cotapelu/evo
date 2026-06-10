#!/usr/bin/env node
/**
 * Coding Tools Extension – SDK Factory Usage
 *
 * Uses createCodingTools() to provide lint, typecheck, and test tools.
 * Each tool is enhanced with optional cwd parameter.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createCodingTools } from "@earendil-works/pi-coding-agent";

/**
 * Enhance tool with optional cwd parameter
 */
function enhanceToolWithCwd(tool: ToolDefinition<any, any, any>): ToolDefinition<any, any, any> {
	if (!tool.parameters) tool.parameters = { type: 'object', properties: {} };
	const props = tool.parameters.properties as Record<string, any>;
	if (!props.cwd) {
		props.cwd = { type: 'string', description: 'Working directory (overrides session cwd)' };
	}
	const orig = tool.execute;
	tool.execute = async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => {
		if (params?.cwd) ctx = { ...ctx, cwd: params.cwd };
		return orig(toolCallId, params, signal, onUpdate, ctx);
	};
	return tool;
}

export function registerCodingToolsExtension(api: ExtensionAPI): void {
	const cwd = '.';
	const tools = createCodingTools(cwd);
	for (const at of tools) {
		// May return either ToolDefinition directly or AgentTool wrapping .tool
		const def = (at as any).tool || at;
		if (def) {
			enhanceToolWithCwd(def);
			api.registerTool(def);
		}
	}
}

export default registerCodingToolsExtension;
