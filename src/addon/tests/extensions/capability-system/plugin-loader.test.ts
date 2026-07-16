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
import { PluginLoader } from '../../../extensions/capability-system/plugin-loader.js';

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
