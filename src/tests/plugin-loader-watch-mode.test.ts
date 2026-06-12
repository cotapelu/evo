import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import * as fs from 'fs';
import { PluginLoader } from '@extensions/capability-system/plugin-loader';
import { getCapabilityRegistry } from '@extensions/capability-system/registry';

describe('PluginLoader Watch Mode Integration', () => {
  let tempDir: string;
  let loadedPlugins: string[];
  let unloadedPlugins: string[];
  let loader: PluginLoader;

  const waitFor = async (condition: () => boolean, { timeout = 2000, interval = 50 } = {}): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync('/tmp/plugin-loader-watch-');
    loadedPlugins = [];
    unloadedPlugins = [];

    loader = new PluginLoader({
      pluginsDir: tempDir,
      watchMode: true,
      onPluginLoaded: (m) => loadedPlugins.push(m.id),
      onPluginUnloaded: (id) => unloadedPlugins.push(id)
    });
  });

  afterEach(async () => {
    // Cleanup: stop watching and unload all
    loader.unloadAll();

    // Wait a bit for any fs.watch cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should reload plugin when manifest changes', async () => {
    const pluginId = 'watch-manifest';
    const pluginDir = join(tempDir, pluginId);
    const capDir = join(pluginDir, 'capabilities');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(capDir, { recursive: true });

    const manifestV1 = {
      id: pluginId,
      name: 'Plugin V1',
      description: 'V1',
      version: '1.0.0',
      tags: [],
      capabilities: [
        {
          id: 'get',
          name: 'Get',
          description: 'Get',
          inputSchema: { type: 'object', properties: {} },
          execute: 'capabilities/get.ts',
          promptGuidelines: [],
          dependencies: []
        }
      ]
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifestV1));
    fs.writeFileSync(join(capDir, 'get.ts'), `
      export async function execute(params, ctx) {
        return { content: [{ type: 'text' as const, text: 'get-v1' }] };
      }
    `);

    await loader.loadAll();
    await loader.waitForLoad();

    const registry = getCapabilityRegistry();
    let cap = registry.get(`${pluginId}.get`)!;
    let result = await cap.execute('t1', {}, null, null, {} as any);
    expect(result.content[0].text).toBe('get-v1');

    // Change manifest (version and name)
    const manifestV2 = {
      ...manifestV1,
      name: 'Plugin V2',
      version: '2.0.0'
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifestV2));

    // Wait for reload: plugin should be unloaded and then loaded again (total 2 loads)
    await waitFor(() => loader.getStats().totalPlugins === 1 && loadedPlugins.filter(id => id === pluginId).length >= 2);

    // Verify plugin reloaded (capability still exists)
    cap = registry.get(`${pluginId}.get`)!;
    result = await cap.execute('t2', {}, null, null, {} as any);
    expect(result.content[0].text).toBe('get-v1');
  });

  it('should unload plugin when folder is deleted', async () => {
    const pluginId = 'watch-delete';
    const pluginDir = join(tempDir, pluginId);
    const capDir = join(pluginDir, 'capabilities');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(capDir, { recursive: true });

    const manifest = {
      id: pluginId,
      name: 'Delete Me',
      description: 'To be deleted',
      version: '1.0.0',
      tags: [],
      capabilities: [
        {
          id: 'action',
          name: 'Action',
          description: 'Action',
          inputSchema: { type: 'object', properties: {} },
          execute: 'capabilities/action.ts',
          promptGuidelines: [],
          dependencies: []
        }
      ]
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(join(capDir, 'action.ts'), `
      export async function execute(params, ctx) {
        return { content: [{ type: 'text' as const, text: 'alive' }] };
      }
    `);

    await loader.loadAll();
    await loader.waitForLoad();

    expect(loader.getStats().totalPlugins).toBe(1);
    const registry = getCapabilityRegistry();
    const cap = registry.get(`${pluginId}.action`)!;
    expect(cap).toBeDefined();

    // Delete the plugin folder
    fs.rmSync(pluginDir, { recursive: true, force: true });

    // Wait for unload
    await waitFor(() => !fs.existsSync(pluginDir) && unloadedPlugins.includes(pluginId));

    // Verify plugin removed
    expect(loader.getStats().totalPlugins).toBe(0);
    expect(registry.get(`${pluginId}.action`)).toBeUndefined();
  });
});
