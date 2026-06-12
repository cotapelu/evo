import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import * as fs from 'fs';
import { PluginLoader } from '@extensions/capability-system/plugin-loader';

describe('PluginLoader Edge Cases', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temporary directory
    tempDir = fs.mkdtempSync('/tmp/plugin-loader-test-');
  });

  afterEach(() => {
    // Clean up temp directory recursively
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should reject plugin manifest missing required id', async () => {
    const pluginDir = join(tempDir, 'badplugin');
    fs.mkdirSync(pluginDir, { recursive: true });

    const manifest = {
      name: "Bad Plugin",
      description: "Missing id field",
      version: "1.0.0",
      tags: [],
      capabilities: []
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest));

    const loader = new PluginLoader({ pluginsDir: tempDir });
    await expect(loader.loadPlugin('badplugin')).rejects.toThrow("Missing 'id'");
  });

  it('should reject plugin with empty capabilities array', async () => {
    const pluginDir = join(tempDir, 'no-caps');
    fs.mkdirSync(pluginDir, { recursive: true });

    const manifest = {
      id: 'no-caps',
      name: 'No Caps',
      description: 'No capabilities defined',
      version: '1.0.0',
      tags: [],
      capabilities: []
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest));

    const loader = new PluginLoader({ pluginsDir: tempDir });
    await expect(loader.loadPlugin('no-caps')).rejects.toThrow("At least one capability required");
  });

  it('should reject capability with invalid ID pattern (uppercase)', async () => {
    const pluginDir = join(tempDir, 'bad-cap');
    fs.mkdirSync(pluginDir, { recursive: true });

    const manifest = {
      id: 'bad-cap',
      name: 'Bad Cap Plugin',
      description: 'Contains an invalid capability ID',
      version: '1.0.0',
      tags: [],
      capabilities: [
        {
          id: 'InvalidCap', // Capital letter => invalid
          name: 'Invalid Capability',
          description: 'Tests invalid ID pattern',
          inputSchema: { type: 'object', properties: {} },
          execute: 'capabilities/invalid.ts',
          promptGuidelines: [],
          dependencies: []
        }
      ]
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest));

    const loader = new PluginLoader({ pluginsDir: tempDir });
    await expect(loader.loadPlugin('bad-cap')).rejects.toThrow('Invalid capability ID');
  });

  it('should allow reloading a plugin with same ID', async () => {
    // Create a minimal valid plugin
    const pluginDir = join(tempDir, 'reload-test');
    fs.mkdirSync(pluginDir, { recursive: true });

    const manifest1 = {
      id: 'reload-test',
      name: 'Reload Test V1',
      description: 'First version',
      version: '1.0.0',
      tags: [],
      capabilities: [
        {
          id: 'cap1',
          name: 'Cap 1',
          description: 'First capability',
          inputSchema: { type: 'object', properties: {} },
          execute: 'capabilities/cap1.ts',
          promptGuidelines: [],
          dependencies: []
        }
      ]
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest1));
    // Create the execute file (empty module is fine)
    fs.mkdirSync(join(pluginDir, 'capabilities'), { recursive: true });
    fs.writeFileSync(join(pluginDir, 'capabilities/cap1.ts'), 'export async function execute() { return { content: [] }; }');

    const loader = new PluginLoader({ pluginsDir: tempDir });

    // Load initial plugin
    const loaded1 = await loader.loadPlugin('reload-test');
    expect(loaded1.manifest.name).toBe('Reload Test V1');
    expect(loaded1.capabilities).toHaveLength(1);

    // Modify manifest to new version
    const manifest2 = {
      ...manifest1,
      name: 'Reload Test V2',
      version: '2.0.0'
    };
    fs.writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest2));

    // Reload should replace
    const loaded2 = await loader.loadPlugin('reload-test');
    expect(loaded2.manifest.name).toBe('Reload Test V2');
    // The plugin should still have the same number of capabilities (still one)
    expect(loaded2.capabilities).toHaveLength(1);
  });
});
