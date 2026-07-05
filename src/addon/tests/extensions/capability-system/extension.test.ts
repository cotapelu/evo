import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependency
vi.mock('@earendil-works/pi-tui', () => {
  return {
    Container: class Container { addChild() {} clear() {} },
    Text: class Text { constructor(...args: any[]) {} },
    truncateToWidth: vi.fn().mockReturnValue('truncated')
  };
});

// Mock plugin-loader
vi.mock('../../../extensions/capability-system/plugin-loader.ts', () => {
  const MockPluginLoader = class PluginLoader {
    async loadAll() {
      return { totalPlugins: 1, totalCapabilities: 2, errors: [] };
    }
    getStats() {
      return { totalPlugins: 1, totalCapabilities: 2, errors: [] };
    }
    getLoadedPlugins() {
      return [];
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

// Mock registry
vi.mock('../../../extensions/capability-system/registry.ts', () => ({
  getCapabilityRegistry: vi.fn(() => ({
    has: vi.fn(),
    register: vi.fn(),
    listAll: vi.fn().mockReturnValue([]),
    get: vi.fn()
  }))
}));

// Mock prompt-integration
vi.mock('../../../extensions/capability-system/prompt-integration.ts', () => ({
  createCapabilityDiscoveryCapability: vi.fn().mockReturnValue({ id: 'system.capabilities' })
}));

// Import the extension after all mocks
import capabilitySystemExtension from '../../../extensions/capability-system/extension.ts';
import { setGlobalLoader, createPluginLoader } from '../../../extensions/capability-system/plugin-loader.ts';
import { getCapabilityRegistry } from '../../../extensions/capability-system/registry.ts';

describe('Capability System Extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test'; // ensure dev mode detection
  });

  it('uses customLoader if provided and skips default creation', async () => {
    const customLoader = {
      loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
      getStats: () => ({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
      getLoadedPlugins: () => []
    };
    const api = { pluginLoader: customLoader, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    expect(customLoader.loadAll).toHaveBeenCalled();
    expect(createPluginLoader).not.toHaveBeenCalled();
    expect(setGlobalLoader).not.toHaveBeenCalled();
  });

  it('creates default loader when no customLoader provided', async () => {
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    expect(createPluginLoader).toHaveBeenCalled();
  });

  it('sets global loader when using default loader', async () => {
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    expect(setGlobalLoader).toHaveBeenCalled();
  });

  it('registers discovery capability only if not already registered', async () => {
    const registry = {
      has: vi.fn(),
      register: vi.fn(),
      listAll: vi.fn().mockReturnValue([])
    };
    vi.mocked(getCapabilityRegistry).mockReturnValue(registry as any);
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    // Not registered
    (registry.has as any).mockReturnValueOnce(false);
    await capabilitySystemExtension(api);
    expect(registry.register).toHaveBeenCalledWith({ id: 'system.capabilities' });

    vi.clearAllMocks();
    (registry.has as any).mockReturnValueOnce(true);
    await capabilitySystemExtension(api);
    expect(registry.register).not.toHaveBeenCalled();
  });

  it('registers the capability router tool', async () => {
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    expect(api.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'capability',
        label: 'Capability Router',
        description: expect.any(String),
        promptSnippet: expect.any(String),
        promptGuidelines: expect.any(Array),
        parameters: expect.any(Object),
        execute: expect.any(Function)
      })
    );
  });

  it('does not register debug plugins command in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    expect(api.registerCommand).not.toHaveBeenCalled();
  });

  it('registers debug plugins command in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    expect(api.registerCommand).toHaveBeenCalledWith(
      'plugins',
      expect.objectContaining({
        description: 'List loaded plugins (debug)',
        handler: expect.any(Function)
      })
    );
  });

  it('debug plugins handler displays list', async () => {
    process.env.NODE_ENV = 'development';
    const mockRegistry = {
      has: vi.fn(),
      register: vi.fn(),
      listAll: vi.fn().mockReturnValue([
        { id: 'test.cap', name: 'Test', description: 'A test capability', pluginId: 'test.plugin' }
      ])
    };
    vi.mocked(getCapabilityRegistry).mockReturnValue(mockRegistry as any);

    const mockLoader = {
      getStats: () => ({ totalPlugins: 1, totalCapabilities: 1, errors: [] }),
      getLoadedPlugins: () => [{ manifest: { name: 'TestPlugin', id: 'test.plugin' }, capabilities: [] }]
    };
    const { setGlobalLoader } = await import('../../../extensions/capability-system/plugin-loader.ts');
    setGlobalLoader(mockLoader as any);

    const ctx = {
      ui: {
        custom: vi.fn((fn: any) => ({ render: () => [], invalidate: () => {} }))
      }
    };
    const api = { pluginLoader: undefined, registerTool: vi.fn(), registerCommand: vi.fn() };

    await capabilitySystemExtension(api);

    let handler: any;
    for (const call of (api.registerCommand as any).mock.calls) {
      if (call[0] === 'plugins') handler = call[1].handler;
    }
    expect(handler).toBeDefined();

    await handler('', ctx);
    expect(ctx.ui.custom).toHaveBeenCalled();
  });
});
