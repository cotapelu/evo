#!/usr/bin/env node
/**
 * Capability System Extension
 */

import { join, dirname } from "path";
import type { Component } from "@earendil-works/pi-tui";
import { Text } from "@earendil-works/pi-tui";
import { fileURLToPath } from "url";
import { PluginLoader, getGlobalLoader, setGlobalLoader, createPluginLoader } from "./plugin-loader.js";
import { getCapabilityRegistry } from "./registry.js";
import type { Capability } from "./types.js";
import { createCapabilityDiscoveryCapability } from "./prompt-integration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Extension factory.
 */
export default async function capabilitySystemExtension(api: any): Promise<void> {
  console.log("[CapabilitySystem] Initializing...");

  const registry = getCapabilityRegistry();

  // Allow injection of custom loader (for scoped/test usage)
  const customLoader = api?.pluginLoader as PluginLoader | undefined;
  const loader = customLoader || createPluginLoader({
    pluginsDir: getPluginsPath(),
    watchMode: isDevMode(),
    onPluginLoaded: (m) => console.log(`[CapabilitySystem] Loaded plugin: ${m.name}`),
    onPluginUnloaded: (id) => console.log(`[CapabilitySystem] Unloaded: ${id}`)
  });

  // Set global loader only if using default (production) loader
  if (!customLoader) {
    setGlobalLoader(loader);
  }

  // Store reference for this extension instance (for watch mode cleanup if needed)

  try {
    const stats = await loader.loadAll();
    console.log(`[CapabilitySystem] ${stats.totalPlugins} plugins, ${stats.totalCapabilities} capabilities`);
    if (stats.errors.length) console.warn(stats.errors);
  } catch (err) {
    console.error("[CapabilitySystem] Plugin loading failed:", err);
    throw err;
  }

  const discoveryId = 'system.capabilities';
  if (!registry.has(discoveryId)) {
    registry.register(createCapabilityDiscoveryCapability());
  } else {
    console.log('[CapabilitySystem] Discovery capability already registered, skipping');
  }
  api.registerTool(createCapabilityRouterTool(api));

  if (isDevMode() && typeof api.registerCommand === 'function') {
    api.registerCommand('plugins', {
      description: 'List loaded plugins (debug)',
      handler: async (args: string, ctx: any) => {
        const loader = getGlobalLoader();
        if (!loader) { ctx.ui?.notify?.("Not initialized", "error"); return; }

        const stats = loader.getStats();
        const plugins = loader.getLoadedPlugins();
        let out = `📦 Capability System\n${"=".repeat(30)}\n\nPlugins: ${stats.totalPlugins}\nCapabilities: ${stats.totalCapabilities}\n\n`;

        for (const p of plugins) {
          out += `📦 ${p.manifest.name} (${p.manifest.id})\n`;
          for (const c of p.capabilities) {
            out += `  • ${c.name} (${c.id})\n`;
          }
          out += "\n";
        }

        ctx.ui.custom((tui: any, theme: any, kb: any, done: any) => {
          const comp = new Text(out);
          // @ts-ignore
          comp.handleInput = (data: string) => {
            if (data === 'escape' || data === 'ctrl+c') done(undefined);
          };
          return comp as Component;
        });
      }
    });
  }
}

// ============================================================================
// Router Tool
// ============================================================================

