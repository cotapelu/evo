// plugin-manager.ts - Plugin System for EvoAgent
// Allows dynamic loading and management of plugins/extensions

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  hooks: {
    onBeforeEvolve?: (agent: any, context: any) => Promise<void> | void;
    onAfterEvolve?: (agent: any, context: any) => Promise<void> | void;
    onMessage?: (agent: any, message: any) => Promise<void> | void;
    onGoalCompleted?: (agent: any, goal: any) => Promise<void> | void;
    onHealthCheck?: (agent: any, health: any) => Promise<void> | void;
    onIterationStart?: (agent: any, iteration: number) => Promise<void> | void;
    onIterationEnd?: (agent: any, iteration: number, success: boolean) => Promise<void> | void;
  };
  lifecycle: {
    initialize?: () => Promise<void> | void;
    shutdown?: () => Promise<void> | void;
  };
  state?: Record<string, any>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private enabled: Set<string> = new Set();
  private agent: any; // Will be set by EvoAgent

  constructor(agent?: any) {
    this.agent = agent;
  }

  setAgent(agent: any): void {
    this.agent = agent;
  }

  register(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin ${plugin.id} already registered`);
      return false;
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          console.warn(`[PluginManager] Plugin ${plugin.id} missing dependency: ${dep}`);
          return false;
        }
      }
    }

    this.plugins.set(plugin.id, plugin);
    console.log(`[PluginManager] Plugin registered: ${plugin.name} (${plugin.id}) v${plugin.version}`);
    return true;
  }

  enable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.error(`[PluginManager] Cannot enable unknown plugin: ${pluginId}`);
      return false;
    }

    if (this.enabled.has(pluginId)) {
      console.warn(`[PluginManager] Plugin ${pluginId} already enabled`);
      return false;
    }

    // Initialize plugin
    try {
      if (plugin.lifecycle.initialize) {
        plugin.lifecycle.initialize();
      }
      this.enabled.add(pluginId);
      console.log(`[PluginManager] Plugin enabled: ${pluginId}`);
      return true;
    } catch (error) {
      console.error(`[PluginManager] Failed to initialize plugin ${pluginId}:`, error);
      return false;
    }
  }

  disable(pluginId: string): boolean {
    if (!this.enabled.has(pluginId)) {
      return true;
    }

    const plugin = this.plugins.get(pluginId);
    try {
      if (plugin?.lifecycle.shutdown) {
        plugin.lifecycle.shutdown();
      }
      this.enabled.delete(pluginId);
      console.log(`[PluginManager] Plugin disabled: ${pluginId}`);
      return true;
    } catch (error) {
      console.error(`[PluginManager] Error disabling plugin ${pluginId}:`, error);
      return false;
    }
  }

  getEnabled(): Plugin[] {
    return Array.from(this.enabled).map(id => this.plugins.get(id)!).filter(Boolean);
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  // Load plugins from a directory (Iteration 109)
  async loadFromDirectory(dirPath: string): Promise<number> {
    try {
      const { readdirSync, statSync } = await import('fs');
      const { join, resolve } = await import('path');
      
      const absPath = resolve(dirPath);
      if (!statSync(absPath).isDirectory()) {
        console.warn('[PluginManager] Not a directory:', absPath);
        return 0;
      }
      
      const files = readdirSync(absPath).filter(f => f.endsWith('.js') && !f.includes('.test'));
      let loadedCount = 0;
      
      for (const file of files) {
        try {
          const filePath = join(absPath, file);
          const pluginModule = await import(('file://' + filePath));
          const plugin = pluginModule.default || pluginModule.plugin;
          if (plugin && this.register(plugin)) {
            this.enable(plugin.id);
            loadedCount++;
          }
        } catch (e) {
          console.error(`[PluginManager] Failed to load plugin from ${file}:`, e);
        }
      }
      
      console.log(`[PluginManager] Loaded ${loadedCount} plugins from ${absPath}`);
      return loadedCount;
    } catch (error) {
      console.error('[PluginManager] Error loading plugins from directory:', error);
      return 0;
    }
  }

  async triggerHook(hookName: keyof Plugin['hooks'], context: any): Promise<void> {
    for (const pluginId of this.enabled) {
      const plugin = this.plugins.get(pluginId);
      const hook = plugin?.hooks[hookName];
      if (hook) {
        try {
          await (hook as any)(this.agent, context);
        } catch (error) {
          console.error(`[PluginManager] Hook ${hookName} failed in plugin ${pluginId}:`, error);
        }
      }
    }
  }

  // Built-in plugins
  static createEventPlugin(): Plugin {
    return {
      id: 'event-driven',
      name: 'Event Driven Architecture',
      version: '1.0.0',
      description: 'Adds event publishing/subscribing capabilities',
      hooks: {
        onMessage: async (agent, message) => {
          // Could trigger events based on message type
        }
      },
      lifecycle: {
        initialize() {
          console.log('[Plugin:event-driven] Initialized event system');
        }
      }
    };
  }

  static createMetricsPlugin(): Plugin {
    return {
      id: 'metrics-collector',
      name: 'Metrics Collector',
      version: '1.0.0',
      description: ' Collects and reports system metrics',
      hooks: {
        onIterationEnd: async (agent, iteration, success) => {
          const mem = process.memoryUsage().heapUsed / 1024 / 1024;
          console.log(`[Metrics] Iteration ${iteration}: ${mem.toFixed(2)} MB, success: ${success}`);
        }
      },
      lifecycle: {
        initialize() {
          console.log('[Plugin:metrics-collector] Metrics collection started');
        }
      }
    };
  }

  static createCachingPlugin(): Plugin {
    return {
      id: 'caching',
      name: 'Caching Layer',
      version: '1.0.0',
      description: 'Provides in-memory caching for expensive operations',
      state: {
        cache: new Map<string, { value: any; timestamp: number; ttl: number }>()
      },
      hooks: {
        onBeforeEvolve: async (agent, context) => {
          // Could cache analysis results
        }
      },
      lifecycle: {
        initialize() {
          console.log('[Plugin:caching] Caching layer initialized');
        },
        shutdown() {
          console.log('[Plugin:caching] Caching layer shutdown');
        }
      }
    };
  }
}
