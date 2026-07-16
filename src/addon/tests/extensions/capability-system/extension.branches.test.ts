import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external dependencies BEFORE importing module
vi.mock('@earendil-works/pi-tui', () => {
  const MockContainer = class Container {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); }
    clear() { this.children = []; }
    invalidate() {}
  };
  const MockText = class Text {
    text = '';
    constructor(text?: string, x?: number, y?: number) { this.text = text || ''; }
    setText(text: string) { this.text = text; }
  };
  const truncateToWidth = vi.fn().mockReturnValue({ visualLines: ['line'], skippedCount: 0 });
  return { Container: MockContainer, Text: MockText, truncateToWidth };
});

vi.mock('../../../extensions/capability-system/plugin-loader.ts', () => {
  const MockPluginLoader = class PluginLoader {
    async loadAll() {
      return { totalPlugins: 1, totalCapabilities: 2, errors: [] };
    }
    getStats() {
      return { totalPlugins: 1, totalCapabilities: 2, errors: [] };
    }
    getLoadedPlugins() {
      return [{ manifest: { name: 'TestPlugin', id: 'test.plugin' }, capabilities: [] }];
    }
  };
  let globalLoader: any = null;
  return {
    PluginLoader: MockPluginLoader,
    getGlobalLoader: vi.fn(() => globalLoader),
    setGlobalLoader: vi.fn((loader: any) => { globalLoader = loader; }),
    createPluginLoader: vi.fn().mockImplementation(() => new MockPluginLoader())
  };
});

vi.mock('../../../extensions/capability-system/registry.ts', () => ({
  getCapabilityRegistry: vi.fn(() => ({
    has: vi.fn().mockReturnValue(false),
    register: vi.fn(),
    listAll: vi.fn().mockReturnValue([]),
    get: vi.fn()
  }))
}));

vi.mock('../../../extensions/capability-system/prompt-integration.ts', () => ({
  createCapabilityDiscoveryCapability: vi.fn().mockReturnValue({ id: 'system.capabilities' })
}));

import { truncateToWidth } from '@earendil-works/pi-tui';
import { Text } from '@earendil-works/pi-tui';
import capabilitySystemExtension from '../../../extensions/capability-system/extension.ts';
import { getCapabilityRegistry } from '../../../extensions/capability-system/registry.ts';
import { setGlobalLoader, createPluginLoader } from '../../../extensions/capability-system/plugin-loader.ts';

// Helper to get the registered router tool
async function getRouterTool(): Promise<any> {
  const mockRegistry = (getCapabilityRegistry() as any);
  const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
  await capabilitySystemExtension(api);
  const calls = (api.registerTool as any).mock.calls;
  return calls[calls.length - 1][0];
}

