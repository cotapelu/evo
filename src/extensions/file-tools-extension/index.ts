#!/usr/bin/env node
/**
 * File Tools Extension – SDK Factory Demonstration
 *
 * Uses SDK tool factories to create file-related tools with cwd override support.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";

// Import SDK factories (single-tool versions)
import {
	createReadTool,
	createLsTool,
	createGrepTool,
	createFindTool,
	createEditTool,
	createWriteTool,
	createBashTool,
} from "@earendil-works/pi-coding-agent";

/**
 * Enhance tool with optional cwd parameter
 */
function enhanceToolWithCwd(tool: any): ToolDefinition<any, any, any> {
	// Add cwd parameter if missing
	if (!tool.parameters) tool.parameters = { type: 'object', properties: {} };
	const props = tool.parameters.properties as Record<string, any>;
	if (!props.cwd) {
		props.cwd = { type: 'string', description: 'Working directory (overrides session cwd)' };
	}
	// Wrap execute to inject cwd from params
	const orig = tool.execute;
	tool.execute = async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => {
		if (params?.cwd) ctx = { ...ctx, cwd: params.cwd };
		return orig(toolCallId, params, signal, onUpdate, ctx);
	};
	return tool as ToolDefinition<any, any, any>;
}

export function registerFileToolsExtension(api: ExtensionAPI): void {
	const cwd = '.'; // default relative cwd

	api.registerTool(enhanceToolWithCwd(createReadTool(cwd)));
	api.registerTool(enhanceToolWithCwd(createLsTool(cwd)));
	api.registerTool(enhanceToolWithCwd(createGrepTool(cwd)));
	api.registerTool(enhanceToolWithCwd(createFindTool(cwd)));
	api.registerTool(enhanceToolWithCwd(createEditTool(cwd)));
	api.registerTool(enhanceToolWithCwd(createWriteTool(cwd)));
	api.registerTool(enhanceToolWithCwd(createBashTool(cwd)));
}

export default registerFileToolsExtension;