function createCapabilityRouterTool(api: any) {
  const registry = getCapabilityRegistry();
  const allCaps = registry.listAll();

  // Group capabilities by plugin for clear presentation
  const byPlugin = new Map<string, Capability[]>();
  for (const cap of allCaps) {
    const pluginCaps = byPlugin.get(cap.pluginId) || [];
    pluginCaps.push(cap);
    byPlugin.set(cap.pluginId, pluginCaps);
  }

  // Build comprehensive guidelines
  const guidelines: string[] = [
    "Execute any registered capability.",
    "First call system.capabilities() to see the full list and get current capabilities.",
    "Then call the specific capability you need.",
    "",
    "Available capabilities by plugin:"
  ];

  // List actual capabilities with IDs and short descriptions
  const sortedPluginIds = Array.from(byPlugin.keys()).sort();
  for (const pluginId of sortedPluginIds) {
    const caps = byPlugin.get(pluginId)!;
    guidelines.push(`\n**${pluginId}** (${caps.length}):`);
    for (const cap of caps) {
      guidelines.push(`- ${cap.id}: ${cap.description}`);
    }
  }

  guidelines.push("");
  guidelines.push("Format: { capability: 'plugin.capability', params: { ... } }");
  guidelines.push("Example: { capability: 'system.capabilities', params: { tag: 'git' } }");

  return {
    name: "capability",
    label: "Capability Router",
    description: `Execute any of ${allCaps.length} registered capabilities across ${byPlugin.size} plugins (git, dev, security, system, etc.). Discover available operations with system.capabilities().`,
    promptSnippet: "{ capability: 'system.capabilities', params: {} }",
    promptGuidelines: guidelines,
    parameters: {
      type: "object",
      properties: {
        capability: { 
          type: "string", 
          description: "Capability ID (e.g., 'git.status', 'dev.test', 'security.scan', 'system.metrics')"
        },
        params: { 
          type: "object", 
          description: "Arguments for the capability (see each capability's schema)"
        }
      },
      required: ["capability", "params"]
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any): Promise<any> {
      const { capability, params: capParams } = params;
      if (!capability) {
        // @ts-ignore
        return { content: [{ type: "text" as const, text: "Missing 'capability'" }], isError: true };
      }

      const registry = getCapabilityRegistry();
      const cap = registry.get(capability);

      if (!cap) {
        const suggestions = registry.listAll()
          .filter(c => c.id.includes(capability.split('.').pop() || ''))
          .slice(0, 5).map(c => c.id);
        // @ts-ignore
        return {
          content: [{ type: "text" as const, text: `❌ Not found: ${capability}\nSuggestions: ${suggestions.join(', ')}` }],
          isError: true,
          details: { error: "not_found", capability }
        };
      }

      try {
        const enhancedCtx = {
          ...ctx,
          exec: async (command: string, args: string[], options: any = {}): Promise<any> => {
            const cwd = options.cwd || ctx.cwd || process.cwd();
            const result = await api.exec(command, args, { ...options, cwd, signal });
            return { code: result.code, stdout: result.stdout, stderr: result.stderr };
          },
          getCurrentCapability: () => cap,
          getCapability: (id: string) => registry.get(id)
        } as any;
        const result = await cap.execute(toolCallId, capParams, signal, onUpdate, enhancedCtx);
        // @ts-ignore
        return result;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        // @ts-ignore
        return { content: [{ type: "text" as const, text: `❌ ${msg}` }], isError: true, details: { error: msg } };
      }
    },

    renderResult: (result: any, options: any, theme: any) => {
      const details = result.details || {};
      const capabilityId = details.capabilityId;
      if (!capabilityId) return new Text(formatResult(result), 0, 0);

      const registry = getCapabilityRegistry();
      const cap = registry.get(capabilityId);
      if (cap?.renderResult) {
        try { return cap.renderResult(result, options, theme); } catch (e) {}
      }
      return new Text(formatResult(result), 0, 0);
    }
  };
}

function formatResult(result: any): string {
  if (result.isError) return result.content?.[0]?.text || 'Error';
  return result.content?.find((c: any) => c.type === 'text')?.text || JSON.stringify(result.details, null, 2);
}

// ============================================================================
// Helpers
// ============================================================================

function getPluginsPath(): string {
  const env = process.env.PICLAW_PLUGINS_DIR;
  if (env) return env;
  // Default: plugins/ folder alongside this extension
  return join(__dirname, "plugins");
}

function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.PICLAW_DEV === '1';
}
