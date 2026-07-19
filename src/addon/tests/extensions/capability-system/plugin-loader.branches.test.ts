import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Node's fs module (only existsSync needed for most)
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  watch: vi.fn(() => ({ close: vi.fn() }))
}));

// Mock the capability registry
vi.mock('../../../extensions/capability-system/registry.js', () => ({
  getCapabilityRegistry: vi.fn(() => ({
    register: vi.fn(),
    unregister: vi.fn()
  }))
}));

// Mock guideline-generator to avoid heavy logic
vi.mock('../../../extensions/capability-system/guideline-generator.js', () => ({
  generateCapabilityGuidelines: vi.fn(() => ['Guideline']),
  extractMinimalParams: vi.fn(() => ({}))
}));

import { existsSync, readdirSync, readFileSync } from 'fs';
import { PluginLoader } from '../../../extensions/capability-system/plugin-loader.js';

function createLoader() {
  return new PluginLoader({
    pluginsDir: '/tmp/plugins',
    watchMode: false,
    onPluginLoaded: () => {},
    onPluginUnloaded: () => {}
  });
}

describe('PluginLoader branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (existsSync as any).mockReturnValue(true);
  });

  describe('loadAll error handling', () => {
    it('resets loadPromise and propagates error when performLoadAll throws', async () => {
      const loader = createLoader();
      const error = new Error('performLoadAll failure');
      const performSpy = vi.spyOn(loader as any, 'performLoadAll').mockRejectedValue(error);

      const promise = loader.loadAll();
      await expect(promise).rejects.toThrow('performLoadAll failure');
      expect((loader as any).loadPromise).toBeNull();

      performSpy.mockRestore();
    });
  });

  describe('createCapability with renderer', () => {
    const pluginMan = {
      id: 'plugin',
      name: 'Plugin',
      description: 'desc',
      version: '1.0.0',
      tags: []
    };
    const baseCapMan = {
      id: 'test',
      execute: 'exec.js',
      inputSchema: {},
      outputSchema: {}
    };

    it('includes renderResult when renderer present and module exports it', async () => {
      const loader = createLoader();
      const capMan = { ...baseCapMan, renderer: 'renderer.js' };

      const execSpy = vi.spyOn(loader as any, 'loadExecuteModule').mockResolvedValue({ executeFn: vi.fn() });
      const rendererSpy = vi.spyOn(loader as any, 'loadRendererModule').mockResolvedValue(vi.fn());

      const result = await (loader as any).createCapability('pluginId', '/plugins/plugin', capMan, pluginMan);

      expect(execSpy).toHaveBeenCalledWith('/plugins/plugin/exec.js');
      expect(rendererSpy).toHaveBeenCalledWith('/plugins/plugin/renderer.js');
      expect(result.renderResult).toBeDefined();
      expect(typeof result.renderResult).toBe('function');

      execSpy.mockRestore();
      rendererSpy.mockRestore();
    });

    it('omits renderResult when renderer present but module returns undefined', async () => {
      const loader = createLoader();
      const capMan = { ...baseCapMan, renderer: 'renderer.js' };

      vi.spyOn(loader as any, 'loadExecuteModule').mockResolvedValue({ executeFn: vi.fn() });
      const rendererSpy = vi.spyOn(loader as any, 'loadRendererModule').mockResolvedValue(undefined);

      const result = await (loader as any).createCapability('pluginId', '/plugins/plugin', capMan, pluginMan);

      expect(result.renderResult).toBeUndefined();
      rendererSpy.mockRestore();
    });

    it('does not call loadRendererModule when no renderer specified', async () => {
      const loader = createLoader();
      const capMan = { ...baseCapMan };

      const execSpy = vi.spyOn(loader as any, 'loadExecuteModule').mockResolvedValue({ executeFn: vi.fn() });
      const rendererSpy = vi.spyOn(loader as any, 'loadRendererModule');

      const result = await (loader as any).createCapability('pluginId', '/plugins/plugin', capMan, pluginMan);

      expect(rendererSpy).not.toHaveBeenCalled();
      expect(result.renderResult).toBeUndefined();

      execSpy.mockRestore();
      rendererSpy.mockRestore();
    });
  });

  describe('loadRendererModule branches', () => {
    it('returns undefined when file does not exist', async () => {
      const loader = createLoader();
      (existsSync as any).mockReturnValue(false);
      const result = await (loader as any).loadRendererModule('/nonexistent.js');
      expect(result).toBeUndefined();
    });

    it('returns undefined when dynamicImport throws', async () => {
      const loader = createLoader();
      const dynImportSpy = vi.spyOn(loader as any, 'dynamicImport').mockRejectedValue(new Error('import error'));

      const result = await (loader as any).loadRendererModule('/some/renderer.js');
      expect(result).toBeUndefined();

      dynImportSpy.mockRestore();
    });
  });

  describe('buildCapability spread', () => {
    it('includes renderResult when truthy', () => {
      const loader = createLoader();
      const cap = (loader as any).buildCapability(
        'pluginId',
        { id: 'cap', inputSchema: {}, outputSchema: {} },
        { id: 'plugin', tags: [] },
        vi.fn(),
        vi.fn(), // renderResultFn
        'capId',
        ['Guideline'],
        'snippet'
      );
      expect(cap.renderResult).toBeDefined();
    });

    it('omits renderResult when undefined', () => {
      const loader = createLoader();
      const cap = (loader as any).buildCapability(
        'pluginId',
        { id: 'cap', inputSchema: {}, outputSchema: {} },
        { id: 'plugin', tags: [] },
        vi.fn(),
        undefined,
        'capId',
        ['Guideline'],
        'snippet'
      );
      expect(cap.renderResult).toBeUndefined();
    });
  });

  describe('PluginLoader additional branches (Round 230)', () => {
    let loader: PluginLoader;

    beforeEach(() => {
      vi.clearAllMocks();
      (existsSync as any).mockReturnValue(true);
      (readdirSync as any).mockReturnValue([]);
      const validManifest = JSON.stringify({
        id: 'test',
        name: 'Test',
        description: 'desc',
        version: '1.0.0',
        capabilities: [{ id: 'cap', execute: 'exec.js', inputSchema: {}, outputSchema: {} }]
      });
      (readFileSync as any).mockReturnValue(validManifest);
      loader = new PluginLoader({ pluginsDir: '/tmp/plugins', watchMode: false });
    });

    afterEach(() => {
      try {
        (loader as any).clearAllTimers?.();
      } catch {}
    });

    describe('getPluginFolders', () => {
      it('filters out non-directory entries', () => {
        (readdirSync as any).mockReturnValue([
          { name: 'validDir', isDirectory: () => true },
          { name: 'file.txt', isDirectory: () => false }
        ]);
        const folders = (loader as any).getPluginFolders('/tmp');
        expect(folders).toEqual(['validDir']);
      });
    });

    describe('loadPlugin error handling', () => {
      it('throws when manifest file missing', async () => {
        (existsSync as any).mockReturnValue(false);
        await expect(loader.loadPlugin('myplugin')).rejects.toThrow('Missing manifest.json');
      });

      it('propagates errors from createCapability', async () => {
        (existsSync as any).mockReturnValue(true);
        (readFileSync as any).mockReturnValue(JSON.stringify({
          id: 'plug',
          name: 'Plug',
          description: 'desc',
          version: '1.0.0',
          capabilities: [{ id: 'cap', execute: 'exec.js', inputSchema: {}, outputSchema: {} }]
        }));
        const createCapSpy = vi.spyOn(loader as any, 'createCapability').mockRejectedValue(new Error('cap error'));
        await expect(loader.loadPlugin('plug')).rejects.toThrow('Capability');
        createCapSpy.mockRestore();
      });
    });

    describe('scheduleNewPluginLoad', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('debounces multiple calls and loads after delay if manifest exists', async () => {
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        (loader as any).scheduleNewPluginLoad('newplug');
        (loader as any).scheduleNewPluginLoad('newplug');
        expect((loader as any).newPluginTimers.size).toBe(1);
        await vi.advanceTimersByTimeAsync(400);
        expect(loadSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(200);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(loadSpy).toHaveBeenCalledWith('newplug');
      });

      it('warns and does not load if manifest missing after delay', async () => {
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (loader as any).scheduleNewPluginLoad('newplug');
        (existsSync as any).mockReturnValue(false);
        await vi.advanceTimersByTimeAsync(500);
        expect(loadSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Manifest not found'));
        warnSpy.mockRestore();
      });
    });

    describe('scheduleReload', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('debounces and calls loadPlugin if plugin still loaded', async () => {
        (loader as any).loadedPlugins.set('p1', { manifest: { id: 'p1' }, capabilities: [], reload: vi.fn(), unload: vi.fn() });
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin').mockResolvedValue({} as any);
        (loader as any).scheduleReload('p1');
        (loader as any).scheduleReload('p1');
        expect((loader as any).reloadTimers.size).toBe(1);
        await vi.advanceTimersByTimeAsync(200);
        expect(loadSpy).toHaveBeenCalledWith('p1');
      });

      it('does nothing if plugin not loaded', async () => {
        const loadSpy = vi.spyOn(loader as any, 'loadPlugin');
        (loader as any).scheduleReload('unknown');
        await vi.advanceTimersByTimeAsync(200);
        expect(loadSpy).not.toHaveBeenCalled();
      });
    });

    describe('unloadPlugin', () => {
      it('handles non-existent plugin gracefully', () => {
        expect(() => (loader as any).unloadPlugin('nonexistent')).not.toThrow();
      });

      it('cleans up loaded plugin correctly', () => {
        const cap: any = {
          id: 'p1.c1', // full capability ID
          pluginId: 'p1',
          name: 'Cap',
          description: '',
          parameters: {},
          outputSchema: {}
        };
        const plugin: any = {
          manifest: { id: 'p1' },
          capabilities: [cap],
          reload: vi.fn(),
          unload: vi.fn()
        };
        (loader as any).loadedPlugins.set('p1', plugin);
        (loader as any).reloadTimers.set('p1', setTimeout(() => {}, 1000) as any);
        (loader as any).watchHandles.set('p1', { close: vi.fn() });
        const registry = (loader as any).registry;
        const unregisterSpy = vi.spyOn(registry, 'unregister');
        const onUnload = vi.fn();
        loader.options.onPluginUnloaded = onUnload;
        (loader as any).unloadPlugin('p1');
        expect((loader as any).loadedPlugins.has('p1')).toBe(false);
        expect(unregisterSpy).toHaveBeenCalledWith('p1.c1');
        expect((loader as any).reloadTimers.has('p1')).toBe(false);
        expect((loader as any).watchHandles.has('p1')).toBe(false);
        expect(onUnload).toHaveBeenCalledWith('p1');
      });
    });

    describe('waitForLoad', () => {
      it('calls loadAll when not loaded and no pending load', async () => {
        const loadAllSpy = vi.spyOn(loader as any, 'loadAll').mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, loadTimeMs: 0, errors: [] } as any);
        await (loader as any).waitForLoad();
        expect(loadAllSpy).toHaveBeenCalled();
      });
    });
  });
});
