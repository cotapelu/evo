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
import { generateCapabilityGuidelines, extractMinimalParams } from "./guideline-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PluginLoader {
  private options: Required<PluginLoaderOptions>;
  private registry = getCapabilityRegistry();
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private resolveCache: Map<string, { module: any; timestamp: number }> = new Map();
  private watchHandles: Map<string, { close: () => void }> = new Map();
  private reloadTimers: Map<string, NodeJS.Timeout> = new Map();
  private newPluginTimers: Map<string, NodeJS.Timeout> = new Map();
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

    // Set up file watcher for this plugin if watch mode is enabled
    if (this.options.watchMode) {
      this.watchSinglePlugin(pluginPath, pluginFolder);
    }

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

    const capabilityIdFull = capabilityId;

    // Generate smart guidelines from schema + custom guidelines from manifest
    const finalGuidelines = generateCapabilityGuidelines(
      capabilityIdFull,
      capMan.inputSchema,
      capMan.outputSchema,
      capMan.promptGuidelines || []
    );

    // Generate snippet from minimal example
    const minimalParams = extractMinimalParams(capMan.inputSchema);
    const promptSnippet = JSON.stringify({
      capability: capabilityIdFull,
      params: minimalParams
    }, null, 2);

    return {
      id: capabilityIdFull,
      name: capMan.name,
      description: capMan.description,
      pluginId,
      promptSnippet,
      promptGuidelines: finalGuidelines,
      parameters: capMan.inputSchema,
      outputSchema: capMan.outputSchema,
      execute: (toolCallId: string, params: Record<string, any>, signal: AbortSignal | null | undefined, onUpdate: ((data: any) => void) | null | undefined, ctx: any) => {
        // @ts-ignore
        return executeFn(params, ctx).then((result: any) => ({
          ...result,
          details: { ...result.details, capabilityId }
        })).catch((error: unknown) => ({
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

    // Clear own cache first
    if (this.resolveCache.has(fileUrl)) {
      this.resolveCache.delete(fileUrl);
    }

    // Clear Node.js ESM module cache to enable hot-reload of execute files
    // This uses internal API (module._cache) but is necessary for development
    try {
      const mod = await import('module');
      // @ts-ignore - accessing internal ESM cache
      const esmCache = mod._cache;
      if (esmCache && esmCache[fileUrl]) {
        delete esmCache[fileUrl];
      }
    } catch {
      // Ignore if internal cache not accessible
    }

    const module = await import(fileUrl);
    this.resolveCache.set(fileUrl, { module, timestamp: Date.now() });
    return module;
  }

  private startWatchMode(pluginsDir: string): void {
    // Root watcher to detect new plugin folders and deletions
    this.rootWatcher = watch(pluginsDir, { recursive: false }, (event: string, filename: string | null) => {
      if (!filename) return;
      if (event !== 'rename') return;

      const pluginPath = join(pluginsDir, filename);
      const pluginExists = existsSync(pluginPath);
      if (pluginExists) {
        // New plugin folder created - schedule load with debounce to wait for manifest
        this.scheduleNewPluginLoad(filename);
      } else {
        // Plugin folder was deleted
        this.unloadPlugin(filename);
      }
    });
  }

  private scheduleNewPluginLoad(pluginFolder: string): void {
    // Clear any pending load for this plugin
    const existing = this.newPluginTimers.get(pluginFolder);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.newPluginTimers.delete(pluginFolder);
      const pluginPath = join(this.options.pluginsDir, pluginFolder);
      const manifestPath = join(pluginPath, MANIFEST_FILENAME);

      // Only load if manifest exists now
      if (existsSync(manifestPath)) {
        try {
          await this.loadPlugin(pluginFolder);
        } catch (err) {
          console.error(`[PluginLoader] Delayed load failed for ${pluginFolder}:`, err);
        }
      } else {
        console.warn(`[PluginLoader] Manifest not found for ${pluginFolder} after delay, skipping`);
      }
    }, 500); // 500ms debounce allows file system operations to complete

    this.newPluginTimers.set(pluginFolder, timer);
  }

  private watchSinglePlugin(pluginPath: string, pluginFolder: string): void {
    const watcher = watch(pluginPath, { recursive: true }, (event: string, filename: string | null) => {
      if (!filename) return;
      if (filename.includes('node_modules') || filename.includes('.git')) return;

      // Clear module cache for this plugin before reload to ensure fresh imports
      this.resolveCache.clear();
      // Debounce reload to avoid flooding on rapid changes
      this.scheduleReload(pluginFolder);
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
    // Clear all pending reload timers
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();

    // Clear all pending new plugin load timers
    for (const timer of this.newPluginTimers.values()) {
      clearTimeout(timer);
    }
    this.newPluginTimers.clear();

    // Unload all plugins (collect keys first to avoid mutation during iteration)
    const pluginIds = Array.from(this.loadedPlugins.keys());
    for (const pluginId of pluginIds) {
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

  private scheduleReload(pluginId: string): void {
    // Clear any pending reload
    const existing = this.reloadTimers.get(pluginId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.reloadTimers.delete(pluginId);
      if (this.loadedPlugins.has(pluginId)) {
        this.loadPlugin(pluginId).catch(err => console.error(`[PluginLoader] Reload failed for ${pluginId}:`, err));
      }
    }, 200); // 200ms debounce

    this.reloadTimers.set(pluginId, timer);
  }

  private unloadPlugin(pluginId: string): void {
    // Clear any pending reload timer
    const timer = this.reloadTimers.get(pluginId);
    if (timer) {
      clearTimeout(timer);
      this.reloadTimers.delete(pluginId);
    }

    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return;

    // Close its file watcher
    const handle = this.watchHandles.get(pluginId);
    if (handle) {
      handle.close();
      this.watchHandles.delete(pluginId);
    }

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

/**
 * Helper for tests: wait until the capability system has finished loading plugins.
 * Throws if the system was not initialized (extensionsAggregator not yet run).
 */
export async function waitForInitialization(): Promise<void> {
  const loader = getGlobalLoader();
  if (!loader) {
    throw new Error("Capability system not initialized. Ensure the capabilitySystemExtension has been called.");
  }
  await loader.waitForLoad();
}

export default PluginLoader;
