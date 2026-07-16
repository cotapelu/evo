import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('../../../extensions/capability-system/registry.js', () => {
  const mockRegistry = {
    has: vi.fn(),
    register: vi.fn(),
    listAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
  };
  return { getCapabilityRegistry: vi.fn(() => mockRegistry) };
});

vi.mock('../../../extensions/capability-system/prompt-integration.js', () => ({
  createCapabilityDiscoveryCapability: vi.fn(() => ({ id: 'system.capabilities' }))
}));

vi.mock('../../../extensions/capability-system/plugin-loader.js', () => ({
  getGlobalLoader: vi.fn(),
  setGlobalLoader: vi.fn(),
  createPluginLoader: vi.fn(() => ({
    loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
    getStats: vi.fn(),
    getLoadedPlugins: vi.fn(),
  })),
}));

const { getCapabilityRegistry } = await import('../../../extensions/capability-system/registry.js');
const { createCapabilityDiscoveryCapability } = await import('../../../extensions/capability-system/prompt-integration.js');
const { getGlobalLoader, setGlobalLoader, createPluginLoader } = await import('../../../extensions/capability-system/plugin-loader.js');

describe('Capability System Extension', () => {
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    getGlobalLoader.mockReturnValue(null);
    createPluginLoader.mockClear();
    // Reset registry mocks
    const registry = getCapabilityRegistry();
    registry.has.mockReturnValue(false);
    registry.listAll.mockReturnValue([]);
    registry.get.mockReturnValue(undefined);
  });

  it('initializes with default loader and registers tool', async () => {
    mockApi = { registerTool: vi.fn() };
    const ext = await import('../../../extensions/capability-system/extension.ts');
    await ext.default(mockApi);
    expect(createPluginLoader).toHaveBeenCalled();
    expect(setGlobalLoader).toHaveBeenCalled();
    expect(mockApi.registerTool).toHaveBeenCalled();
  });

  it('registers discovery capability when not present', async () => {
    const registry = getCapabilityRegistry();
    registry.has.mockReturnValue(false);
    mockApi = { registerTool: vi.fn() };
    const ext = await import('../../../extensions/capability-system/extension.ts');
    await ext.default(mockApi);
    expect(registry.register).toHaveBeenCalledWith(createCapabilityDiscoveryCapability());
  });

  it('skips discovery capability when already registered', async () => {
    const registry = getCapabilityRegistry();
    registry.has.mockReturnValue(true);
    mockApi = { registerTool: vi.fn() };
    const ext = await import('../../../extensions/capability-system/extension.ts');
    await ext.default(mockApi);
    expect(registry.register).not.toHaveBeenCalled();
  });

  it('does not set global loader when customLoader provided', async () => {
    const customLoader = {
      loadAll: vi.fn().mockResolvedValue({ totalPlugins: 0, totalCapabilities: 0, errors: [] })
    };
    mockApi = { pluginLoader: customLoader, registerTool: vi.fn() };
    const ext = await import('../../../extensions/capability-system/extension.ts');
    await ext.default(mockApi);
    expect(createPluginLoader).not.toHaveBeenCalled();
    expect(setGlobalLoader).not.toHaveBeenCalled();
    expect(customLoader.loadAll).toHaveBeenCalled();
  });

  it('handles loadAll failure and throws', async () => {
    const customLoader = { loadAll: vi.fn().mockRejectedValue(new Error('load failed')) };
    mockApi = { pluginLoader: customLoader, registerTool: vi.fn() };
    const ext = await import('../../../extensions/capability-system/extension.ts');
    await expect(ext.default(mockApi)).rejects.toThrow('load failed');
  });

  it('does not register debug command in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mockApi = { registerCommand: vi.fn(), registerTool: vi.fn() };
    const ext = await import('../../../extensions/capability-system/extension.ts');
    await ext.default(mockApi);
    expect(mockApi.registerCommand).not.toHaveBeenCalled();
    process.env.NODE_ENV = origEnv;
  });
});
