import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { resolve } from 'path';
import { FileCache } from '../cache.js';

describe('FileCache – Recovery & Atomicity', () => {
  let cacheDir: string;
  let cache: FileCache;

  const manifestDir = (dir: string) => join(dir, '.evo-cache');
  const manifestPath = (dir: string) => join(dir, '.evo-cache', 'manifest.json');
  const backupPath = (dir: string) => join(dir, '.evo-cache', 'manifest.json.bak');

  beforeEach(() => {
    cacheDir = join(os.tmpdir(), `evo-cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    mkdirSync(cacheDir, { recursive: true });
    // Remove any existing cache files
    try { rmSync(manifestDir(cacheDir), { recursive: true, force: true }); } catch {}
    cache = new FileCache(cacheDir);
  });

  afterEach(() => {
    try { rmSync(manifestDir(cacheDir), { recursive: true, force: true }); } catch {}
  });

  test('load: handles missing manifest as empty cache', async () => {
    const loaded = await cache.load();
    expect(loaded).toBe(false);
    expect(cache.size).toBe(0);
  });

  test('load: recovers from manifest', async () => {
    // Save some entries first
    await cache.load(); // ensures directory
    const key1 = resolve('k1');
    const key2 = join(cacheDir, 'some', 'path.txt');
    cache.set(key1, 'value1');
    cache.set(key2, 'value2');
    await cache.save();

    // New instance
    const cache2 = new FileCache(cacheDir);
    const loaded = await cache2.load();
    expect(loaded).toBe(true);
    expect(cache2.size).toBe(2);
  });

  test('save: creates backup of previous manifest', async () => {
    // Load ensures directory exists
    await cache.load();

    // Add entry and save
    const key1 = resolve('k1');
    cache.set(key1, 'v1');
    await cache.save();

    expect(existsSync(backupPath(cacheDir))).toBe(true);
    const backupRaw = readFileSync(backupPath(cacheDir), 'utf-8');
    const backup = JSON.parse(backupRaw);
    expect(backup[key1]).toBeDefined();
    expect(backup[key1].content).toBe('v1');
  });

  test('save: produces valid manifest and backup', async () => {
    await cache.load();
    const key1 = resolve('k1');
    cache.set(key1, 'v1');
    await cache.save();

    const manifest = manifestPath(cacheDir);
    const backup = backupPath(cacheDir);
    expect(existsSync(manifest)).toBe(true);
    expect(existsSync(backup)).toBe(true);

    const raw = readFileSync(manifest, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed[key1].content).toBe('v1');
  });

  test('clear: removes manifest and backup', async () => {
    // Pre-create empty manifest and backup files
    mkdirSync(manifestDir(cacheDir), { recursive: true });
    writeFileSync(manifestPath(cacheDir), '{}');
    writeFileSync(backupPath(cacheDir), '{}');

    // Do not call load; just instantiate and clear
    cache = new FileCache(cacheDir);
    await cache.clearPersistence();

    expect(existsSync(manifestPath(cacheDir))).toBe(false);
    expect(existsSync(backupPath(cacheDir))).toBe(false);
  });
});
