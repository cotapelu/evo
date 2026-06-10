#!/usr/bin/env node
/**
 * Resource Loader Extension – Project Context Discovery
 *
 * Automatically adds project documentation to the agent's context.
 * - Hooks into `resources_discover` event
 * - Scans for common docs: AGENTS.md, README.md, README.*.md, docs/*.md, AGENTS.md
 * - Merges discovered files into the resource loader
 *
 * No manual commands needed – automatic on session start.
 * Provides tools to inspect loaded resources.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { join, relative } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// ============================================================================
// Event Handler: resources_discover
// ============================================================================
function registerResourcesDiscoverHandler(api: ExtensionAPI): void {
	// Use any for event types not exported
	// @ts-ignore – resources_discover event types not in public SDK
	api.on("resources_discover", async (event: any, _ctx: any): Promise<any> => {
		const baseResult = event.result;
		const cwd = event.cwd || process.cwd();
		const additionalFiles: Array<{ path: string; content: string }> = [];

		const isDocFile = (filename: string): boolean => {
			return filename.endsWith(".md") || filename.endsWith(".MD");
		};

		const isRelevant = (path: string): boolean => {
			const lower = path.toLowerCase();
			if (lower.includes("agents.md")) return true;
			if (lower.includes("readme")) return true;
			if (lower.includes("docs/")) return true;
			if (lower.includes("contribute")) return true;
			if (lower.includes("changelog")) return true;
			if (lower.includes("roadmap")) return true;
			return false;
		};

		function scanDir(dir: string): void {
			try {
				const entries = readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build" || entry.name === ".git") {
						continue;
					}
					if (entry.isDirectory()) {
						scanDir(fullPath);
					} else if (isDocFile(entry.name) && isRelevant(fullPath)) {
						try {
							const content = readFileSync(fullPath, "utf-8");
							const relPath = relative(cwd, fullPath);
							additionalFiles.push({ path: relPath, content });
						} catch (e) {
							// ignore
						}
					}
				}
			} catch (e) {
				// ignore
			}
		}

		scanDir(cwd);

		const mergedAgentsFiles = [...(baseResult.agentsFiles || []), ...additionalFiles];

		return {
			...baseResult,
			agentsFiles: mergedAgentsFiles,
		};
	});
}

// ============================================================================
// TOOL: List Resources
// ============================================================================
export function createListResourcesTool(): ToolDefinition<any, any> {
	return {
		name: "resources.list",
		label: "Resources: List",
		description: "List all project documentation resources loaded into context",
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

				const agentsFiles = services.resourceLoader.getAgentsFiles();
				const files = agentsFiles.agentsFiles || [];

				if (files.length === 0) {
					return {
						content: [{ type: "text", text: "No agent files loaded." }],
						details: { count: 0 },
					};
				}

				const lines = files.map((f: any) => `  ${f.path} (${f.content.length} bytes)`).join("\n");
				return {
					content: [{ type: "text", text: `Loaded resources (${files.length}):\n${lines}` }],
					details: { count: files.length, files: files.map((f: any) => f.path) },
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
function registerResourceCommands(api: ExtensionAPI): void {
	api.registerCommand("resources.list", {
		description: "List loaded project resources",
		handler: async (args: string, ctx: any) => {
			const services = ctx.sdkServices;
			if (!services?.resourceLoader) {
				ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
				return;
			}

			const agentsFiles = services.resourceLoader.getAgentsFiles();
			const files = agentsFiles.agentsFiles || [];
			if (files.length === 0) {
				ctx.ui.notify?.("No resources loaded.", "info");
				return;
			}
			const lines = files.slice(0, 20).map((f: any) => f.path);
			ctx.ui.notify?.(`Resources (${files.length}):\n${lines.join("\n")}`, "info");
		},
	});

	api.registerCommand("resources.reload", {
		description: "Reload resource loader to rescan project files",
		handler: async (args: string, ctx: any) => {
			const services = ctx.sdkServices;
			if (!services?.resourceLoader) {
				ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
				return;
			}

			try {
				await services.resourceLoader.reload();
				ctx.ui.notify?.("✅ Resource loader reloaded", "success");
			} catch (e: any) {
				ctx.ui.notify?.(`❌ Reload failed: ${e.message}`, "error");
			}
		},
	});
}

// ============================================================================
// Main
// ============================================================================
export function registerResourceLoaderExtension(api: ExtensionAPI): void {
	registerResourcesDiscoverHandler(api);
	api.registerTool(createListResourcesTool());
	registerResourceCommands(api);

	api.sendMessage?.({
		customType: "resource-loader",
		content: "📚 Resource Loader extension loaded – auto-adding project docs to context",
		display: false,
	});
}

export default registerResourceLoaderExtension;
