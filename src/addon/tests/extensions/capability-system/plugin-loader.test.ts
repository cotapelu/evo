import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Node's fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  watch: vi.fn(() => ({ close: vi.fn() }))
}));

// Capture registry calls for assertions
let registerCalls: any[][] = [];
let unregisterCalls: any[][] = [];

// Mock the capability registry (relative to src/)
vi.mock('../../../extensions/capability-system/registry.js', () => ({
  getCapabilityRegistry: vi.fn(() => ({
    register: (...args: any[]) => registerCalls.push(args),
    unregister: (...args: any[]) => unregisterCalls.push(args)
  }))
}));

// Mock guideline-generator to avoid heavy logic
vi.mock('../../../extensions/capability-system/guideline-generator.js', () => ({
  generateCapabilityGuidelines: vi.fn(() => ['Guideline']),
  extractMinimalParams: vi.fn(() => ({}))
}));

import { existsSync, readdirSync, readFileSync } from 'fs';
import { PluginLoader, setGlobalLoader, getGlobalLoader, waitForInitialization } from '../../../extensions/capability-system/plugin-loader.js';

// Helper to build a valid plugin manifest
const makeManifest = (
  id: string,
  caps: any[] = [{ id: 'test', execute: 'exec.js', inputSchema: {}, outputSchema: {} }]
) => ({
  id,
  name: id,
  version: '1.0.0',
  description: 'desc',
  capabilities: caps
});

