#!/usr/bin/env node
/**
 * Package Manager Extension (with Retry and Circuit Breaker)
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { DefaultPackageManager, getAgentDir } from "@earendil-works/pi-coding-agent";
import { CircuitBreaker, registerCircuit } from "../utils/circuit-breaker";

// ============================================================================
// Circuit Breaker for Package Manager network operations
// ============================================================================
const pmCircuit = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
registerCircuit('package-manager', pmCircuit);

// ============================================================================
// Retry Wrapper (fallback for transient failures before circuit opens)
// ============================================================================
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ============================================================================
// Helper
// ============================================================================
function getOrCreatePackageManager(ctx: any): any {
	if (ctx.packageManager) return ctx.packageManager;

	const services = ctx.sdkServices;
	if (!services?.settingsManager) {
		throw new Error("SettingsManager not initialized. Run sdk.init first.");
	}

	const agentDir = getAgentDir();
	const pm = new DefaultPackageManager({
		cwd: ctx.cwd,
		agentDir,
		settingsManager: services.settingsManager,
	});
	// Wrap with retry for network resilience (methods wrapped via Proxy)
	ctx.packageManager = createRetryingPackageManager(pm);
	return ctx.packageManager;
}

function createRetryingPackageManager(pm: any): any {
	return new Proxy(pm, {
		get(target: any, prop: string | symbol) {
			if (typeof prop === "symbol") return Reflect.get(target, prop);
			const orig = target[prop];
			if (typeof orig === "function" && ["install", "remove", "update", "checkForAvailableUpdates"].includes(prop)) {
				return (...args: any[]) => withRetry(() => orig.apply(target, args));
			}
			return orig;
		},
	});
}

// ============================================================================
// TOOLS
// ============================================================================

export function createListPackagesTool(): ToolDefinition<any, any> {
	return {
		name: "pkg.list",
		label: "Pkg: List",
		description: "List all configured packages",
		parameters: {
			type: "object",
			properties: {
				scope: { type: "string", enum: ["user", "project"], description: "Filter by scope" },
			},
		},
		async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
			try {
				const pm = getOrCreatePackageManager(ctx);
				const configured = pm.listConfiguredPackages();
				const { scope } = params as any;
				const filtered = scope ? configured.filter((p: any) => p.scope === scope) : configured;

				if (filtered.length === 0) {
					return { content: [{ type: "text", text: `No configured packages${scope ? ` (scope: ${scope})` : ''}.` }], details: { count: 0, packages: [] } };
				}

				const lines = filtered.map((p: any) => {
					const path = p.installedPath ? ` → ${p.installedPath.split('/').pop()}` : '';
					return `  ${p.source} (${p.scope})${path} [${p.filtered ? 'filtered' : 'active'}]`;
				});
				return {
					content: [{ type: "text", text: `Configured Packages (${filtered.length}):\n${lines.join("\n")}` }],
					details: { count: filtered.length, packages: filtered },
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

export function createInstallPackageTool(): ToolDefinition<any, any> {
	return {
		name: "pkg.install",
		label: "Pkg: Install",
		description: "Install a package (npm or git)",
		parameters: {
			type: "object",
			properties: {
				source: { type: "string", description: "Package source" },
				persist: { type: "boolean", description: "Add to settings after install" },
			},
			required: ["source"],
		},
		async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
			try {
				const { source, persist = true } = params as { source: string; persist?: boolean };
				const pm = getOrCreatePackageManager(ctx);

				await pmCircuit.execute(() => pm.install(source, { local: persist }));
				if (persist) {
					pm.addSourceToSettings(source, { local: persist });
				}

				return {
					content: [{ type: "text", text: `✅ Installed: ${source}` }],
					details: { source, installed: true, persisted: persist },
				};
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `❌ Install failed: ${e.message}` }],
					isError: true,
					details: { error: e.message, stack: e.stack },
				};
			}
		},
	};
}

export function createRemovePackageTool(): ToolDefinition<any, any> {
	return {
		name: "pkg.remove",
		label: "Pkg: Remove",
		description: "Remove an installed package",
		parameters: {
			type: "object",
			properties: {
				source: { type: "string", description: "Package source to remove" },
				unpersist: { type: "boolean", description: "Also remove from settings" },
			},
			required: ["source"],
		},
		async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
			try {
				const { source, unpersist = true } = params as { source: string; unpersist?: boolean };
				const pm = getOrCreatePackageManager(ctx);

				await pmCircuit.execute(() => pm.remove(source));
				if (unpersist) {
					pm.removeSourceFromSettings(source);
				}

				return {
					content: [{ type: "text", text: `✅ Removed: ${source}` }],
					details: { source, removed: true, unpersisted: unpersist },
				};
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `❌ Remove failed: ${e.message}` }],
					isError: true,
					details: { error: e.message, stack: e.stack },
				};
			}
		},
	};
}

export function createUpdatePackagesTool(): ToolDefinition<any, any> {
	return {
		name: "pkg.update",
		label: "Pkg: Update",
		description: "Update configured packages",
		parameters: {
			type: "object",
			properties: {
				source: { type: "string", description: "Specific package to update (optional)" },
			},
		},
		async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
			try {
				const { source } = params as any;
				const pm = getOrCreatePackageManager(ctx);

				if (source) {
					await pmCircuit.execute(() => pm.update(source));
					return {
						content: [{ type: "text", text: `✅ Updated: ${source}` }],
						details: { source, updated: true },
					};
				} else {
					await pmCircuit.execute(() => pm.update());
					const configured = pm.listConfiguredPackages();
					return {
						content: [{ type: "text", text: `✅ Updated ${configured.length} configured packages` }],
						details: { count: configured.length },
					};
				}
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `❌ Update failed: ${e.message}` }],
					isError: true,
					details: { error: e.message, stack: e.stack },
				};
			}
		},
	};
}

export function createCheckUpdatesTool(): ToolDefinition<any, any> {
	return {
		name: "pkg.updates",
		label: "Pkg: Updates",
		description: "Check for available package updates",
		parameters: {},
		async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
			try {
				const pm = getOrCreatePackageManager(ctx);
				const updates: any = await pmCircuit.execute(() => pm.checkForAvailableUpdates());

				if (updates.length === 0) {
					return { content: [{ type: "text", text: "All packages are up-to-date." }], details: { count: 0, updates: [] } };
				}

				const lines = updates.map((u: any) => `  ${u.displayName} (${u.source}) → ${u.type}`);
				return {
					content: [{ type: "text", text: `Available Updates (${updates.length}):\n${lines.join("\n")}` }],
					details: { count: updates.length, updates },
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
function registerPackageCommands(api: ExtensionAPI): void {
	api.registerCommand("pkg.status", {
		description: "Show package manager status",
		handler: async (_args: string, ctx: any) => {
			try {
				const pm = getOrCreatePackageManager(ctx);
				const configured = pm.listConfiguredPackages();
				ctx.ui.notify?.(
					`Package Manager:\n  Configured: ${configured.length} packages\n  Scope: user + project`,
					"info"
				);
			} catch (e: any) {
				ctx.ui.notify?.(`❌ ${e.message}`, "error");
			}
		},
	});

	api.registerCommand("pkg.upgrade", {
		description: "Update all packages and check for updates",
		handler: async (_args: string, ctx: any) => {
			try {
				const pm = getOrCreatePackageManager(ctx);
				await pm.update();
				const updates = await pm.checkForAvailableUpdates();
				ctx.ui.notify?.(
					updates.length === 0
						? "✅ All packages up-to-date"
						: `⚠️ ${updates.length} packages have updates available`,
					updates.length === 0 ? "success" : "warning"
				);
			} catch (e: any) {
				ctx.ui.notify?.(`❌ Update failed: ${e.message}`, "error");
			}
		},
	});
}

// ============================================================================
// Main Export
// ============================================================================
export function registerPackageManagerExtension(api: ExtensionAPI): void {
	api.registerTool(createListPackagesTool());
	api.registerTool(createInstallPackageTool());
	api.registerTool(createRemovePackageTool());
	api.registerTool(createUpdatePackagesTool());
	api.registerTool(createCheckUpdatesTool());
	registerPackageCommands(api);

	api.sendMessage?.({
		customType: "package-manager",
		content: "📦 Package Manager loaded (with retry + circuit breaker)",
		display: false,
	});
}

export default registerPackageManagerExtension;