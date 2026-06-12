#!/usr/bin/env node
/**
 * Capability System Extension
 */

import { join } from "path";
import type { Component } from "@earendil-works/pi-tui";
import { Text } from "@earendil-works/pi-tui";
import { PluginLoader, getGlobalLoader, setGlobalLoader } from "./plugin-loader";
import { getCapabilityRegistry } from "./registry";
import { createCapabilityDiscoveryCapability } from "./prompt-integration";

let globalPluginLoader: PluginLoader | null = null;

/**
 * Extension factory.
 */
export default async function capabilitySystemExtension(api: any): Promise<void> {
  console.log("[CapabilitySystem] Initializing...");

  const registry = getCapabilityRegistry();

  globalPluginLoader = new PluginLoader({
    pluginsDir: getPluginsPath(),
    watchMode: isDevMode(),
    onPluginLoaded: (m) => console.log(`[CapabilitySystem] Loaded plugin: ${m.name}`),
    onPluginUnloaded: (id) => console.log(`[CapabilitySystem] Unloaded: ${id}`)
  });

  // Set global loader for test access
  setGlobalLoader(globalPluginLoader);

  try {
    const stats = await globalPluginLoader.loadAll();
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
  api.registerTool(createCapabilityRouterTool());

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
          (comp as any).handleInput = (data: string) => {
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

function createCapabilityRouterTool() {
  return {
    name: "capability",
    label: "Capability Router",
    description: "Execute a capability by ID.",
    promptSnippet: "{ capability: 'plugin.capability', params: {...} }",
    promptGuidelines: [
      "Execute registered capabilities.",
      "Format: { capability: 'plugin.id', params: {...} }",
      "Discover: system.capabilities"
    ],
    parameters: {
      type: "object",
      properties: {
        capability: { type: "string", description: "Capability ID (e.g., 'git.status')" },
        params: { type: "object", description: "Arguments for the capability" }
      },
      required: ["capability", "params"]
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any): Promise<any> {
      const { capability, params: capParams } = params;
      if (!capability) {
        return { content: [{ type: "text" as const, text: "Missing 'capability'" }], isError: true } as any;
      }

      const registry = getCapabilityRegistry();
      const cap = registry.get(capability);

      if (!cap) {
        const suggestions = registry.listAll()
          .filter(c => c.id.includes(capability.split('.').pop() || ''))
          .slice(0, 5).map(c => c.id);
        return {
          content: [{ type: "text" as const, text: `❌ Not found: ${capability}\nSuggestions: ${suggestions.join(', ')}` }],
          isError: true,
          details: { error: "not_found", capability }
        } as any;
      }

      try {
        const enhancedCtx = {
          ...ctx,
          getCurrentCapability: () => cap,
          getCapability: (id: string) => registry.get(id)
        } as any;
        const result = await cap.execute(toolCallId, capParams, signal, onUpdate, enhancedCtx);
        return result as any;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `❌ ${msg}` }], isError: true, details: { error: msg } } as any;
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