describe('Capability System Extension - Branch Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Factory - Loader & Registry', () => {
    it('re-throws when loadAll rejects', async () => {
      const mockLoader = {
        loadAll: vi.fn().mockRejectedValue(new Error('load error')),
        getStats: () => ({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
        getLoadedPlugins: () => []
      };
      vi.mocked(createPluginLoader).mockReturnValue(mockLoader as any);

      const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
      await expect(capabilitySystemExtension(api)).rejects.toThrow('load error');
    });

    it('logs warnings from loadAll stats', async () => {
      const mockLoader = {
        loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: ['warn'] }),
        getStats: () => ({ totalPlugins: 0, totalCapabilities: 0, errors: ['warn'] }),
        getLoadedPlugins: () => []
      };
      vi.mocked(createPluginLoader).mockReturnValue(mockLoader as any);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
      await capabilitySystemExtension(api);

      expect(warnSpy).toHaveBeenCalledWith(['warn']);
      warnSpy.mockRestore();
    });

    it('skips setGlobalLoader when customLoader provided', async () => {
      const customLoader = { loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] }), getStats: () => ({ totalPlugins: 0, totalCapabilities: 0, errors: [] }), getLoadedPlugins: () => [] };
      const api = { pluginLoader: customLoader, registerTool: vi.fn(), registerCommand: vi.fn() };
      await capabilitySystemExtension(api);
      expect(setGlobalLoader).not.toHaveBeenCalled();
    });

    it('sets global loader when default loader used', async () => {
      const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
      await capabilitySystemExtension(api);
      expect(setGlobalLoader).toHaveBeenCalled();
    });

    it('does not register discovery capability if already registered', async () => {
      const registry = { has: vi.fn(), register: vi.fn(), listAll: vi.fn().mockReturnValue([]) };
      vi.mocked(getCapabilityRegistry).mockReturnValue(registry as any);
      (registry.has as any).mockReturnValueOnce(true);
      const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
      await capabilitySystemExtension(api);
      expect(registry.register).not.toHaveBeenCalled();
    });

    it('registers debug plugins command only in NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
      await capabilitySystemExtension(api);
      expect(api.registerCommand).toHaveBeenCalledWith('plugins', expect.any(Object));

      process.env.NODE_ENV = 'production';
      const api2 = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };
      await capabilitySystemExtension(api2);
      expect(api2.registerCommand).not.toHaveBeenCalled();
    });
  });

  describe('Router Tool - execute', () => {
    let tool: any;
    let mockRegistry: any;

    beforeEach(async () => {
      mockRegistry = { has: vi.fn().mockReturnValue(false), register: vi.fn(), listAll: vi.fn().mockReturnValue([]), get: vi.fn() };
      vi.mocked(getCapabilityRegistry).mockReturnValue(mockRegistry);
      tool = await getRouterTool();
    });

    it('returns error when capability param missing', async () => {
      const res = await tool.execute('id', {}, undefined, undefined, {});
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Missing 'capability'");
    });

    it('returns not_found error with suggestions when unknown', async () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      mockRegistry.listAll = vi.fn().mockReturnValue([
        { id: 'git.status', name: 'Status', pluginId: 'git', tags: [] },
        { id: 'git.commit', name: 'Commit', pluginId: 'git', tags: [] }
      ]);

      const res = await tool.execute('id', { capability: 'git.st' }, undefined, undefined, {});
      expect(res.isError).toBe(true);
      expect(res.details.error).toBe('not_found');
      expect(res.content[0].text).toContain('git.status');
    });

    it('attaches capabilityId to successful result', async () => {
      const exec = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'OK' }] });
      mockRegistry.get = vi.fn().mockReturnValue({ id: 'c', name: 'Cap', execute: exec });

      const res = await tool.execute('id', { capability: 'c', params: {} }, undefined, undefined, {});

      expect(res.details.capabilityId).toBe('c');
    });

    it('handles thrown non-Error values', async () => {
      mockRegistry.get = vi.fn().mockReturnValue({ id: 'c', name: 'Cap', execute: vi.fn().mockRejectedValue('oops') });

      const res = await tool.execute('id', { capability: 'c', params: {} }, undefined, undefined, {});

      expect(res.isError).toBe(true);
      expect(res.details.error).toBe('oops');
      expect(res.details.capabilityId).toBe('c');
    });

    it('passes signal and onUpdate through', async () => {
      const exec = vi.fn().mockResolvedValue({ content: [] });
      mockRegistry.get = vi.fn().mockReturnValue({ id: 'c', name: 'Cap', execute: exec });
      const sig = { aborted: false };
      const onUpd = vi.fn();

      await tool.execute('id', { capability: 'c', params: {} }, sig, onUpd, {});

      expect(exec).toHaveBeenCalledWith('id', {}, sig, onUpd, expect.any(Object));
    });

    it('enhanced context provides capability methods', async () => {
      const exec = vi.fn().mockImplementation(async (_, __, ___, ____, ctx: any) => {
        expect(typeof ctx.getCapability).toBe('function');
        expect(typeof ctx.listCapabilitiesByTag).toBe('function');
        expect(typeof ctx.getCurrentCapability).toBe('function');
        await expect(ctx.callCapability('x', {})).rejects.toThrow('not supported');
        return { content: [{ type: 'text', text: 'OK' }] };
      });
      mockRegistry.get = vi.fn().mockReturnValue({ id: 'c', name: 'Cap', execute: exec });

      await tool.execute('id', { capability: 'c', params: {} }, undefined, undefined, {});
    });
  });

  describe('Router Tool - renderCall', () => {
    let tool: any;
    let mockRegistry: any;

    beforeEach(async () => {
      mockRegistry = { has: vi.fn().mockReturnValue(false), register: vi.fn(), listAll: vi.fn().mockReturnValue([]), get: vi.fn() };
      vi.mocked(getCapabilityRegistry).mockReturnValue(mockRegistry);
      tool = await getRouterTool();
    });

    it('returns Text with formatted command (friendly name)', () => {
      mockRegistry.get = vi.fn().mockImplementation((id: string) => (id === 'git.status' ? { id, name: 'Git Status' } : null));
      const args = { capability: 'git.status', params: {} };
      const theme = { fg: vi.fn().mockReturnValue('styled'), bold: (s: string) => s };
      const comp = tool.renderCall(args, theme, { lastComponent: undefined });

      expect(comp).toBeInstanceOf(Text);
      expect(theme.fg).toHaveBeenCalledWith('toolTitle', expect.stringMatching(/\$ Git Status/));
    });

    it('formats params (arrays, objects)', () => {
      const args = { capability: 'test', params: { list: ['a','b'], opt: {x:1} } };
      const theme = { fg: vi.fn().mockReturnValue(''), bold: (s)=>s };
      tool.renderCall(args, theme, { lastComponent: undefined });

      const cmd = theme.fg.mock.lastCall[1];
      expect(cmd).toContain('list: a, b');
      expect(cmd).toContain('opt: {"x":1}');
    });

    it('handles missing capability gracefully (uses id as name)', () => {
      const args = { capability: 'unknown' };
      const theme = { fg: vi.fn().mockReturnValue(''), bold: (s)=>s };
      tool.renderCall(args, theme, { lastComponent: undefined });

      expect(theme.fg).toHaveBeenCalledWith('toolTitle', expect.stringMatching(/\$ unknown/));
    });
  });

  describe('Router Tool - renderResult', () => {
    let tool: any;
    let mockRegistry: any;

    beforeEach(async () => {
      mockRegistry = { has: vi.fn().mockReturnValue(false), register: vi.fn(), listAll: vi.fn().mockReturnValue([]), get: vi.fn() };
      vi.mocked(getCapabilityRegistry).mockReturnValue(mockRegistry);
      tool = await getRouterTool();
    });

    it('uses custom renderer', () => {
      const cap = { renderResult: vi.fn().mockReturnValue({ custom: true }) };
      mockRegistry.get = vi.fn().mockReturnValue(cap);
      const result = { content: [{ type: 'text', text: 'OK' }], details: { capabilityId: 'c' } };
      const rendered = tool.renderResult(result, { isPartial: false }, {}, { lastComponent: undefined, state: {}, invalidate: vi.fn() });
      expect(cap.renderResult).toHaveBeenCalled();
      expect(rendered).toEqual({ custom: true });
    });

    it('fallback when custom renderer throws', () => {
      const cap = { renderResult: vi.fn().mockImplementation(() => { throw new Error('fail'); }) };
      mockRegistry.get = vi.fn().mockReturnValue(cap);
      const theme = { fg: vi.fn().mockReturnValue('') };
      const rendered = tool.renderResult({ content: [{ type: 'text', text: 'OK' }], details: { capabilityId: 'c' } }, { isPartial: false }, theme, { lastComponent: undefined, state: {}, invalidate: vi.fn() });
      expect(rendered).toBeDefined();
      expect(rendered.clear).toBeDefined();
    });

    it('expanded adds Text child with styled output', () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      const result = { content: [{ type: 'text', text: 'Hello\nWorld' }], details: {} };
      const theme = { fg: vi.fn().mockReturnValue('colored') };
      const context = { lastComponent: undefined, state: {}, invalidate: vi.fn(), isError: false };
      const comp = tool.renderResult(result, { isPartial: false, expanded: true }, theme, context);
      expect(comp.children.length).toBeGreaterThan(0);
    });

    it('not expanded: adds render child and populates cache after render', () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      const result = { content: [{ type: 'text', text: 'A'.repeat(500) }], details: {} };
      const theme = { fg: vi.fn().mockReturnValue('colored') };
      const context = { lastComponent: undefined, state: {}, invalidate: vi.fn(), isError: false };
      const comp = tool.renderResult(result, { isPartial: false, expanded: false }, theme, context);
      // The render child is added; retrieve it
      const renderChild = comp.children.find(c => typeof c.render === 'function');
      expect(renderChild).toBeDefined();
      // Initial state should be empty
      expect(comp.state.cachedLines).toBeUndefined();
      // Invoke render to trigger truncation and cache population
      renderChild.render(80);
      // After render, state should have cachedLines set (branch executed)
      expect(comp.state.cachedLines).toBeDefined();
      expect(comp.state.cachedSkipped).toBeDefined();
    });

    it('sets interval on first partial when startedAt is set', () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      const result = { content: [{ type: 'text', text: 'OK' }], details: {} };
      const theme = { fg: vi.fn().mockReturnValue('') };
      const context = { lastComponent: undefined, state: { startedAt: Date.now() - 100, interval: undefined, endedAt: undefined }, invalidate: vi.fn(), isError: false };
      tool.renderResult(result, { isPartial: true }, theme, context);
      expect(context.state.interval).toBeDefined();
    });

    it('does not start another interval if already running', () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      const theme = { fg: vi.fn().mockReturnValue('') };
      const context = { lastComponent: undefined, state: { startedAt: Date.now(), interval: 123, endedAt: undefined }, invalidate: vi.fn(), isError: false };
      tool.renderResult({}, { isPartial: true }, theme, context);
      expect(context.state.interval).toBe(123);
    });

    it('clears interval and sets endedAt when finished (isPartial false)', () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      const theme = { fg: vi.fn().mockReturnValue('') };
      const context = { lastComponent: undefined, state: { interval: 123, endedAt: undefined }, invalidate: vi.fn(), isError: false };
      tool.renderResult({}, { isPartial: false }, theme, context);
      expect(context.state.interval).toBeUndefined();
      expect(context.state.endedAt).toBeDefined();
    });

    it('clears interval and sets endedAt on error (isError true)', () => {
      mockRegistry.get = vi.fn().mockReturnValue(null);
      const theme = { fg: vi.fn().mockReturnValue('') };
      const context = { lastComponent: undefined, state: { interval: 456, endedAt: undefined }, invalidate: vi.fn(), isError: true };
      tool.renderResult({}, { isPartial: true }, theme, context);
      expect(context.state.interval).toBeUndefined();
      expect(context.state.endedAt).toBeDefined();
    });
  });
});

// Spy on clearInterval globally to avoid errors (Node will still call it)
beforeAll(() => {
  vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
});
