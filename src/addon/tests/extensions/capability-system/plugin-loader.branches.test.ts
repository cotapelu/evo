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

import { existsSync } from 'fs';
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
});