describe('PluginLoader', () => {
  let pluginsDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    registerCalls = [];
    unregisterCalls = [];

    pluginsDir = '/tmp/plugins';

    // By default, all existence checks return true (plugins dir and manifests exist)
    (existsSync as any).mockReturnValue(true);
    (readdirSync as any).mockReturnValue([
      { name: 'plugina', isDirectory: vi.fn().mockReturnValue(true) },
      { name: 'pluginb', isDirectory: vi.fn().mockReturnValue(true) }
    ]);
    (readFileSync as any).mockImplementation((filePath: string) => {
      if (filePath.endsWith('plugina/manifest.json')) {
        return JSON.stringify(makeManifest('plugina'));
      }
      if (filePath.endsWith('pluginb/manifest.json')) {
        return JSON.stringify(
          makeManifest('pluginb', [{ id: 'other', execute: 'other.js', inputSchema: {}, outputSchema: {} }])
        );
      }
      return '';
    });
  });

  function createLoader(options: any = {}) {
    return new PluginLoader({
      pluginsDir,
      watchMode: false,
      onPluginLoaded: () => {},
      onPluginUnloaded: () => {},
      ...options
    });
  }

  describe('loadAll', () => {
    it('returns empty stats if plugins directory does not exist', async () => {
      (existsSync as any).mockReturnValue(false);
      const loader = createLoader();
      const stats = await loader.loadAll();
      expect(stats.totalPlugins).toBe(0);
      expect(stats.totalCapabilities).toBe(0);
    });

    it('returns empty stats if no plugin folders found', async () => {
      (readdirSync as any).mockReturnValue([]);
      const loader = createLoader();
      const stats = await loader.loadAll();
      expect(stats.totalPlugins).toBe(0);
      expect(stats.totalCapabilities).toBe(0);
    });

    it('loads plugins and registers their capabilities', async () => {
      const loader = createLoader();
      // Prevent actual file imports by mocking dynamicImport
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn(), default: vi.fn() });

      const stats = await loader.loadAll();

      expect(stats.errors).toHaveLength(0);
      expect(stats.totalPlugins).toBe(2);
      expect(stats.totalCapabilities).toBe(2);
      expect(registerCalls).toHaveLength(2);
      expect(loader.getLoadedPlugins()).toHaveLength(2);
    });

    it('captures errors when a manifest cannot be read', async () => {
      (readFileSync as any).mockImplementation((p: string) => {
        if (p.endsWith('plugina/manifest.json')) {
          return JSON.stringify(makeManifest('plugina'));
        }
        throw new Error('ENOENT');
      });
      const loader = createLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });

      const stats = await loader.loadAll();

      expect(stats.totalPlugins).toBe(1);
      expect(stats.totalCapabilities).toBe(1);
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0].pluginId).toBe('pluginb');
    });

    it('rejects a plugin with zero capabilities as an error', async () => {
      (readdirSync as any).mockReturnValue([
        { name: 'plugina', isDirectory: vi.fn().mockReturnValue(true) }
      ]);
      (readFileSync as any).mockImplementation((p: string) => {
        if (p.endsWith('plugina/manifest.json')) {
          return JSON.stringify({ ...makeManifest('plugina'), capabilities: [] });
        }
        return '';
      });
      const loader = createLoader();
      const dynSpy = vi.spyOn(loader as any, 'dynamicImport');

      const stats = await loader.loadAll();

      // Plugin is invalid (no capabilities) and should be counted as an error
      expect(stats.totalPlugins).toBe(0);
      expect(stats.totalCapabilities).toBe(0);
      expect(registerCalls).toHaveLength(0);
      expect(dynSpy).not.toHaveBeenCalled();
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0].pluginId).toBe('plugina');
    });
  });

  describe('loadPlugin', () => {
    it('throws if the manifest file is missing', async () => {
      const loader = createLoader();
      // Override: manifest does not exist
      (existsSync as any).mockReturnValue(false);
      await expect(loader.loadPlugin('pluginx')).rejects.toThrow('Missing manifest.json');
    });

    it('validates the manifest and throws on invalid fields', async () => {
      // Make pluginbad/manifest.json exist and contain invalid data
      (existsSync as any).mockImplementation(
        (p: string) => p === pluginsDir || p.endsWith('pluginbad/manifest.json')
      );
      (readdirSync as any).mockReturnValue([
        { name: 'pluginbad', isDirectory: vi.fn().mockReturnValue(true) }
      ]);
      (readFileSync as any).mockReturnValue(JSON.stringify({})); // empty, invalid

      const loader = createLoader();
      await expect(loader.loadPlugin('pluginbad')).rejects.toThrow("Missing 'id'");
    });
  });

  describe('getStats', () => {
    it('returns correct aggregated stats after loading', async () => {
      const loader = createLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });

      await loader.loadAll();

      const stats = loader.getStats();
      expect(stats.totalPlugins).toBe(2);
      expect(stats.totalCapabilities).toBe(2);
      expect(stats.errors).toHaveLength(0);
    });
  });

  describe('getLoadedPlugins', () => {
    it('returns an array of loaded plugin info', async () => {
      const loader = createLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });

      await loader.loadAll();

      const plugins = loader.getLoadedPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0]).toHaveProperty('manifest');
      expect(plugins[0]).toHaveProperty('capabilities');
      expect(plugins[0].capabilities).toHaveLength(1);
    });
  });

  describe('unloadPlugin', () => {
    it('removes a plugin and unregisters its capabilities', async () => {
      const loader = createLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });

      await loader.loadAll();

      const before = loader.getLoadedPlugins();
      const pluginId = before[0].manifest.id;
      const capId = before[0].capabilities[0].id;

      loader.unloadPlugin(pluginId);

      expect(loader.getLoadedPlugins()).toHaveLength(1);
      expect(unregisterCalls.some(c => c[0] === capId)).toBe(true);
    });

    it('does nothing if the plugin is not loaded', async () => {
      const loader = createLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });

      await loader.loadAll();

      unregisterCalls = [];
      loader.unloadPlugin('nonexistent');
      expect(unregisterCalls).toHaveLength(0);
    });
  });

  describe('waitForLoad', () => {
    it('resolves immediately with stats if already loaded', async () => {
      const loader = createLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });

      await loader.loadAll();

      const stats = await loader.waitForLoad();
      expect(stats).toEqual(loader.getStats());
    });


  });

  // Additional branch coverage tests

  describe('Constructor defaults', () => {
    it('uses default options when none provided', () => {
      const loader = new PluginLoader({});
      const opts = (loader as any).options;
      expect(opts.pluginsDir).toBeTruthy();
      expect(opts.watchMode).toBe(false);
      expect(typeof opts.onPluginLoaded).toBe('function');
      expect(typeof opts.onPluginUnloaded).toBe('function');
    });
  });

  describe('loadAll caching', () => {
    it('returns cached result after completed load', async () => {
      const loader = createLoader();
      const performSpy = vi.spyOn(loader as any, 'performLoadAll').mockResolvedValue({
        totalPlugins: 0,
        totalCapabilities: 0,
        loadTimeMs: 0,
        errors: []
      });
      const stats1 = await loader.loadAll();
      expect(performSpy).toHaveBeenCalledTimes(1);
      const stats2 = await loader.loadAll();
      expect(performSpy).toHaveBeenCalledTimes(1);
      expect(stats2).toEqual(stats1);
    });

    it('concurrent loadAll calls share the same promise', async () => {
      const loader = createLoader();
      const performSpy = vi.spyOn(loader as any, 'performLoadAll').mockImplementation(
        async () => {
          await new Promise(res => setTimeout(res, 10));
          return { totalPlugins: 0, totalCapabilities: 0, loadTimeMs: 0, errors: [] };
        }
      );
      const p1 = loader.loadAll();
      const p2 = loader.loadAll();
      // Both calls should share the same internal loadPromise, so performLoadAll is invoked only once
      await p1;
      await p2;
      expect(performSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('watchMode', () => {
    it('calls startWatchMode when watchMode is true', async () => {
      const loader = createLoader({ watchMode: true });
      const startWatchSpy = vi.spyOn(loader as any, 'startWatchMode').mockImplementation(() => {});
      const dynSpy = vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });
      await loader.loadAll();
      expect(startWatchSpy).toHaveBeenCalled();
    });
  });

  describe('validateManifest additional checks', () => {
    let loader: PluginLoader;
    beforeEach(() => {
      loader = createLoader();
    });

    it('throws if name missing', () => {
      const manifest = { id: 'test', description: 'desc', version: '1.0.0', capabilities: [] } as any;
      expect(() => (loader as any).validateManifest(manifest, 'test')).toThrow("Missing 'name'");
    });

    it('throws if description missing', () => {
      const manifest = { id: 'test', name: 'Test', version: '1.0.0', capabilities: [] } as any;
      expect(() => (loader as any).validateManifest(manifest, 'test')).toThrow("Missing 'description'");
    });

    it('throws if version missing', () => {
      const manifest = { id: 'test', name: 'Test', description: 'desc', capabilities: [] } as any;
      expect(() => (loader as any).validateManifest(manifest, 'test')).toThrow("Missing 'version'");
    });

    it('throws if capabilities missing', () => {
      const manifest = { id: 'test', name: 'Test', description: 'desc', version: '1.0.0' } as any;
      expect(() => (loader as any).validateManifest(manifest, 'test')).toThrow("Missing 'capabilities'");
    });

    it('throws if plugin ID invalid format', () => {
      const manifest = { id: 'Invalid!', name: 'Test', description: 'desc', version: '1.0.0', capabilities: [] } as any;
      expect(() => (loader as any).validateManifest(manifest, 'test')).toThrow('Invalid plugin ID');
    });

    it('throws if capability missing id or execute', () => {
      const manifest = { id: 'test', name: 'Test', description: 'desc', version: '1.0.0', capabilities: [{}] } as any;
      expect(() => (loader as any).validateManifest(manifest, 'test')).toThrow("Capability missing id/execute");
    });
  });

  describe('loadExecuteModule', () => {
    it('throws if module lacks execute function', async () => {
      const loader = createLoader();
      const dynSpy = vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({});
      await expect(loader.loadExecuteModule('/some/path.js')).rejects.toThrow('Missing execute function');
    });
  });

  describe('loadRendererModule', () => {
    it('returns undefined if renderer file does not exist', async () => {
      const loader = createLoader();
      (existsSync as any).mockReturnValue(false);
      const result = await (loader as any).loadRendererModule('/some/renderer.js');
      expect(result).toBeUndefined();
    });
  });
});

// ===== Additional Branch Coverage Tests =====

// Helper to create a loader instance with default options
function createTestLoader(overrides: any = {}) {
  const pluginsDir = '/tmp/plugins';
  return new PluginLoader({
    pluginsDir,
    watchMode: false,
    onPluginLoaded: () => {},
    onPluginUnloaded: () => {},
    ...overrides
  });
}

describe('Additional branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: directories exist
    (existsSync as any).mockReturnValue(true);
  });

  describe('createExecuteHandler error handling', () => {
    it('returns error result when executeFn throws', async () => {
      const loader = createTestLoader();
      const capabilityId = 'test.cap';
      const executeFn = async () => { throw new Error('execution failed'); };
      const handler = (loader as any).createExecuteHandler(capabilityId, executeFn);
      const result = await handler('callId', {}, null, null, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('execution failed');
      expect(result.details.error).toContain('execution failed');
      expect(result.details.capabilityId).toBe(capabilityId);
    });
  });

  describe('buildCapability', () => {
    it('includes renderResult when provided', () => {
      const loader = createTestLoader();
      const capMan = { id: 'cap', name: 'Cap', description: 'desc', inputSchema: {}, outputSchema: {} } as any;
      const pluginMan = { id: 'plugin', tags: [], version: '1.0.0' } as any;
      const executeFn = async () => ({ content: [] });
      const renderResultFn = vi.fn();
      const capability = (loader as any).buildCapability(
        'plugin',
        capMan,
        pluginMan,
        executeFn,
        renderResultFn,
        'plugin.cap',
        ['guideline'],
        'snippet'
      );
      expect(capability.renderResult).toBe(renderResultFn);
    });

    it('omits renderResult when not provided', () => {
      const loader = createTestLoader();
      const capability = (loader as any).buildCapability(
        'plugin',
        { id: 'cap', name: 'Cap', description: 'desc', inputSchema: {}, outputSchema: {} } as any,
        { id: 'plugin', tags: [], version: '1.0.0' } as any,
        async () => ({ content: [] }),
        undefined,
        'plugin.cap',
        ['guideline'],
        'snippet'
      );
      expect(capability.renderResult).toBeUndefined();
    });
  });

  describe('waitForInitialization', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('throws if global loader not set', async () => {
      await expect(waitForInitialization()).rejects.toThrow('Capability system not initialized');
    });

    it('resolves when global loader is set', async () => {
      const mockLoader = { waitForLoad: vi.fn().mockResolvedValue(undefined) };
      setGlobalLoader(mockLoader as any);
      await waitForInitialization();
      expect(mockLoader.waitForLoad).toHaveBeenCalled();
    });
  });

  describe('loadPlugin duplicate handling', () => {
    it('unloads existing plugin before reloading same plugin', async () => {
      const loader = createTestLoader();
      vi.spyOn(loader as any, 'dynamicImport').mockResolvedValue({ execute: vi.fn() });
      (readFileSync as any).mockImplementation((path: string) => {
        if (path.endsWith('dup/manifest.json')) {
          return JSON.stringify(makeManifest('dup'));
        }
        return '';
      });
      // First load
      await (loader as any).loadPlugin('dup');
      // Spy on unloadPlugin
      const unloadSpy = vi.spyOn(loader as any, 'unloadPlugin');
      // Second load
      await (loader as any).loadPlugin('dup');
      expect(unloadSpy).toHaveBeenCalledWith('dup');
    });
  });

  describe('loadCapabilities errors', () => {
    it('propagates errors from createCapability', async () => {
      const loader = createTestLoader();
      const manifest = {
        id: 'plugin',
        name: 'Plugin',
        version: '1.0.0',
        description: 'desc',
        capabilities: [
          { id: 'cap1', execute: 'cap1.js', inputSchema: {}, outputSchema: {} },
        ],
      } as any;
      const createCapSpy = vi
        .spyOn(loader as any, 'createCapability')
        .mockRejectedValue(new Error('cap1 failed'));
      await expect((loader as any).loadCapabilities('plugin', '/tmp', manifest)).rejects.toThrow(
        "Capability 'cap1' failed: cap1 failed"
      );
    });
  });

  describe('loadRendererModule', () => {
    it('returns undefined if import fails', async () => {
      const loader = createTestLoader();
      (existsSync as any).mockReturnValue(true);
      const dynSpy = vi.spyOn(loader as any, 'dynamicImport').mockRejectedValue(new Error('import error'));
      const result = await (loader as any).loadRendererModule('/some/renderer.js');
      expect(result).toBeUndefined();
      dynSpy.mockRestore();
    });
  });

  describe('Timer-based methods', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    describe('scheduleNewPluginLoad', () => {
      it('loads plugin after debounce if manifest exists', async () => {
        const loader = createTestLoader();
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        (existsSync as any).mockReturnValue(true);
        (loader as any).scheduleNewPluginLoad('newplugin');
        // Before timer
        expect(loadSpy).not.toHaveBeenCalled();
        // Advance timer
        await vi.runAllTimersAsync();
        expect(loadSpy).toHaveBeenCalledWith('newplugin');
      });

      it('warns if manifest missing after delay', async () => {
        const loader = createTestLoader();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (existsSync as any).mockReturnValue(false);
        (loader as any).scheduleNewPluginLoad('newplugin');
        await vi.runAllTimersAsync();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Manifest not found'));
        warnSpy.mockRestore();
      });

      it('debounces multiple calls', async () => {
        const loader = createTestLoader();
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        (existsSync as any).mockReturnValue(true);
        (loader as any).scheduleNewPluginLoad('newplugin');
        (loader as any).scheduleNewPluginLoad('newplugin'); // reset timer
        await vi.runAllTimersAsync();
        expect(loadSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('scheduleReload', () => {
      it('reloads plugin after debounce if still loaded', async () => {
        const loader = createTestLoader();
        const fakePlugin = { manifest: { id: 'test' }, capabilities: [] } as any;
        (loader as any).loadedPlugins.set('test', fakePlugin);
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        (loader as any).scheduleReload('test');
        expect(loadSpy).not.toHaveBeenCalled();
        await vi.runAllTimersAsync();
        expect(loadSpy).toHaveBeenCalledWith('test');
        (loader as any).loadedPlugins.delete('test');
      });

      it('does not reload if plugin no longer loaded after timer', async () => {
        const loader = createTestLoader();
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        // Ensure plugin not loaded
        (loader as any).loadedPlugins.clear();
        (loader as any).scheduleReload('test');
        await vi.runAllTimersAsync();
        expect(loadSpy).not.toHaveBeenCalled();
      });

      it('debounces multiple calls', async () => {
        const loader = createTestLoader();
        const fakePlugin = { manifest: { id: 'test' }, capabilities: [] } as any;
        (loader as any).loadedPlugins.set('test', fakePlugin);
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        (loader as any).scheduleReload('test');
        (loader as any).scheduleReload('test');
        await vi.runAllTimersAsync();
        expect(loadSpy).toHaveBeenCalledTimes(1);
        (loader as any).loadedPlugins.delete('test');
      });
    });
  });

  describe('clearAllTimers', () => {
    it('clears all reload and new plugin timers', () => {
      const loader = createTestLoader();
      const timer1 = setTimeout(() => {}, 1000) as any;
      const timer2 = setTimeout(() => {}, 1000) as any;
      (loader as any).reloadTimers.set('a', timer1);
      (loader as any).newPluginTimers.set('b', timer2);
      (loader as any).clearAllTimers();
      expect((loader as any).reloadTimers.size).toBe(0);
      expect((loader as any).newPluginTimers.size).toBe(0);
    });
  });

  describe('closeAllWatchers', () => {
    it('closes all watchers and root watcher', () => {
      const loader = createTestLoader();
      const close1 = vi.fn();
      const close2 = vi.fn();
      const rootClose = vi.fn();
      (loader as any).watchHandles.set('p1', { close: close1 });
      (loader as any).watchHandles.set('p2', { close: close2 });
      (loader as any).rootWatcher = { close: rootClose };
      (loader as any).closeAllWatchers();
      expect(close1).toHaveBeenCalled();
      expect(close2).toHaveBeenCalled();
      expect(rootClose).toHaveBeenCalled();
      expect((loader as any).watchHandles.size).toBe(0);
      // rootWatcher reference remains but is closed (implementation does not null it)
      expect((loader as any).rootWatcher).toEqual({ close: rootClose });
    });
  });

  describe('unloadAll', () => {
    it('calls clearAllTimers, unloadAllPlugins, closeAllWatchers', () => {
      const loader = createTestLoader();
      const clearTimersSpy = vi.spyOn(loader as any, 'clearAllTimers');
      const unloadAllPluginsSpy = vi.spyOn(loader as any, 'unloadAllPlugins');
      const closeAllWatchersSpy = vi.spyOn(loader as any, 'closeAllWatchers');
      (loader as any).unloadAll();
      expect(clearTimersSpy).toHaveBeenCalled();
      expect(unloadAllPluginsSpy).toHaveBeenCalled();
      expect(closeAllWatchersSpy).toHaveBeenCalled();
    });
  });
});

