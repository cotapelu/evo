import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginLoader } from '../../../extensions/capability-system/plugin-loader.ts';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  watch: vi.fn(() => ({ close: vi.fn() }))
}));

// Mock registry
vi.mock('../../../extensions/capability-system/registry.js', () => ({
  getCapabilityRegistry: vi.fn(() => ({
    register: vi.fn(),
    unregister: vi.fn(),
  }))
}));

// Mock guideline-generator
vi.mock('../../../extensions/capability-system/guideline-generator.ts', () => ({
  generateCapabilityGuidelines: vi.fn(() => ['Guideline']),
  extractMinimalParams: vi.fn(() => ({}))
}));

import { existsSync, readdirSync, readFileSync } from 'fs';

describe('PluginLoader branch coverage', () => {
  let pluginsDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    pluginsDir = '/tmp/plugins';
    (existsSync as any).mockReturnValue(true);
    (readdirSync as any).mockReturnValue([]); // no plugins by default
  });

  it('loadAll returns empty when plugins dir missing', async () => {
    (existsSync as any).mockReturnValue(false);
    const loader = new PluginLoader({ pluginsDir });
    const stats = await loader.loadAll();
    expect(stats.totalPlugins).toBe(0);
    expect(stats.totalCapabilities).toBe(0);
  });

  it('loadPlugin throws if manifest not found', async () => {
    (existsSync as any).mockImplementation((p: string) => !p.endsWith('manifest.json'));
    (readdirSync as any).mockReturnValue([{ name: 'plugin1', isDirectory: () => true }]);
    const loader = new PluginLoader({ pluginsDir });
    await expect(loader.loadPlugin('plugin1')).rejects.toThrow('Missing');
  });

  it('getPluginFolders returns only directories', () => {
    (readdirSync as any).mockReturnValue([
      { name: 'dirA', isDirectory: () => true },
      { name: 'dirB', isDirectory: () => true },
      { name: 'file.txt', isDirectory: () => false },
    ]);
    const loader = new PluginLoader({ pluginsDir });
    const folders = (loader as any).getPluginFolders(pluginsDir);
    expect(folders).toEqual(['dirA', 'dirB']);
  });

  it('waitForLoad resolves', async () => {
    (readdirSync as any).mockReturnValue([]);
    const loader = new PluginLoader({ pluginsDir });
    const p1 = loader.waitForLoad();
    const p2 = loader.waitForLoad();
    // Both should resolve to same result
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(loader.isLoaded).toBe(true);
  });

  it('loadAll skips plugins that throw during loadPlugin', async () => {
    (readdirSync as any).mockReturnValue([{ name: 'bad', isDirectory: () => true }]);
    // loadPlugin will throw because no manifest
    const loader = new PluginLoader({ pluginsDir });
    const stats = await loader.loadAll();
    expect(stats.errors.length).toBeGreaterThan(0);
    expect(stats.totalPlugins).toBe(0);
  });
});
