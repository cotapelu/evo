#!/usr/bin/env node
/**
 * Super File Tools Extension – Full SDK Power
 *
 * Uses SDK tool factories with advanced options:
 * - All file tools with cwd override support
 * - Dynamic tool enable/disable via api.setActiveTools
 * - File mutation tracking
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
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
 * Wrap a tool to add cwd override capability
 */
function wrapToolWithCwd(tool: ToolDefinition<any, any>, baseCwd: string): ToolDefinition<any, any> {
	// Add cwd parameter if missing
	if (!tool.parameters) tool.parameters = { type: 'object', properties: {} };
	const props = tool.parameters.properties as Record<string, any>;
	if (!props.cwd) {
		props.cwd = { type: 'string', description: 'Working directory (overrides session cwd)' };
	}
	// Wrap execute to inject cwd from params
	const origExecute = tool.execute.bind(tool);
	tool.execute = async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => {
		const effectiveCwd = params?.cwd || baseCwd;
		const newCtx = { ...ctx, cwd: effectiveCwd };
		return origExecute(toolCallId, params, signal, onUpdate, newCtx);
	};
	return tool;
}

/**
 * Create all file tools with optional cwd override
 */
export function registerEnhancedFileToolsExtension(api: ExtensionAPI): void {
	const baseCwd = '.';

	// Create and register all file tools
	const tools: ToolDefinition<any, any>[] = [
		wrapToolWithCwd(createReadTool(baseCwd), baseCwd),
		wrapToolWithCwd(createLsTool(baseCwd), baseCwd),
		wrapToolWithCwd(createGrepTool(baseCwd), baseCwd),
		wrapToolWithCwd(createFindTool(baseCwd), baseCwd),
		wrapToolWithCwd(createEditTool(baseCwd), baseCwd),
		wrapToolWithCwd(createWriteTool(baseCwd), baseCwd),
		wrapToolWithCwd(createBashTool(baseCwd), baseCwd),
	];

	for (const tool of tools) {
		api.registerTool(tool);
	}

	// Add tool control commands
	createToolControlExtension(api);

	// Add mutation queue monitoring
	createMutationQueueExtension(api);

	api.sendMessage?.({
		customType: "super-file-tools",
		content: "🚀 Super File Tools loaded (7 tools + control commands)",
		display: false
	});
}

/**
 * Dynamic tool control extension
 */
function createToolControlExtension(api: ExtensionAPI): void {
	api.registerCommand("tools.enable", {
		description: "Enable specific tools by name (e.g., tools.enable read,bash,edit)",
		handler: async (args: string, ctx: any) => {
			const toolNames = args.split(',').map(s => s.trim()).filter(Boolean);
			const current = api.getActiveTools();
			const newActive = [...new Set([...current, ...toolNames])];
			api.setActiveTools(newActive);
			ctx.ui.notify?.(`Enabled tools: ${toolNames.join(', ')}. Active: ${newActive.length}`, { type: 'success' });
		},
	});

	api.registerCommand("tools.disable", {
		description: "Disable specific tools by name (e.g., tools.disable write,edit)",
		handler: async (args: string, ctx: any) => {
			const toolNames = args.split(',').map(s => s.trim()).filter(Boolean);
			const current = api.getActiveTools();
			const newActive = current.filter(t => !toolNames.includes(t));
			api.setActiveTools(newActive);
			ctx.ui.notify?.(`Disabled tools: ${toolNames.join(', ')}. Active: ${newActive.length}`, { type: 'info' });
		},
	});

	api.registerCommand("tools.list", {
		description: "List all available tools and their status",
		handler: async (_args: string, ctx: any) => {
			const all = api.getAllTools();
			const active = new Set(api.getActiveTools());
			const lines: string[] = ["📋 Tools:"];
			for (const info of all) {
				const status = active.has(info.name) ? "✅" : "⭕";
				lines.push(`${status} ${info.name}`);
			}
			lines.push(`Total: ${all.length} | Active: ${active.size}`);
			ctx.ui.notify?.(lines.join('\n'), { type: 'info', timeout: 10000 });
		},
	});
}

/**
 * File mutation tracker
 */
function createMutationQueueExtension(api: ExtensionAPI): void {
	let mutationCount = 0;
	api.on("tool_execution_end", async (event) => {
		const toolName = event.toolName;
		if (toolName === "write" || toolName === "edit") {
			mutationCount++;
			console.log(`[Mutations] ${toolName}: ${mutationCount}`);
		}
	});

	api.registerCommand("mutations.count", {
		description: "Show file mutation count for this session",
		handler: async (_args: string, ctx: any) => {
			ctx.ui.notify?.(`📝 Mutations: ${mutationCount}`, { type: 'info' });
		},
	});
}

/**
 * Backward compatible export
 */
export function registerFileToolsExtension(api: ExtensionAPI): void {
	registerEnhancedFileToolsExtension(api);
}

export default registerEnhancedFileToolsExtension;
