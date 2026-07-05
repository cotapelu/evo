import { vi, describe, it, expect } from 'vitest';

// Mock external dependencies BEFORE importing extension
vi.mock('@earendil-works/pi-tui', () => ({
  Container: class Container { addChild() {} clear() {} },
  Text: class Text { constructor(...args: any[]) {} },
  truncateToWidth: () => 'truncated',
}));

vi.mock('../../../extensions/capability-system/plugin-loader.ts', () => ({
  createPluginLoader: () => ({
    loadAll: async () => ({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
    getStats: () => ({ totalPlugins: 0, totalCapabilities: 0, errors: [] }),
    getLoadedPlugins: () => [],
  }),
  getGlobalLoader: () => null,
  setGlobalLoader: () => {},
}));

vi.mock('../../../extensions/capability-system/registry.ts', () => ({
  getCapabilityRegistry: () => ({
    has: () => false,
    register: () => {},
    listAll: () => [],
    get: () => undefined,
  }),
}));

vi.mock('../../../extensions/capability-system/prompt-integration.ts', () => ({
  createCapabilityDiscoveryCapability: () => ({ id: 'system.capabilities' }),
  default: () => {},
}));

// Now import extension
import capabilitySystemExtension from '../../../extensions/capability-system/extension.ts';

describe('Capability System Extension (minimal)', () => {
  it('executes and registers tool', async () => {
    const api = {
      registerTool: (tool: any) => {
        expect(tool.name).toBe('capability');
      },
      registerCommand: () => {},
      pluginLoader: undefined,
    };
    await capabilitySystemExtension(api);
  });
});
