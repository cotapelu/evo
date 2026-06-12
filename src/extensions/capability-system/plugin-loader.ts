#!/usr/bin/env node
/**
 * Plugin Loader
 */

import { existsSync, readFileSync, readdirSync, watch } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type {
  PluginManifest,
  PluginLoaderOptions,
  LoadedPlugin,
  Capability,
  PluginLoaderStats,
  CapabilityManifest
} from "./types.js";
import { getCapabilityRegistry } from "./registry.js";
import { MANIFEST_FILENAME } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PluginLoader {
  private options: Required<PluginLoaderOptions>;
  private registry = getCapabilityRegistry();
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private resolveCache: Map<string, { module: any; timestamp: number }> = new Map();
  private watchHandles: Map<string, { close: () => void }> = new Map();
  private rootWatcher: { close: () => void } | null = null;
  private loadPromise: Promise<PluginLoaderStats> | null = null;
  private isLoaded = false;

  constructor(options: PluginLoaderOptions = {}) {
    this.options = {
      pluginsDir: options.pluginsDir || join(__dirname, "..", "..", "plugins"),
      watchMode: options.watchMode || false,
      onPluginLoaded: options.onPluginLoaded || (() => {}),
      onPluginUnloaded: options.onPluginUnloaded || (() => {})
    };
  }

  async loadAll(): Promise<PluginLoaderStats> {
    if (this.isLoaded) {
      return this.getStats();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const stats = await this.performLoadAll();
        this.isLoaded = true;
        return stats;
      } catch (error) {
        this.loadPromise = null; // Allow retry
        throw error;
      }
    })();

    return this.loadPromise;
  }

  private async performLoadAll(): Promise<PluginLoaderStats> {
    const errors: Array<{ pluginId: string; error: string }> = [];
    const pluginsDir = resolve(this.options.pluginsDir);

    if (!existsSync(pluginsDir)) {
      return { totalPlugins: 0, totalCapabilities: 0, loadTimeMs: 0, errors: [] };
    }

    const pluginFolders = readdirSync(pluginsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const folder of pluginFolders) {
      try {
        await this.loadPlugin(folder);
      } catch (err: any) {
        errors.push({ pluginId: folder, error: err.message });
      }
    }

    if (this.options.watchMode) this.startWatchMode(pluginsDir);

    const totalCapabilities = Array.from(this.loadedPlugins.values()).reduce((s, p) => s + p.capabilities.length, 0);

    return {
      totalPlugins: this.loadedPlugins.size,
      totalCapabilities,
      loadTimeMs: 0,
      errors
    };
  }

  /**
   * Wait for the initial plugin load to complete.
   * Returns a promise that resolves with stats when loading finishes.
   * If already loaded, returns a resolved promise with current stats.
   */
  waitForLoad(): Promise<PluginLoaderStats> {
    if (this.isLoaded) {
      return Promise.resolve(this.getStats());
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    return this.loadAll();
  }

  async loadPlugin(pluginFolder: string): Promise<LoadedPlugin> {
    const pluginPath = join(this.options.pluginsDir, pluginFolder);
    const manifestPath = join(pluginPath, MANIFEST_FILENAME);

    if (!existsSync(manifestPath)) throw new Error(`Missing ${MANIFEST_FILENAME}`);

    const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    this.validateManifest(manifest, pluginFolder);

    if (this.loadedPlugins.has(manifest.id)) {
      this.unloadPlugin(manifest.id);
    }

    const capabilities: Capability[] = [];
    for (const capMan of manifest.capabilities) {
      try {
        const capability = await this.createCapability(pluginFolder, pluginPath, capMan, manifest);
        capabilities.push(capability);
      } catch (err: any) {
        throw new Error(`Capability '${capMan.id}' failed: ${err.message}`);
      }
    }

    const loaded: LoadedPlugin = {
      manifest,
      capabilities,
      reload: async () => {
        this.unloadPlugin(manifest.id);
        return this.loadPlugin(pluginFolder);
      },
      unload: () => this.unloadPlugin(manifest.id)
    };

    this.loadedPlugins.set(manifest.id, loaded);
    for (const cap of capabilities) {
      this.registry.register(cap);
    }

    this.options.onPluginLoaded(manifest);
    return loaded;
  }

  private async createCapability(
    pluginId: string,
    pluginPath: string,
    capMan: CapabilityManifest,
    pluginMan: PluginManifest
  ): Promise<Capability> {
    const executePath = join(pluginPath, capMan.execute);
    const rendererPath = capMan.renderer ? join(pluginPath, capMan.renderer) : null;

    const executeModule = await this.dynamicImport(executePath);
    const executeFn: any = executeModule.execute || executeModule.default;
    if (typeof executeFn !== "function") throw new Error("Missing execute function");

    let renderResultFn: Capability["renderResult"] = undefined;
    if (rendererPath && existsSync(rendererPath)) {
      try {
        const rendererModule = await this.dynamicImport(rendererPath);
        renderResultFn = rendererModule.renderResult || rendererModule.default;
      } catch {}
    }

    const capabilityId = `${pluginMan.id}.${capMan.id}`;

    return {
      id: capabilityId,
      name: capMan.name,
      description: capMan.description,
      pluginId,
      promptSnippet: `{ capability: '${capabilityId}', params: {...} }`,
      promptGuidelines: [...capMan.promptGuidelines, `Call: { capability: '${capabilityId}', params: {...} }`],
      parameters: capMan.inputSchema,
      outputSchema: capMan.outputSchema,
      execute: (toolCallId: string, params: Record<string, any>, signal: AbortSignal | null | undefined, onUpdate: ((data: any) => void) | null | undefined, ctx: any) => {
        return executeFn(params, ctx).then((result: any) => ({
          ...result,
          details: { ...result.details, capabilityId }
        } as any)).catch((error: unknown) => ({
          content: [{ type: "text" as const, text: `❌ ${capabilityId} error: ${error instanceof Error ? error.message : String(error)}` }],
          details: { error: error instanceof Error ? error.message : String(error), capabilityId },
          isError: true
        }));
      },
      ...(renderResultFn && { renderResult: renderResultFn }),
      tags: pluginMan.tags,
      dependencies: capMan.dependencies,
      permissions: capMan.permissions
    };
  }

  private async dynamicImport(filePath: string): Promise<any> {
    const fileUrl = `file://${filePath}`;
    const cached = this.resolveCache.get(fileUrl);
    if (cached) return cached.module;

    const module = await import(fileUrl);
    this.resolveCache.set(fileUrl, { module, timestamp: Date.now() });
    return module;
  }

  private startWatchMode(pluginsDir: string): void {
    const pluginFolders = readdirSync(pluginsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const folder of pluginFolders) {
      const pluginPath = join(pluginsDir, folder);
      this.watchSinglePlugin(pluginPath, folder);
    }

    this.rootWatcher = watch(pluginsDir, { recursive: false }, (event: string, filename: string | null) => {
      if (filename && event === 'rename') {
        const newPath = join(pluginsDir, filename);
        if (existsSync(join(newPath, MANIFEST_FILENAME))) {
          this.loadPlugin(filename).catch(console.error);
        }
      }
    });
  }

  private watchSinglePlugin(pluginPath: string, pluginFolder: string): void {
    const watcher = watch(pluginPath, { recursive: true }, (event: string, filename: string | null) => {
      if (!filename) return;
      if (filename.includes('node_modules') || filename.includes('.git')) return;

      const manifestPath = join(pluginPath, MANIFEST_FILENAME);
      if (filename === MANIFEST_FILENAME && (event === 'change' || event === 'rename')) {
        this.loadPlugin(pluginFolder).catch(console.error);
        return;
      }

      this.resolveCache.clear();
    });

    this.watchHandles.set(pluginFolder, { close: () => watcher.close() });
  }

  private validateManifest(manifest: any, pluginFolder: string): void {
    const required = ["id", "name", "description", "version", "capabilities"];
    for (const field of required) {
      if (!manifest[field]) throw new Error(`Missing '${field}'`);
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(manifest.id)) throw new Error(`Invalid plugin ID: ${manifest.id}`);
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) throw new Error("At least one capability required");
    for (const cap of manifest.capabilities) {
      if (!cap.id || !cap.execute) throw new Error("Capability missing id/execute");
      if (!/^[a-z][a-z0-9_-]*$/.test(cap.id)) throw new Error(`Invalid capability ID: ${cap.id}`);
    }
  }

  unloadAll(): void {
    for (const [pluginId] of this.loadedPlugins) {
      this.unloadPlugin(pluginId);
    }
    this.resolveCache.clear();
    for (const handle of this.watchHandles.values()) handle.close();
    this.watchHandles.clear();
    this.rootWatcher?.close();
  }

  getStats(): PluginLoaderStats {
    const totalCapabilities = Array.from(this.loadedPlugins.values()).reduce((sum, p) => sum + p.capabilities.length, 0);
    return { totalPlugins: this.loadedPlugins.size, totalCapabilities, loadTimeMs: 0, errors: [] };
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  private unloadPlugin(pluginId: string): void {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return;

    for (const cap of plugin.capabilities) {
      this.registry.unregister(cap.id);
    }
    this.loadedPlugins.delete(pluginId);
    this.options.onPluginUnloaded(pluginId);
  }
}

export function createPluginLoader(options?: PluginLoaderOptions): PluginLoader {
  return new PluginLoader(options);
}

let globalLoader: PluginLoader | null = null;
export function setGlobalLoader(loader: PluginLoader): void { globalLoader = loader; }
export function getGlobalLoader(): PluginLoader | null { return globalLoader; }

export default PluginLoader;
