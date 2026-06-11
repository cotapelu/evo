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
import { join } from "node:path";

// ============================================================================
// Helper: Simple argument substitution
// ============================================================================
function substituteArgs(content: string, args: string[]): string {
	let result = content;
	// Replace $1, $2, ... with corresponding arg
	for (let i = 0; i < args.length; i++) {
		const placeholder = `\$${i + 1}`;
		result = result.split(placeholder).join(args[i]);
	}
	// Replace $@ with all args joined by space
	result = result.split("$@").join(args.join(" "));
	// Replace ${@:N:L} slice (bash-like) – optional, skip for brevity
	return result;
}

// ============================================================================
// TOOL: List Prompt Templates
// ============================================================================
export function createListPromptTemplatesTool(): ToolDefinition<any, any> {
	return {
		name: "prompt.list",
		label: "Prompts: List",
		description: "List all available prompt templates",
		parameters: {},
		async execute(toolCallId: string, params: any, signal: any, _onUpdate: any, ctx: any) {
			try {
				const services = ctx.sdkServices;
				if (!services?.resourceLoader) {
					return {
						content: [{ type: "text", text: "❌ ResourceLoader not initialized. Run sdk.init first." }],
						isError: true,
						details: { error: "no_resource_loader" },
					};
				}

				const { prompts } = services.resourceLoader.getPrompts() as any;
				const templates = prompts as Array<{ name: string; description?: string }>;
				if (templates.length === 0) {
					return {
						content: [{ type: "text", text: "No prompt templates loaded." }],
						details: { count: 0 },
						isError: false,
					};
				}

				const lines = templates.map(p => `  /${p.name} – ${p.description || "(no description)"}`).join("\n");
				return {
					content: [{ type: "text", text: `Prompt templates (${templates.length}):\n${lines}` }],
					details: { count: templates.length, templates: templates.map(p => p.name) },
					isError: false,
				};
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `❌ Error: ${e.message}` }],
					isError: true,
					details: { error: e.message, stack: e.stack },
				};
			}
		},
	};
}

// ============================================================================
// TOOL: Expand Prompt Template
// ============================================================================
export function createExpandPromptTemplateTool(): ToolDefinition<any, any> {
	return {
		name: "prompt.expand",
		label: "Prompts: Expand",
		description: "Expand a prompt template with arguments (basic $1, $2, $@ substitution)",
		parameters: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Template name (without leading slash)",
				},
				args: {
					type: "array",
					items: { type: "string" },
					description: "Arguments for substitution ($1, $2, $@)",
				},
			},
			required: ["name"],
		},
		async execute(toolCallId: string, params: any, signal: any, _onUpdate: any, ctx: any) {
			try {
				const services = ctx.sdkServices;
				if (!services?.resourceLoader) {
					return {
						content: [{ type: "text", text: "❌ ResourceLoader not initialized. Run sdk.init first." }],
						isError: true,
						details: { error: "no_resource_loader" },
					};
				}

				const { prompts } = services.resourceLoader.getPrompts() as any;
				const templateList = prompts as Array<{ name: string; content: string }>;
				const { name, args = [] } = params as { name: string; args?: string[] };

				const template = templateList.find((p: any) => p.name === name);
				if (!template) {
					return {
						content: [{ type: "text", text: `❌ Template not found: /${name}. Use prompt.list to see available.` }],
						isError: true,
						details: { error: "not_found", name },
					};
				}

				const expanded = substituteArgs(template.content, args);

				return {
					content: [{
						type: "text",
						text: `📄 Template: /${template.name}\n\n${expanded}`,
					}],
					details: {
						name: template.name,
						argCount: args.length,
						expandedLength: expanded.length,
					},
					isError: false,
				};
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `❌ Error: ${e.message}` }],
					isError: true,
					details: { error: e.message, stack: e.stack },
				};
			}
		},
	};
}

// ============================================================================
// COMMANDS
// ============================================================================
function registerPromptCommands(api: ExtensionAPI): void {
	api.registerCommand("prompt.list", {
		description: "List available prompt templates",
		handler: async (args: string, ctx: any) => {
			const services = ctx.sdkServices;
			if (!services?.resourceLoader) {
				ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
				return;
			}

			const { prompts } = services.resourceLoader.getPrompts() as any;
			const templates = prompts as Array<{ name: string; description?: string }>;
			if (templates.length === 0) {
				ctx.ui.notify?.("No prompt templates loaded.", "info");
				return;
			}
			const lines = templates.slice(0, 20).map((p: any) => `/${p.name} – ${p.description || ""}`);
			ctx.ui.notify?.(`Templates (${templates.length}):\n${lines.join("\n")}`, "info");
		},
	});

	api.registerCommand("prompt.expand", {
		description: "Expand a template with arguments",
		handler: async (argsRaw: string, ctx: any) => {
			const services = ctx.sdkServices;
			if (!services?.resourceLoader) {
				ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
				return;
			}

			// Parse: name arg1 arg2...
			const parts = argsRaw.trim().split(/\s+/);
			if (parts.length === 0) {
				ctx.ui.notify?.("Provide template name and optional args.", "warning");
				return;
			}
			const name = parts[0];
			const args = parts.slice(1);

			const { prompts } = services.resourceLoader.getPrompts() as any;
			const templateList = prompts as Array<{ name: string; content: string }>;
			const template = templateList.find((p: any) => p.name === name);
			if (!template) {
				ctx.ui.notify?.(`Template not found: /${name}`, "error");
				return;
			}

			const expanded = substituteArgs(template.content, args);
			// Copy to clipboard if possible, else show in notification
			ctx.ui.notify?.(`📄 Expanded (${expanded.length} chars):\\n${expanded.substring(0, 200)}${expanded.length > 200 ? "..." : ""}`, "info");
		},
	});
}

// ============================================================================
// Main
// ============================================================================
export function registerPromptTemplatesExtension(api: ExtensionAPI): void {
	api.registerTool(createListPromptTemplatesTool());
	api.registerTool(createExpandPromptTemplateTool());
	registerPromptCommands(api);

	api.sendMessage?.({
		customType: "prompt-templates",
		content: "📝 Prompt Templates extension loaded",
		display: false,
	});
}

export default registerPromptTemplatesExtension;
